#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================="
echo "  Robotic Arm Controller - Install Utility (Linux)"
echo "=================================================="
echo

if ! command -v python3 >/dev/null 2>&1; then
  echo "[ERROR] python3 is not installed or not in PATH."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm is not installed or not in PATH."
  exit 1
fi

echo "[1/2] Setting up Python backend virtual environment and dependencies..."
cd "$ROOT_DIR/backend"
if [ ! -x ".venv/bin/python" ]; then
  python3 -m venv .venv
fi
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt

echo
echo "[2/2] Installing frontend Node.js dependencies..."
cd "$ROOT_DIR/frontend"
npm install

echo
echo "=================================================="
echo "  Installation complete! Run ./start.sh to launch."
echo "=================================================="
