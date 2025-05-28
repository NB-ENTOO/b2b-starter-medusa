#!/bin/bash

echo "Checking development ports..."
echo ""

# Check port 9000 (Backend)
echo "Backend Port 9000:"
if lsof -i:9000 >/dev/null 2>&1; then
    echo "OCCUPIED - Port 9000 is in use:"
    lsof -i:9000
else
    echo "FREE - Port 9000 is available"
fi
echo ""

# Check port 8000 (Storefront)
echo "Storefront Port 8000:"
if lsof -i:8000 >/dev/null 2>&1; then
    echo "OCCUPIED - Port 8000 is in use:"
    lsof -i:8000
else
    echo "FREE - Port 8000 is available"
fi
echo ""

# Show all Node.js processes
echo "Active Node.js processes:"
ps aux | grep -E "(node|medusa|next)" | grep -v grep || echo "No Node.js processes found"
echo ""

# Show all processes using development ports
echo "Processes on development ports:"
lsof -i:8000,9000 2>/dev/null || echo "No processes found on ports 8000 or 9000" 