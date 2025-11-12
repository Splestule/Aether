#!/bin/bash

# Cloudflare Tunnel Startup Script for VR Flight Tracker
# This script starts both servers and Cloudflare tunnels

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" || exit 1

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting VR Flight Tracker with Cloudflare Tunnels${NC}"
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}❌ cloudflared is not installed.${NC}"
    echo "   Install it with: brew install cloudflare/cloudflare/cloudflared"
    echo "   Or download from: https://github.com/cloudflare/cloudflared/releases"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed.${NC}"
    exit 1
fi

# Check if .env file exists for client
if [ ! -f "client/.env" ]; then
    echo -e "${YELLOW}⚠️  client/.env file not found.${NC}"
    echo "   Creating client/.env.example for reference..."
    cat > client/.env.example << EOF
# Cloudflare Tunnel URLs (replace with your actual tunnel URLs)
# Get these URLs by running: cloudflared tunnel --url http://localhost:8080
VITE_API_URL=https://your-backend-tunnel-url.trycloudflare.com
VITE_WS_URL=wss://your-backend-tunnel-url.trycloudflare.com
EOF
    echo -e "${YELLOW}   Please create client/.env with your Cloudflare tunnel URLs${NC}"
    echo -e "${YELLOW}   See CLOUDFLARE_SETUP.md for instructions${NC}"
    echo ""
fi

# Create log directory if it doesn't exist
mkdir -p logs

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping servers and tunnels...${NC}"
    
    # Kill Cloudflare tunnels
    pkill -f "cloudflared tunnel" 2>/dev/null
    
    # Kill Node processes
    lsof -ti:8080 | xargs kill -9 2>/dev/null
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    
    # Kill by process name
    pkill -9 -f "tsx watch src/index.ts" 2>/dev/null
    pkill -9 -f "vite" 2>/dev/null
    
    echo -e "${GREEN}✅ All processes stopped.${NC}"
    exit 0
}

trap cleanup INT TERM

# Start backend server
echo -e "${GREEN}📡 Starting backend server on port 8080...${NC}"
cd "$SCRIPT_DIR/server" && npm run dev > "$SCRIPT_DIR/logs/server.log" 2>&1 &
SERVER_PID=$!
echo "   Backend server PID: $SERVER_PID"

# Wait for backend to start
sleep 2

# Start frontend server
echo -e "${GREEN}💻 Starting frontend server on port 3000...${NC}"
cd "$SCRIPT_DIR/client" && npm run dev > "$SCRIPT_DIR/logs/client.log" 2>&1 &
CLIENT_PID=$!
echo "   Frontend server PID: $CLIENT_PID"

# Wait for frontend to start
sleep 3

# Start backend Cloudflare tunnel
echo -e "${GREEN}🌐 Starting Cloudflare tunnel for backend (port 8080)...${NC}"
echo -e "${YELLOW}   Copy the URL that appears below!${NC}"
cloudflared tunnel --url http://localhost:8080 > "$SCRIPT_DIR/logs/backend-tunnel.log" 2>&1 &
BACKEND_TUNNEL_PID=$!
echo "   Backend tunnel PID: $BACKEND_TUNNEL_PID"

# Wait a moment for tunnel to initialize
sleep 3

# Extract backend tunnel URL from logs (if available)
if [ -f "$SCRIPT_DIR/logs/backend-tunnel.log" ]; then
    BACKEND_URL=$(grep -o 'https://[^ ]*\.trycloudflare\.com' "$SCRIPT_DIR/logs/backend-tunnel.log" | head -1)
    if [ ! -z "$BACKEND_URL" ]; then
        echo -e "${GREEN}   Backend tunnel URL: $BACKEND_URL${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANT: Update your client/.env file with:${NC}"
        echo -e "${YELLOW}   VITE_API_URL=$BACKEND_URL${NC}"
        echo -e "${YELLOW}   VITE_WS_URL=${BACKEND_URL/http:/wss:}${NC}"
        echo -e "${YELLOW}   (replace http:// with wss:// for WebSocket)${NC}"
        echo ""
    fi
fi

# Start frontend Cloudflare tunnel
echo -e "${GREEN}🌐 Starting Cloudflare tunnel for frontend (port 3000)...${NC}"
echo -e "${YELLOW}   Copy the URL that appears below!${NC}"
cloudflared tunnel --url http://localhost:3000 > "$SCRIPT_DIR/logs/frontend-tunnel.log" 2>&1 &
FRONTEND_TUNNEL_PID=$!
echo "   Frontend tunnel PID: $FRONTEND_TUNNEL_PID"

# Wait a moment for tunnel to initialize
sleep 3

# Extract frontend tunnel URL from logs (if available)
if [ -f "$SCRIPT_DIR/logs/frontend-tunnel.log" ]; then
    FRONTEND_URL=$(grep -o 'https://[^ ]*\.trycloudflare\.com' "$SCRIPT_DIR/logs/frontend-tunnel.log" | head -1)
    if [ ! -z "$FRONTEND_URL" ]; then
        echo -e "${GREEN}   Frontend tunnel URL: $FRONTEND_URL${NC}"
        echo ""
    fi
fi

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo -e "${GREEN}📊 Status:${NC}"
echo "   Backend server: http://localhost:8080"
echo "   Frontend server: http://localhost:3000"
echo "   Backend tunnel: Check logs/backend-tunnel.log for URL"
echo "   Frontend tunnel: Check logs/frontend-tunnel.log for URL"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "   1. Check the tunnel logs for your Cloudflare URLs"
echo "   2. Update client/.env with VITE_API_URL and VITE_WS_URL"
echo "   3. Restart the frontend server after updating .env"
echo "   4. Access your app using the frontend tunnel URL"
echo ""
echo -e "${YELLOW}📋 Log files:${NC}"
echo "   - Backend: logs/server.log"
echo "   - Frontend: logs/client.log"
echo "   - Backend tunnel: logs/backend-tunnel.log"
echo "   - Frontend tunnel: logs/frontend-tunnel.log"
echo ""
echo -e "${RED}🛑 Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for user interrupt
wait

