#!/usr/bin/env bash
# ==============================================================================
# CLASH: Cyber Arena - Startup Launcher
# Starts Python Tactical AI Engine (port 8000) and Node.js Server (port 3000)
# ==============================================================================

echo "========================================================"
echo "⚡  LAUNCHING CLASH: CYBER ARENA"
echo "    Stack: Node.js + React + Python + HTML5 + CSS3 + JS"
echo "========================================================"

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 is not installed or not in PATH."
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: node is not installed or not in PATH."
    exit 1
fi

# Cleanup child processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down CLASH servers..."
    kill $PY_PID $NODE_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Start Python Tactical AI Engine
echo "🤖 Starting Python Tactical AI Engine on port 8000..."
python3 ai_service/ai_engine.py 8000 &
PY_PID=$!

# Wait briefly for Python to bind
sleep 1

# 2. Start Node.js Game Server & Web Host
echo "🌐 Starting Node.js Game Server on port 3000..."
node server/server.js &
NODE_PID=$!

sleep 1

echo ""
echo "========================================================"
echo "🎮 CLASH: Cyber Arena is READY!"
echo "👉 Open your browser at: http://localhost:3000"
echo "========================================================"
echo "Press Ctrl+C to stop both servers."

wait $NODE_PID $PY_PID
