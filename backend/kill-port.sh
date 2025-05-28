#!/bin/bash

PORT=$1
if [ -z "$PORT" ]; then
    echo "Usage: $0 <port>"
    exit 1
fi

echo "🔍 Checking port $PORT..."

# Method 1: Kill by process name pattern
if [ "$PORT" = "9000" ]; then
    pkill -f "medusa develop" 2>/dev/null && echo "⚡ Killed medusa develop processes"
elif [ "$PORT" = "8000" ]; then
    pkill -f "next dev" 2>/dev/null && echo "⚡ Killed next dev processes"
fi

# Method 2: Use fuser to kill by port
if command -v fuser >/dev/null 2>&1; then
    fuser -k ${PORT}/tcp 2>/dev/null && echo "⚡ Killed processes using fuser on port $PORT"
fi

# Method 3: Use lsof to find and kill processes
if command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -ti:$PORT 2>/dev/null)
    if [ ! -z "$PIDS" ]; then
        echo "$PIDS" | xargs kill -9 2>/dev/null && echo "⚡ Killed processes using lsof on port $PORT"
    fi
fi

# Method 4: Use netstat and kill (fallback)
if command -v netstat >/dev/null 2>&1; then
    PIDS=$(netstat -tlnp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1 | grep -v '-')
    if [ ! -z "$PIDS" ]; then
        echo "$PIDS" | xargs kill -9 2>/dev/null && echo "⚡ Killed processes using netstat on port $PORT"
    fi
fi

# Wait a moment for processes to die
sleep 2

# Check if port is still in use
if command -v lsof >/dev/null 2>&1; then
    if lsof -ti:$PORT >/dev/null 2>&1; then
        echo "❌ Port $PORT is still in use"
        lsof -i:$PORT
        exit 1
    else
        echo "✅ Port $PORT is now free"
    fi
else
    echo "✅ Port clearing completed"
fi 