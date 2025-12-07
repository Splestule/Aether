#!/bin/bash

# VR Flight Tracker Enhanced Startup Script with Cloudflare Tunnels
# This .command file will execute when double-clicked on macOS
# It automatically starts Cloudflare tunnels, extracts URLs, updates .env files,
# starts all servers, and opens the dashboard and web app in browser

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" || exit 1

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Clear the terminal
clear

# Display header
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🚀 VR Flight Tracker - Enhanced Startup with Cloudflare Tunnels${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}❌ cloudflared is not installed.${NC}"
    echo "   Install it with: brew install cloudflare/cloudflare/cloudflared"
    echo "   Or download from: https://github.com/cloudflare/cloudflared/releases"
    osascript -e 'display dialog "cloudflared is not installed. Please install it first." buttons {"OK"} default button "OK" with icon stop'
    echo ""
    echo "Press any key to close this window..."
    read -n 1
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    echo "   Visit: https://nodejs.org/"
    osascript -e 'display dialog "Node.js is not installed. Please install Node.js 18+ first." buttons {"OK"} default button "OK" with icon stop'
    echo ""
    echo "Press any key to close this window..."
    read -n 1
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18+ is required. Current version: $(node -v)${NC}"
    osascript -e "display dialog \"Node.js version 18+ is required. Current version: $(node -v)\" buttons {\"OK\"} default button \"OK\" with icon stop"
    echo ""
    echo "Press any key to close this window..."
    read -n 1
    exit 1
fi

# Install dependencies if needed
echo -e "${BLUE}📦 Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo "   Installing root dependencies..."
    npm install
fi

if [ ! -d "server/node_modules" ]; then
    echo "   Installing server dependencies..."
    cd server && npm install && cd .. || exit 1
fi

if [ ! -d "client/node_modules" ]; then
    echo "   Installing client dependencies..."
    cd client && npm install && cd .. || exit 1
fi

if [ ! -d "shared/node_modules" ]; then
    echo "   Installing shared dependencies..."
    cd shared && npm install && cd .. || exit 1
fi

# Create .env files if they don't exist
if [ ! -f "server/.env" ]; then
    echo -e "${YELLOW}⚙️  Creating server environment file...${NC}"
    if [ -f "server/env.example" ]; then
        cp server/env.example server/.env
    fi
fi

if [ ! -f "client/.env" ]; then
    echo -e "${YELLOW}⚙️  Creating client environment file...${NC}"
    touch client/.env
fi

# Create log directory if it doesn't exist
mkdir -p logs

# Create PID file for tracking
PID_FILE="$SCRIPT_DIR/.vr-flight-tracker.pids"
echo "" > "$PID_FILE"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping servers and tunnels...${NC}"
    
    # Kill Cloudflare tunnels
    pkill -f "cloudflared tunnel" 2>/dev/null
    
    # Kill processes from PID file if it exists
    if [ -f "$PID_FILE" ]; then
        source "$PID_FILE" 2>/dev/null
        [ ! -z "$SERVER_PID" ] && kill -9 $SERVER_PID 2>/dev/null && pkill -P $SERVER_PID 2>/dev/null
        [ ! -z "$CLIENT_PID" ] && kill -9 $CLIENT_PID 2>/dev/null && pkill -P $CLIENT_PID 2>/dev/null
        [ ! -z "$DASHBOARD_PID" ] && kill -9 $DASHBOARD_PID 2>/dev/null && pkill -P $DASHBOARD_PID 2>/dev/null
        [ ! -z "$BACKEND_TUNNEL_PID" ] && kill -9 $BACKEND_TUNNEL_PID 2>/dev/null
        [ ! -z "$FRONTEND_TUNNEL_PID" ] && kill -9 $FRONTEND_TUNNEL_PID 2>/dev/null
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
    
    echo -e "${GREEN}✅ All processes stopped.${NC}"
    exit 0
}

trap cleanup INT TERM

# Function to extract URL from cloudflared output
extract_tunnel_url() {
    local log_file=$1
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if [ -f "$log_file" ]; then
            # Try to extract URL from log file
            local url=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$log_file" 2>/dev/null | head -1)
            if [ ! -z "$url" ]; then
                echo "$url"
                return 0
            fi
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    
    return 1
}

# Start backend server first (needed for tunnel)
echo -e "${GREEN}📡 Starting backend server on port 8080...${NC}"
cd "$SCRIPT_DIR/server" && npm run dev > "$SCRIPT_DIR/logs/server.log" 2>&1 &
SERVER_PID=$!
echo "SERVER_PID=$SERVER_PID" >> "$PID_FILE"
echo "   Backend server PID: $SERVER_PID"

