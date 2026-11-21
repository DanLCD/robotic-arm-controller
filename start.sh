#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -x "$ROOT_DIR/backend/.venv/bin/uvicorn" ]; then
  echo "[ERROR] Backend virtual environment not found. Please run ./install.sh first."
  exit 1
fi

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
  echo "[ERROR] Frontend node_modules not found. Please run ./install.sh first."
  exit 1
fi

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo
  echo "Stopping Robotic Arm Controller..."
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}

trap cleanup INT TERM EXIT

echo "Starting Robotic Arm Controller..."
echo "  Backend : http://127.0.0.1:8000"
echo "  Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both services."
echo

(
  cd "$ROOT_DIR/backend"
  exec .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
) &
BACKEND_PID=$!

(
  cd "$ROOT_DIR/frontend"
  exec npm run dev
) &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
