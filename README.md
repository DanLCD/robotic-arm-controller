# Robotic Arm Controller

A three-tier robotic arm control system for a **5-DOF + Gripper (6 heavy-duty servos)** arm:

- **`frontend/`**: Vite + React + TypeScript + Tailwind CSS + Three.js (`@react-three/fiber`) interactive GUI with live 3D kinematic visualization, joint sliders, E-Stop, and a future-ready Raspberry Pi camera panel.
- **`backend/`**: Python 3.12 + FastAPI WebSocket ASGI server acting as the brain, with an abstracted `ArmDriver` (`MockArmDriver`, `SerialMegaDriver`, and future `PiEdgeDriver`) and `CameraStreamProvider`.
- **`drivers/arduino_mega/`**: Arduino Mega 2560 firmware (`arm_controller.ino`) using a deterministic framed ASCII serial protocol (`<...>`) with non-blocking smooth motion ramping, mechanical joint clamping, and E-Stop.

## Quick Start

### One-Step Install & Start
- **Windows**:
  ```powershell
  .\install.bat
  .\start.bat
  ```
- **Linux / macOS**:
  ```bash
  chmod +x install.sh start.sh
  ./install.sh
  ./start.sh
  ```

### Manual Start (Optional)
#### 1. Backend (FastAPI)
```powershell
cd backend
.\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```

### 2. Frontend (Vite + React)
```powershell
cd frontend
npm run dev
```
Open `http://localhost:5173`. By default the backend starts in **Mock Simulator** mode so you can test the 3D arm and sliders immediately.

### 3. Arduino Mega Firmware
1. Open `drivers/arduino_mega/arm_controller.ino` in the Arduino IDE.
2. Adjust pins and mechanical limits in `drivers/arduino_mega/config.h`.
3. **Power Safety**: Power all heavy-duty servos from an external regulated 5V–7.4V DC supply with common ground to the Arduino Mega (never from the Mega's 5V pin).
4. Flash to Arduino Mega 2560, then select **Arduino Mega (Serial)** and your COM port in the GUI top bar.