# Wait for backend to start
sleep 3

# Start backend Cloudflare tunnel
echo -e "${GREEN}🌐 Starting Cloudflare tunnel for backend (port 8080)...${NC}"
BACKEND_TUNNEL_LOG="$SCRIPT_DIR/logs/backend-tunnel.log"
cloudflared tunnel --url http://localhost:8080 > "$BACKEND_TUNNEL_LOG" 2>&1 &
BACKEND_TUNNEL_PID=$!
echo "BACKEND_TUNNEL_PID=$BACKEND_TUNNEL_PID" >> "$PID_FILE"
echo "   Backend tunnel PID: $BACKEND_TUNNEL_PID"

# Wait for backend tunnel URL
echo -e "${YELLOW}   Waiting for backend tunnel URL...${NC}"
BACKEND_URL=$(extract_tunnel_url "$BACKEND_TUNNEL_LOG")
if [ -z "$BACKEND_URL" ]; then
    echo -e "${RED}❌ Failed to get backend tunnel URL after 30 seconds${NC}"
    echo "   Check logs/backend-tunnel.log for details"
    cleanup
    exit 1
fi

echo -e "${GREEN}   ✅ Backend tunnel URL: $BACKEND_URL${NC}"

# Convert http to wss for WebSocket URL
BACKEND_WS_URL=$(echo "$BACKEND_URL" | sed 's|https://|wss://|')

# Start frontend server
echo -e "${GREEN}💻 Starting frontend server on port 3000...${NC}"
cd "$SCRIPT_DIR/client" && npm run dev > "$SCRIPT_DIR/logs/client.log" 2>&1 &
CLIENT_PID=$!
echo "CLIENT_PID=$CLIENT_PID" >> "$PID_FILE"
echo "   Frontend server PID: $CLIENT_PID"

# Wait for frontend to start
sleep 3

# Start frontend Cloudflare tunnel
echo -e "${GREEN}🌐 Starting Cloudflare tunnel for frontend (port 3000)...${NC}"
FRONTEND_TUNNEL_LOG="$SCRIPT_DIR/logs/frontend-tunnel.log"
cloudflared tunnel --url http://localhost:3000 > "$FRONTEND_TUNNEL_LOG" 2>&1 &
FRONTEND_TUNNEL_PID=$!
echo "FRONTEND_TUNNEL_PID=$FRONTEND_TUNNEL_PID" >> "$PID_FILE"
echo "   Frontend tunnel PID: $FRONTEND_TUNNEL_PID"

# Wait for frontend tunnel URL
echo -e "${YELLOW}   Waiting for frontend tunnel URL...${NC}"
FRONTEND_URL=$(extract_tunnel_url "$FRONTEND_TUNNEL_LOG")
if [ -z "$FRONTEND_URL" ]; then
    echo -e "${RED}❌ Failed to get frontend tunnel URL after 30 seconds${NC}"
    echo "   Check logs/frontend-tunnel.log for details"
    cleanup
    exit 1
fi

echo -e "${GREEN}   ✅ Frontend tunnel URL: $FRONTEND_URL${NC}"

# Update client/.env file
echo -e "${BLUE}⚙️  Updating client/.env with tunnel URLs...${NC}"
# Function to update or add an environment variable in a file
update_env_var() {
    local key=$1
    local value=$2
    local file=$3

    # Ensure file exists
    touch "$file"

    if grep -q "^$key=" "$file"; then
        # Key exists, update it using sed (macOS compatible)
        sed -i '' "s|^$key=.*|$key=$value|" "$file"
    else
        # Key doesn't exist, append it
        # Ensure there is a newline before appending if the file is not empty and doesn't end with one
        if [ -s "$file" ] && [ "$(tail -c 1 "$file")" != "" ]; then
            echo "" >> "$file"
        fi
        echo "$key=$value" >> "$file"
    fi
}

echo -e "${BLUE}⚙️  Updating client/.env with tunnel URLs...${NC}"
update_env_var "VITE_API_URL" "$BACKEND_URL" "$SCRIPT_DIR/client/.env"
update_env_var "VITE_WS_URL" "$BACKEND_WS_URL" "$SCRIPT_DIR/client/.env"
echo -e "${GREEN}   ✅ Updated client/.env${NC}"

