import asyncio
import logging
import time
from typing import Any

import serial
import serial.tools.list_ports

from app.config import DEFAULT_JOINTS, settings
from app.drivers.base import ArmDriver, clamp_angles, clamp_speed
from app.models import ArmState, ArmTelemetry, DriverType, SerialPortInfo

logger = logging.getLogger(__name__)


def list_serial_ports() -> list[SerialPortInfo]:
    """Return available system serial/COM ports."""
    ports = serial.tools.list_ports.comports()
    return [
        SerialPortInfo(
            device=p.device,
            description=p.description or "Unknown device",
            hwid=p.hwid or "",
        )
        for p in ports
    ]


def encode_move_frame(angles: list[float], speed_dps: float) -> bytes:
    """Encode a <M:a0,a1,a2,a3,a4,a5,spd> ASCII command frame."""
    clamped = clamp_angles(angles)
    spd = clamp_speed(speed_dps)
    values = ",".join(f"{a:.1f}" for a in clamped)
    return f"<M:{values},{spd:.1f}>\n".encode("ascii")


def parse_serial_frame(raw_frame: str) -> tuple[str, Any]:
    """Parse a single '<...>' frame payload (without angle brackets).

    Returns (kind, payload) where kind is one of:
      'TEL', 'OK', 'ERR', 'PONG', 'UNKNOWN'
    """
    frame = raw_frame.strip()
    if frame.startswith("<") and frame.endswith(">"):
        frame = frame[1:-1]

    if frame == "PONG":
        return ("PONG", None)
    if frame.startswith("OK:"):
        return ("OK", frame[3:])
    if frame.startswith("ERR:"):
        return ("ERR", frame[4:])
    if frame.startswith("TEL:"):
        parts = frame[4:].split(",")
        if len(parts) != len(DEFAULT_JOINTS) + 1:
            return ("ERR", f"MALFORMED_TEL:{frame}")
        try:
            angles = [float(p) for p in parts[:-1]]
        except ValueError:
            return ("ERR", f"NON_NUMERIC_TEL:{frame}")
        state_str = parts[-1].strip()
        if state_str not in ("READY", "MOVING", "ESTOPPED"):
            state_str = "READY"
        return ("TEL", (angles, state_str))
    return ("UNKNOWN", frame)


class SerialMegaDriver(ArmDriver):
    """Serial ASCII driver for Arduino Mega 2560."""

    driver_type: DriverType = "serial"

    def __init__(self, port: str, baudrate: int = settings.serial_baud) -> None:
        self._port = port
        self._baudrate = baudrate
        self._serial: serial.Serial | None = None
        self._running = False
        self._reader_task: asyncio.Task[None] | None = None
        self._write_lock = asyncio.Lock()

        home = [j.home_angle for j in DEFAULT_JOINTS]
        self._angles: list[float] = list(home)
        self._targets: list[float] = list(home)
        self._speed_dps: float = settings.default_speed_dps
        self._state: ArmState = "DISCONNECTED"
        self._last_error: str | None = None

    async def connect(self) -> None:
        if self._running:
            return
        self._serial = await asyncio.to_thread(
            serial.Serial,
            self._port,
            self._baudrate,
            timeout=0.1,
            write_timeout=1.0,
        )
        # Arduino Mega resets on serial open; allow brief bootloader settle
        await asyncio.sleep(1.8)
        self._running = True
        self._state = "READY"
        self._reader_task = asyncio.create_task(self._read_loop())

    async def disconnect(self) -> None:
        self._running = False
        if self._reader_task is not None:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass
            self._reader_task = None
        if self._serial is not None:
            try:
                await asyncio.to_thread(self._serial.close)
            except Exception:
                logger.exception("Error closing serial port %s", self._port)
            self._serial = None
        self._state = "DISCONNECTED"

    async def _send_raw(self, payload: bytes) -> None:
        if self._serial is None or not self._serial.is_open:
            raise RuntimeError("Serial port is not connected")
        async with self._write_lock:
            await asyncio.to_thread(self._serial.write, payload)

    async def set_joints(self, angles: list[float], speed_dps: float) -> None:
        if self._state == "ESTOPPED":
            raise RuntimeError("Arm is ESTOPPED; send reset before moving")
        clamped = clamp_angles(angles)
        spd = clamp_speed(speed_dps)
        self._targets = clamped
        self._speed_dps = spd
        await self._send_raw(encode_move_frame(clamped, spd))

    async def home(self) -> None:
        if self._state == "ESTOPPED":
            raise RuntimeError("Arm is ESTOPPED; send reset before homing")
        self._targets = [j.home_angle for j in DEFAULT_JOINTS]
        await self._send_raw(b"<H>\n")

    async def estop(self) -> None:
        self._state = "ESTOPPED"
        self._targets = list(self._angles)
        await self._send_raw(b"<E>\n")

    async def reset(self) -> None:
        await self._send_raw(b"<R>\n")

    def get_telemetry(self) -> ArmTelemetry:
        return ArmTelemetry(
            angles=[round(a, 1) for a in self._angles],
            targets=[round(t, 1) for t in self._targets],
            speed_dps=self._speed_dps,
            state=self._state,
            driver=self.driver_type,
            port=self._port,
            camera_available=False,
            timestamp=time.time(),
        )

    async def _read_loop(self) -> None:
        buffer = ""
        while self._running and self._serial is not None:
            try:
                chunk: bytes = await asyncio.to_thread(self._serial.read_until, b"\n")
                if not chunk:
                    continue
                buffer += chunk.decode("ascii", errors="ignore")
                while "<" in buffer and ">" in buffer:
                    start = buffer.index("<")
                    end = buffer.index(">", start)
                    frame = buffer[start + 1 : end]
                    buffer = buffer[end + 1 :]
                    self._handle_frame(frame)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Serial read error on %s: %s", self._port, exc)
                self._state = "DISCONNECTED"
                self._running = False
                break

    def _handle_frame(self, frame: str) -> None:
        kind, payload = parse_serial_frame(frame)
        if kind == "TEL":
            angles, state_str = payload
            self._angles = angles
            self._state = state_str
        elif kind == "ERR":
            self._last_error = str(payload)
            logger.warning("Arduino Mega error frame: %s", payload)
