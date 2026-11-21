from typing import Literal
from pydantic import BaseModel, Field

ArmState = Literal["DISCONNECTED", "READY", "MOVING", "ESTOPPED"]
DriverType = Literal["mock", "serial", "pi_edge"]


class ArmTelemetry(BaseModel):
    type: Literal["telemetry"] = "telemetry"
    angles: list[float]
    targets: list[float]
    speed_dps: float
    state: ArmState
    driver: DriverType
    port: str | None = None
    camera_available: bool = False
    timestamp: float


class StatusMessage(BaseModel):
    type: Literal["status", "error"]
    message: str
    driver: DriverType | None = None


class SerialPortInfo(BaseModel):
    device: str
    description: str
    hwid: str


class SetJointsCommand(BaseModel):
    type: Literal["set_joints"]
    angles: list[float] = Field(..., min_length=6, max_length=6)
    speed_dps: float = Field(default=45.0, ge=5.0, le=180.0)


class HomeCommand(BaseModel):
    type: Literal["home"]


class EstopCommand(BaseModel):
    type: Literal["estop"]


class ResetCommand(BaseModel):
    type: Literal["reset"]


class SwitchDriverCommand(BaseModel):
    type: Literal["switch_driver"]
    driver: DriverType
    port: str | None = None
    pi_url: str | None = None