# Update server/.env file with CORS origin
echo -e "${BLUE}⚙️  Updating server/.env with CORS configuration...${NC}"
# Read existing server/.env and update CORS_ORIGIN
if grep -q "^CORS_ORIGIN=" "$SCRIPT_DIR/server/.env"; then
    # Update existing CORS_ORIGIN line
    sed -i '' "s|^CORS_ORIGIN=.*|CORS_ORIGIN=http://localhost:3000,http://localhost:5173,$FRONTEND_URL|" "$SCRIPT_DIR/server/.env"
else
    # Append CORS_ORIGIN if it doesn't exist
    echo "" >> "$SCRIPT_DIR/server/.env"
    echo "# CORS Configuration (auto-updated by start.command)" >> "$SCRIPT_DIR/server/.env"
    echo "CORS_ORIGIN=http://localhost:3000,http://localhost:5173,$FRONTEND_URL" >> "$SCRIPT_DIR/server/.env"
fi
echo -e "${GREEN}   ✅ Updated server/.env CORS_ORIGIN${NC}"

# Start dashboard server
echo -e "${GREEN}📊 Starting dashboard server on port 8081...${NC}"
cd "$SCRIPT_DIR" && node dashboard-server.js > "$SCRIPT_DIR/logs/dashboard.log" 2>&1 &
DASHBOARD_PID=$!
echo "DASHBOARD_PID=$DASHBOARD_PID" >> "$PID_FILE"
echo "   Dashboard server PID: $DASHBOARD_PID"

# Wait a moment for everything to stabilize
sleep 2

# Open dashboard in browser
echo -e "${GREEN}🌐 Opening dashboard in browser...${NC}"
open "http://localhost:8081" 2>/dev/null || osascript -e 'tell application "Safari" to open location "http://localhost:8081"'

# Wait a moment before opening frontend
sleep 1

# Open frontend web app in browser
echo -e "${GREEN}🌐 Opening web application in browser...${NC}"
open "$FRONTEND_URL" 2>/dev/null || osascript -e "tell application \"Safari\" to open location \"$FRONTEND_URL\""

# Open Terminal window with tabs using AppleScript
echo -e "${GREEN}📺 Opening monitoring terminal windows...${NC}"
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
    
    -- Create third tab (Backend Tunnel Logs)
    tell application "System Events" to keystroke "t" using command down
    delay 0.5
    do script "cd '$SCRIPT_DIR' && echo '🌐 Backend Tunnel Logs' && echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' && tail -f logs/backend-tunnel.log" in front window
    set backendTunnelTab to front window's active tab
    set custom title of backendTunnelTab to "Backend Tunnel"
    
    delay 0.5
    
    -- Create fourth tab (Frontend Tunnel Logs)
    tell application "System Events" to keystroke "t" using command down
    delay 0.5
    do script "cd '$SCRIPT_DIR' && echo '🌐 Frontend Tunnel Logs' && echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' && tail -f logs/frontend-tunnel.log" in front window
    set frontendTunnelTab to front window's active tab
    set custom title of frontendTunnelTab to "Frontend Tunnel"
    
    delay 0.5
    
    -- Create fifth tab (Stats Monitor)
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
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ All services started successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📊 Access Points:${NC}"
echo -e "   ${GREEN}Dashboard:${NC} http://localhost:8081"
echo -e "   ${GREEN}Frontend (Local):${NC} http://localhost:3000 (or http://localhost:5173)"
echo -e "   ${GREEN}Frontend (Tunnel):${NC} $FRONTEND_URL"
echo -e "   ${GREEN}Backend (Local):${NC} http://localhost:8080"
echo -e "   ${GREEN}Backend (Tunnel):${NC} $BACKEND_URL"
echo ""
echo -e "${BLUE}📝 Environment Files Updated:${NC}"
echo -e "   ${GREEN}client/.env:${NC} VITE_API_URL=$BACKEND_URL"
echo -e "   ${GREEN}client/.env:${NC} VITE_WS_URL=$BACKEND_WS_URL"
echo -e "   ${GREEN}server/.env:${NC} CORS_ORIGIN updated with $FRONTEND_URL"
echo ""
echo -e "${BLUE}📋 Log Files:${NC}"
echo "   - Server: logs/server.log"
echo "   - Client: logs/client.log"
echo "   - Dashboard: logs/dashboard.log"
echo "   - Backend Tunnel: logs/backend-tunnel.log"
echo "   - Frontend Tunnel: logs/frontend-tunnel.log"
echo ""
echo -e "${RED}🛑 To stop all servers and tunnels, press Ctrl+C in this window${NC}"
echo ""

# Keep script running and wait for servers
wait $SERVER_PID $CLIENT_PID $DASHBOARD_PID $BACKEND_TUNNEL_PID $FRONTEND_TUNNEL_PID
