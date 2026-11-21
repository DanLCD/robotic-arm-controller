from pydantic import BaseModel
from pydantic_settings import BaseSettings


class JointConfig(BaseModel):
    id: int
    name: str
    min_angle: float
    max_angle: float
    home_angle: float


DEFAULT_JOINTS: list[JointConfig] = [
    JointConfig(id=0, name="Base", min_angle=0.0, max_angle=180.0, home_angle=90.0),
    JointConfig(id=1, name="Shoulder", min_angle=0.0, max_angle=180.0, home_angle=130.0),
    JointConfig(id=2, name="Elbow", min_angle=0.0, max_angle=180.0, home_angle=180.0),
    JointConfig(id=3, name="Wrist Pitch", min_angle=0.0, max_angle=180.0, home_angle=0.0),
    JointConfig(id=4, name="Wrist Roll", min_angle=0.0, max_angle=180.0, home_angle=90.0),
    JointConfig(id=5, name="Gripper", min_angle=75.0, max_angle=180.0, home_angle=75.0),
]


class Settings(BaseSettings):
    app_name: str = "Robotic Arm Controller"
    default_driver: str = "mock"  # "mock" | "serial" | "pi_edge"
    serial_baud: int = 115200
    default_speed_dps: float = 45.0
    min_speed_dps: float = 5.0
    max_speed_dps: float = 180.0
    telemetry_hz: float = 20.0
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    pi_edge_url: str | None = None

    model_config = {"env_prefix": "ARM_"}


settings = Settings()
