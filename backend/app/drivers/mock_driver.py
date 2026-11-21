import asyncio
import time
from app.config import DEFAULT_JOINTS, settings
from app.drivers.base import ArmDriver, clamp_angles, clamp_speed
from app.models import ArmState, ArmTelemetry, DriverType


class MockArmDriver(ArmDriver):
    """In-memory 6-DOF arm simulator for development and testing without hardware."""

    driver_type: DriverType = "mock"

    def __init__(self) -> None:
        home = [j.home_angle for j in DEFAULT_JOINTS]
        self._angles: list[float] = list(home)
        self._targets: list[float] = list(home)
        self._speed_dps: float = settings.default_speed_dps
        self._state: ArmState = "DISCONNECTED"
        self._task: asyncio.Task[None] | None = None
        self._running = False

    async def connect(self) -> None:
        if self._running:
            return
        self._running = True
        self._state = "READY"
        self._task = asyncio.create_task(self._sim_loop())

    async def disconnect(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        self._state = "DISCONNECTED"

    async def set_joints(self, angles: list[float], speed_dps: float) -> None:
        if self._state == "DISCONNECTED":
            raise RuntimeError("Mock driver is disconnected")
        if self._state == "ESTOPPED":
            raise RuntimeError("Arm is ESTOPPED; send reset before moving")
        self._targets = clamp_angles(angles)
        self._speed_dps = clamp_speed(speed_dps)
        self._state = "MOVING"

    async def home(self) -> None:
        home = [j.home_angle for j in DEFAULT_JOINTS]
        await self.set_joints(home, settings.default_speed_dps)

    async def estop(self) -> None:
        self._targets = list(self._angles)
        self._state = "ESTOPPED"

    async def reset(self) -> None:
        if self._state == "ESTOPPED":
            self._targets = list(self._angles)
            self._state = "READY"

    def get_telemetry(self) -> ArmTelemetry:
        return ArmTelemetry(
            angles=[round(a, 1) for a in self._angles],
            targets=[round(t, 1) for t in self._targets],
            speed_dps=self._speed_dps,
            state=self._state,
            driver=self.driver_type,
            port="SIMULATOR",
            camera_available=False,
            timestamp=time.time(),
        )

    async def _sim_loop(self) -> None:
        dt = 1.0 / settings.telemetry_hz
        while self._running:
            if self._state not in ("ESTOPPED", "DISCONNECTED"):
                max_step = self._speed_dps * dt
                any_moving = False
                for i in range(len(self._angles)):
                    diff = self._targets[i] - self._angles[i]
                    if abs(diff) > 0.05:
                        any_moving = True
                        if abs(diff) <= max_step:
                            self._angles[i] = self._targets[i]
                        else:
                            self._angles[i] += max_step if diff > 0 else -max_step
                    else:
                        self._angles[i] = self._targets[i]
                self._state = "MOVING" if any_moving else "READY"
            await asyncio.sleep(dt)
