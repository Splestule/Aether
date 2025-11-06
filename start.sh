#!/bin/bash

# VR Flight Tracker Startup Script
# This script starts both the backend and frontend servers
# and opens a Terminal window with tabs for monitoring

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" || exit 1

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    osascript -e 'display dialog "Node.js is not installed. Please install Node.js 18+ first." buttons {"OK"} default button "OK" with icon stop'
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    osascript -e "display dialog \"Node.js version 18+ is required. Current version: $(node -v)\" buttons {\"OK\"} default button \"OK\" with icon stop"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing root dependencies..."
    npm install
fi

if [ ! -d "server/node_modules" ]; then
    echo "📦 Installing server dependencies..."
    cd server && npm install && cd .. || exit 1
fi

if [ ! -d "client/node_modules" ]; then
    echo "📦 Installing client dependencies..."
    cd client && npm install && cd .. || exit 1
fi

if [ ! -d "shared/node_modules" ]; then
    echo "📦 Installing shared dependencies..."
    cd shared && npm install && cd .. || exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f "server/.env" ]; then
    echo "⚙️ Creating server environment file..."
    if [ -f "server/env.example" ]; then
        cp server/env.example server/.env
    fi
fi

# Create log directory if it doesn't exist
mkdir -p logs

# Create PID file for tracking
PID_FILE="$SCRIPT_DIR/.vr-flight-tracker.pids"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    
    # Kill processes from PID file if it exists
    if [ -f "$PID_FILE" ]; then
        source "$PID_FILE" 2>/dev/null
        [ ! -z "$SERVER_PID" ] && kill -9 $SERVER_PID 2>/dev/null && pkill -P $SERVER_PID 2>/dev/null
        [ ! -z "$CLIENT_PID" ] && kill -9 $CLIENT_PID 2>/dev/null && pkill -P $CLIENT_PID 2>/dev/null
        [ ! -z "$DASHBOARD_PID" ] && kill -9 $DASHBOARD_PID 2>/dev/null && pkill -P $DASHBOARD_PID 2>/dev/null
    fi
    
    # Fallback: kill by port
    lsof -ti:8080 | xargs kill -9 2>/dev/null
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    lsof -ti:8081 | xargs kill -9 2>/dev/null
    
    # Kill by process name
    pkill -9 -f "tsx watch src/index.ts" 2>/dev/null
    pkill -9 -f "vite" 2>/dev/null
    pkill -9 -f "monitor.sh" 2>/dev/null
    pkill -9 -f "dashboard-server.js" 2>/dev/null
    
    # Clean up PID file
    rm -f "$PID_FILE" 2>/dev/null
    
    echo "✅ Servers stopped."
    exit 0
}

trap cleanup INT TERM

# Create PID file for tracking
PID_FILE="$SCRIPT_DIR/.vr-flight-tracker.pids"
echo "" > "$PID_FILE"

# Start server in background
echo "🚀 Starting backend server..."
cd "$SCRIPT_DIR/server" && npm run dev > "$SCRIPT_DIR/logs/server.log" 2>&1 &
SERVER_PID=$!
echo "SERVER_PID=$SERVER_PID" >> "$PID_FILE"
echo "SERVER_PPID=$$" >> "$PID_FILE"

# Start client in background
echo "🚀 Starting frontend client..."
cd "$SCRIPT_DIR/client" && npm run dev > "$SCRIPT_DIR/logs/client.log" 2>&1 &
CLIENT_PID=$!
echo "CLIENT_PID=$CLIENT_PID" >> "$PID_FILE"
echo "CLIENT_PPID=$$" >> "$PID_FILE"

# Start dashboard server in background
echo "🚀 Starting dashboard server..."
cd "$SCRIPT_DIR" && node dashboard-server.js > "$SCRIPT_DIR/logs/dashboard.log" 2>&1 &
DASHBOARD_PID=$!
echo "DASHBOARD_PID=$DASHBOARD_PID" >> "$PID_FILE"
echo "DASHBOARD_PPID=$$" >> "$PID_FILE"
echo "MAIN_PID=$$" >> "$PID_FILE"

# Wait a moment for servers to start
sleep 3

# Open dashboard in browser
echo "🌐 Opening dashboard in browser..."
open "http://localhost:8081" 2>/dev/null || osascript -e 'tell application "Safari" to open location "http://localhost:8081"'

# Open Terminal window with tabs using AppleScript
osascript <<EOF
tell application "Terminal"
    activate
    
    -- Create new window with first tab (Server Logs)
    set serverTab to do script "cd '$SCRIPT_DIR' && echo '📡 Backend Server Logs (Port 8080)' && echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' && tail -f logs/server.log"
    set custom title of serverTab to "Server Logs"
    
    delay 0.5
    
    -- Create second tab (Client Logs)
    tell application "System Events" to keystroke "t" using command down
    delay 0.5
    do script "cd '$SCRIPT_DIR' && echo '💻 Frontend Client Logs (Port 3000/5173)' && echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' && tail -f logs/client.log" in front window
    set clientTab to front window's active tab
    set custom title of clientTab to "Client Logs"
    
    delay 0.5
    
    -- Create third tab (Stats Monitor)
    tell application "System Events" to keystroke "t" using command down
    delay 0.5
    do script "cd '$SCRIPT_DIR' && ./monitor.sh" in front window
    set monitorTab to front window's active tab
    set custom title of monitorTab to "Stats Monitor"
    
    -- Go back to first tab
    tell application "System Events" to keystroke "1" using command down
end tell
EOF

echo ""
echo "✅ Servers started!"
echo ""
echo "📊 Dashboard opened in browser: http://localhost:8081"
echo ""
echo "🌐 Access the app at:"
echo "   - Frontend: http://localhost:3000 (or http://localhost:5173)"
echo "   - Backend:  http://localhost:8080"
echo "   - Dashboard: http://localhost:8081"
echo ""
echo "📝 Log files:"
echo "   - Server: logs/server.log"
echo "   - Client: logs/client.log"
echo "   - Dashboard: logs/dashboard.log"
echo ""
echo "🛑 To stop servers, press Ctrl+C in this window"
echo ""

# Keep script running and wait for servers
wait $SERVER_PID $CLIENT_PID $DASHBOARD_PID
