@echo off
setlocal

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

if not exist "%ROOT_DIR%\backend\.venv\Scripts\uvicorn.exe" (
    echo [ERROR] Backend virtual environment not found. Please run install.bat first.
    exit /b 1
)

if not exist "%ROOT_DIR%\frontend\node_modules" (
    echo [ERROR] Frontend node_modules not found. Please run install.bat first.
    exit /b 1
)

echo Starting Robotic Arm Controller...
echo   Backend : http://127.0.0.1:8000
echo   Frontend: http://localhost:5173
echo.

start "Robotic Arm Backend (FastAPI)" cmd /k "cd /d "%ROOT_DIR%\backend" && .venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8000"
start "Robotic Arm Frontend (Vite)" cmd /k "cd /d "%ROOT_DIR%\frontend" && npm run dev"

endlocal
