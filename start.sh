#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Makan — Saudi Property Aggregator"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Backend ──────────────────────────────────
cd "$PROJECT_DIR/backend"

if [ ! -d ".venv" ]; then
  echo "[backend] Creating virtual environment…"
  python3 -m venv .venv
fi

echo "[backend] Installing dependencies…"
.venv/bin/pip install -q -r requirements.txt

echo "[backend] Starting FastAPI on :8000…"
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "[backend] PID: $BACKEND_PID"

# ── Frontend ─────────────────────────────────
cd "$PROJECT_DIR/frontend"

if [ ! -d "node_modules" ]; then
  echo "[frontend] Installing npm packages…"
  npm install
fi

echo "[frontend] Starting React dev server on :3000…"
BROWSER=none npm start &
FRONTEND_PID=$!
echo "[frontend] PID: $FRONTEND_PID"

# ── Cleanup on exit ───────────────────────────
cleanup() {
  echo ""
  echo "[*] Shutting down…"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo ""
echo "  Backend  → http://localhost:8000/docs"
echo "  Frontend → http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

wait
