import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import TypeAdapter, ValidationError

from app.config import DEFAULT_JOINTS, JointConfig, settings
from app.drivers.base import ArmDriver
from app.drivers.mock_driver import MockArmDriver
from app.drivers.pi_edge import PiEdgeDriver
from app.drivers.serial_mega import SerialMegaDriver, list_serial_ports
from app.models import (
    DriverType,
    EstopCommand,
    HomeCommand,
    ResetCommand,
    SerialPortInfo,
    SetJointsCommand,
    StatusMessage,
    SwitchDriverCommand,
)

logger = logging.getLogger(__name__)

CommandUnion = (
    SetJointsCommand
    | HomeCommand
    | EstopCommand
    | ResetCommand
    | SwitchDriverCommand
)
command_adapter: TypeAdapter[CommandUnion] = TypeAdapter(CommandUnion)


class ArmManager:
    """Coordinates the active ArmDriver and broadcasts telemetry to WebSocket clients."""

    def __init__(self) -> None:
        self.driver: ArmDriver = MockArmDriver()
        self.clients: set[WebSocket] = set()
        self._broadcast_task: asyncio.Task[None] | None = None
        self._driver_lock = asyncio.Lock()

    async def start(self) -> None:
        await self.driver.connect()
        self._broadcast_task = asyncio.create_task(self._broadcast_loop())

    async def stop(self) -> None:
        if self._broadcast_task is not None:
            self._broadcast_task.cancel()
            try:
                await self._broadcast_task
            except asyncio.CancelledError:
                pass
            self._broadcast_task = None
        await self.driver.disconnect()

    async def switch_driver(
        self,
        driver_type: DriverType,
        port: str | None = None,
        pi_url: str | None = None,
    ) -> None:
        async with self._driver_lock:
            new_driver: ArmDriver
            if driver_type == "mock":
                new_driver = MockArmDriver()
            elif driver_type == "serial":
                if not port:
                    raise ValueError("Serial port must be specified for 'serial' driver")
                new_driver = SerialMegaDriver(port=port, baudrate=settings.serial_baud)
            elif driver_type == "pi_edge":
                new_driver = PiEdgeDriver(pi_url=pi_url)
            else:
                raise ValueError(f"Unsupported driver type: {driver_type}")

            await new_driver.connect()
            old_driver = self.driver
            self.driver = new_driver
            await old_driver.disconnect()

    async def handle_command(self, raw_data: str) -> StatusMessage | None:
        try:
            payload: Any = json.loads(raw_data)
            cmd = command_adapter.validate_python(payload)
        except (json.JSONDecodeError, ValidationError) as exc:
            return StatusMessage(type="error", message=f"Invalid command: {exc}")

        try:
            if isinstance(cmd, SetJointsCommand):
                await self.driver.set_joints(cmd.angles, cmd.speed_dps)
                return None
            if isinstance(cmd, HomeCommand):
                await self.driver.home()
                return StatusMessage(type="status", message="Moving to Home pose", driver=self.driver.driver_type)
            if isinstance(cmd, EstopCommand):
                await self.driver.estop()
                return StatusMessage(type="status", message="EMERGENCY STOP ACTIVATED", driver=self.driver.driver_type)
            if isinstance(cmd, ResetCommand):
                await self.driver.reset()
                return StatusMessage(type="status", message="Arm reset to READY", driver=self.driver.driver_type)
            if isinstance(cmd, SwitchDriverCommand):
                await self.switch_driver(cmd.driver, port=cmd.port, pi_url=cmd.pi_url)
                return StatusMessage(
                    type="status",
                    message=f"Switched to {cmd.driver} driver",
                    driver=self.driver.driver_type,
                )
        except Exception as exc:
            return StatusMessage(type="error", message=str(exc), driver=self.driver.driver_type)
        return None

    async def _broadcast_loop(self) -> None:
        interval = 1.0 / settings.telemetry_hz
        while True:
            if self.clients:
                telemetry_json = self.driver.get_telemetry().model_dump_json()
                dead_clients: list[WebSocket] = []
                for ws in list(self.clients):
                    try:
                        await ws.send_text(telemetry_json)
                    except Exception:
                        dead_clients.append(ws)
                for ws in dead_clients:
                    self.clients.discard(ws)
            await asyncio.sleep(interval)


manager = ArmManager()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await manager.start()
    try:
        yield
    finally:
        await manager.stop()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "driver": manager.driver.driver_type}


@app.get("/api/joints", response_model=list[JointConfig])
async def get_joints() -> list[JointConfig]:
    return DEFAULT_JOINTS


@app.get("/api/ports", response_model=list[SerialPortInfo])
async def get_ports() -> list[SerialPortInfo]:
    return list_serial_ports()


@app.get("/api/camera/status")
async def get_camera_status() -> dict[str, Any]:
    if isinstance(manager.driver, PiEdgeDriver):
        return {
            "available": manager.driver.camera.is_available(),
            "stream_url": manager.driver.camera.get_stream_url(),
        }
    return {"available": False, "stream_url": None}


@app.websocket("/ws/arm")
async def arm_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    manager.clients.add(websocket)
    try:
        await websocket.send_text(manager.driver.get_telemetry().model_dump_json())
        while True:
            raw_msg = await websocket.receive_text()
            response = await manager.handle_command(raw_msg)
            if response is not None:
                await websocket.send_text(response.model_dump_json())
    except WebSocketDisconnect:
        pass
    finally:
        manager.clients.discard(websocket)
