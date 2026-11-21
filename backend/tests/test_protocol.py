import pytest

from app.drivers.base import clamp_angles, clamp_speed
from app.drivers.serial_mega import encode_move_frame, parse_serial_frame


def test_clamp_angles_respects_mechanical_limits() -> None:
    raw = [-20.0, -5.0, 200.0, 90.0, 250.0, 30.0]
    clamped = clamp_angles(raw)
    assert clamped == [0.0, 0.0, 180.0, 90.0, 180.0, 75.0]


def test_clamp_angles_rejects_wrong_length() -> None:
    with pytest.raises(ValueError, match="Expected 6 joint angles"):
        clamp_angles([90.0, 90.0])


def test_clamp_speed_bounds() -> None:
    assert clamp_speed(1.0) == 5.0
    assert clamp_speed(500.0) == 180.0
    assert clamp_speed(60.0) == 60.0


def test_encode_move_frame() -> None:
    frame = encode_move_frame([90, 45, 120, 90, 90, 90], 60)
    assert frame == b"<M:90.0,45.0,120.0,90.0,90.0,90.0,60.0>\n"


def test_parse_serial_telemetry_frame() -> None:
    kind, payload = parse_serial_frame("TEL:90.0,45.0,120.0,90.0,90.0,30.0,MOVING")
    assert kind == "TEL"
    angles, state = payload
    assert angles == [90.0, 45.0, 120.0, 90.0, 90.0, 30.0]
    assert state == "MOVING"


def test_parse_serial_control_frames() -> None:
    assert parse_serial_frame("<OK:M>") == ("OK", "M")
    assert parse_serial_frame("<ERR:ESTOPPED>") == ("ERR", "ESTOPPED")
    assert parse_serial_frame("<PONG>") == ("PONG", None)
    assert parse_serial_frame("TEL:1,2,3,READY")[0] == "ERR"
