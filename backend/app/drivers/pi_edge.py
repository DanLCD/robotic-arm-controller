import time
from collections.abc import AsyncIterator
from app.config import DEFAULT_JOINTS, settings
from app.drivers.base import ArmDriver, CameraStreamProvider, clamp_angles, clamp_speed
from app.models import ArmState, ArmTelemetry, DriverType


class PiCameraStreamProvider(CameraStreamProvider):
    """Future Raspberry Pi edge camera stream proxy (MJPEG / WebRTC)."""

    def __init__(self, base_url: str | None = None) -> None:
        self._base_url = base_url.rstrip("/") if base_url else None

    def is_available(self) -> bool:
        return bool(self._base_url)

    def get_stream_url(self) -> str | None:
        if not self._base_url:
            return None
        return f"{self._base_url}/camera/mjpeg"

    async def stream_mjpeg(self) -> AsyncIterator[bytes]:
        if not self._base_url:
            raise RuntimeError("Raspberry Pi camera edge URL is not configured")
        # Future: proxy httpx.AsyncClient().stream("GET", self.get_stream_url())
        raise NotImplementedError("Pi MJPEG proxy will be enabled when Raspberry Pi node is deployed")
        yield b""  # pragma: no cover


class PiEdgeDriver(ArmDriver):
    """Future networked Raspberry Pi edge-node driver.

    FastAPI remains the brain on the PC/server and forwards joint/safety commands
    over WebSocket or REST to the Raspberry Pi, which drives servos and streams video.
    """

    driver_type: DriverType = "pi_edge"

    def __init__(self, pi_url: str | None = None) -> None:
        self._pi_url = pi_url or settings.pi_edge_url
        self.camera = PiCameraStreamProvider(self._pi_url)
        home = [j.home_angle for j in DEFAULT_JOINTS]
        self._angles = list(home)
        self._targets = list(home)
        self._speed_dps = settings.default_speed_dps
        self._state: ArmState = "DISCONNECTED"

    async def connect(self) -> None:
        if not self._pi_url:
            raise RuntimeError(
                "Pi Edge URL not configured. Set ARM_PI_EDGE_URL or pass pi_url when switching driver."
            )
        # Future: open persistent WebSocket client to f"{self._pi_url}/ws/servo"
        raise NotImplementedError(
            "Raspberry Pi Edge transport is a future stub; use 'mock' or 'serial' for now."
        )

    async def disconnect(self) -> None:
        self._state = "DISCONNECTED"

    async def set_joints(self, angles: list[float], speed_dps: float) -> None:
        self._targets = clamp_angles(angles)
        self._speed_dps = clamp_speed(speed_dps)
        raise NotImplementedError("PiEdgeDriver.set_joints is not yet connected to hardware")

    async def home(self) -> None:
        raise NotImplementedError("PiEdgeDriver.home is not yet connected to hardware")

    async def estop(self) -> None:
        self._state = "ESTOPPED"

    async def reset(self) -> None:
        self._state = "READY"

    def get_telemetry(self) -> ArmTelemetry:
        return ArmTelemetry(
            angles=self._angles,
            targets=self._targets,
            speed_dps=self._speed_dps,
            state=self._state,
            driver=self.driver_type,
            port=self._pi_url,
            camera_available=self.camera.is_available(),
            timestamp=time.time(),
        )
