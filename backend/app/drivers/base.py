from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from app.config import DEFAULT_JOINTS, JointConfig, settings
from app.models import ArmTelemetry, DriverType


def clamp_angles(
    angles: list[float],
    joints: list[JointConfig] = DEFAULT_JOINTS,
) -> list[float]:
    """Clamp each joint angle to its configured mechanical [min_angle, max_angle] range."""
    if len(angles) != len(joints):
        raise ValueError(f"Expected {len(joints)} joint angles, got {len(angles)}")
    return [
        round(max(j.min_angle, min(j.max_angle, float(a))), 2)
        for a, j in zip(angles, joints)
    ]


def clamp_speed(speed_dps: float) -> float:
    """Clamp motion speed to configured safe bounds."""
    return round(max(settings.min_speed_dps, min(settings.max_speed_dps, float(speed_dps))), 2)


class ArmDriver(ABC):
    """Abstract interface for robotic arm hardware/edge drivers."""

    driver_type: DriverType

    @abstractmethod
    async def connect(self) -> None:
        """Establish connection to the arm controller."""

    @abstractmethod
    async def disconnect(self) -> None:
        """Close connection and clean up background tasks."""

    @abstractmethod
    async def set_joints(self, angles: list[float], speed_dps: float) -> None:
        """Command the arm to move to target joint angles (degrees) at speed_dps."""

    @abstractmethod
    async def home(self) -> None:
        """Move all joints to their configured home pose."""

    @abstractmethod
    async def estop(self) -> None:
        """Trigger immediate emergency stop."""

    @abstractmethod
    async def reset(self) -> None:
        """Clear emergency stop state and return to READY."""

    @abstractmethod
    def get_telemetry(self) -> ArmTelemetry:
        """Return the latest telemetry snapshot."""


class CameraStreamProvider(ABC):
    """Abstract interface for future Raspberry Pi camera video streaming."""

    @abstractmethod
    def is_available(self) -> bool:
        """Return True when a live camera stream is reachable."""

    @abstractmethod
    def get_stream_url(self) -> str | None:
        """Return the upstream MJPEG/WebRTC stream URL if available."""

    @abstractmethod
    async def stream_mjpeg(self) -> AsyncIterator[bytes]:
        """Yield multipart MJPEG frames for HTTP streaming."""
