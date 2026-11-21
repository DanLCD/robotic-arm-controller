from fastapi.testclient import TestClient

from app.main import app


def test_health_and_joints_endpoints() -> None:
    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.json()["status"] == "ok"

        joints = client.get("/api/joints")
        assert joints.status_code == 200
        data = joints.json()
        assert len(data) == 6
        assert data[0]["name"] == "Base"
        assert data[5]["name"] == "Gripper"


def test_websocket_command_and_estop_flow() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws/arm") as ws:
            initial = ws.receive_json()
            assert initial["type"] == "telemetry"
            assert initial["driver"] == "mock"
            assert initial["state"] == "READY"
            assert len(initial["angles"]) == 6

            # Send move command
            ws.send_json({
                "type": "set_joints",
                "angles": [120, 60, 110, 45, 90, 50],
                "speed_dps": 90,
            })

            # Trigger E-Stop
            ws.send_json({"type": "estop"})
            msg = ws.receive_json()
            while msg["type"] == "telemetry":
                msg = ws.receive_json()
            assert msg["type"] == "status"
            assert "EMERGENCY STOP" in msg["message"]

            # Moving while E-Stopped should return an error
            ws.send_json({
                "type": "set_joints",
                "angles": [90, 90, 90, 90, 90, 30],
                "speed_dps": 45,
            })
            err = ws.receive_json()
            while err["type"] == "telemetry":
                err = ws.receive_json()
            assert err["type"] == "error"
            assert "ESTOPPED" in err["message"]

            # Reset should restore READY state
            ws.send_json({"type": "reset"})
            reset_msg = ws.receive_json()
            while reset_msg["type"] == "telemetry":
                reset_msg = ws.receive_json()
            assert reset_msg["type"] == "status"
            assert "READY" in reset_msg["message"]
