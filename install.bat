@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

echo ==================================================
echo   Robotic Arm Controller - Install Utility (Win)
echo ==================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.11+ from https://www.python.org/downloads/
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js / npm is not installed or not in PATH.
    echo Please install Node.js LTS from https://nodejs.org/
    exit /b 1
)

echo [1/2] Setting up Python backend virtual environment and dependencies...
cd /d "%ROOT_DIR%\backend"
if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create Python virtual environment.
        exit /b 1
    )
)

".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install backend Python dependencies.
    exit /b 1
)

echo.
echo [2/2] Installing frontend Node.js dependencies...
cd /d "%ROOT_DIR%\frontend"
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install frontend npm dependencies.
    exit /b 1
)

echo.
echo ==================================================
echo   Installation complete! Run start.bat to launch.
echo ==================================================
endlocal
