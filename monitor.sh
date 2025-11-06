#!/bin/bash

# VR Flight Tracker Stats Monitor
# Displays real-time stats about the running application

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" || exit 1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

clear
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     VR Flight Tracker - System Monitor                   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

while true; do
    # Get terminal dimensions
    COLS=$(tput cols)
    
    # Server Status (Port 8080)
    SERVER_PID=$(lsof -ti:8080 2>/dev/null)
    if [ -n "$SERVER_PID" ]; then
        SERVER_STATUS="${GREEN}● RUNNING${NC}"
        SERVER_MEM=$(ps -o rss= -p "$SERVER_PID" 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')
        if [ -z "$SERVER_MEM" ]; then
            SERVER_MEM="N/A"
        fi
    else
        SERVER_STATUS="${RED}● STOPPED${NC}"
        SERVER_MEM="N/A"
    fi
    
    # Client Status (Port 3000 or 5173)
    CLIENT_PID=$(lsof -ti:3000,5173 2>/dev/null | head -1)
    if [ -n "$CLIENT_PID" ]; then
        CLIENT_STATUS="${GREEN}● RUNNING${NC}"
        CLIENT_PORT=$(lsof -ti:3000 2>/dev/null > /dev/null && echo "3000" || echo "5173")
        CLIENT_MEM=$(ps -o rss= -p "$CLIENT_PID" 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')
        if [ -z "$CLIENT_MEM" ]; then
            CLIENT_MEM="N/A"
        fi
    else
        CLIENT_STATUS="${RED}● STOPPED${NC}"
        CLIENT_PORT="N/A"
        CLIENT_MEM="N/A"
    fi
    
    # Check if services are responding
    if curl -s --max-time 2 http://localhost:8080/api/cache/stats > /dev/null 2>&1; then
        API_STATUS="${GREEN}● RESPONDING${NC}"
        # Try to get cache stats
        CACHE_STATS=$(curl -s --max-time 2 http://localhost:8080/api/cache/stats 2>/dev/null)
        if [ -n "$CACHE_STATS" ] && echo "$CACHE_STATS" | grep -q "size"; then
            CACHE_SIZE=$(echo "$CACHE_STATS" | grep -o '"size":[0-9]*' | cut -d':' -f2 || echo "0")
            CACHE_HITS=$(echo "$CACHE_STATS" | grep -o '"hits":[0-9]*' | cut -d':' -f2 || echo "0")
            CACHE_MISSES=$(echo "$CACHE_STATS" | grep -o '"misses":[0-9]*' | cut -d':' -f2 || echo "0")
        else
            CACHE_SIZE="0"
            CACHE_HITS="0"
            CACHE_MISSES="0"
        fi
    else
        API_STATUS="${RED}● NOT RESPONDING${NC}"
        CACHE_SIZE="N/A"
        CACHE_HITS="N/A"
        CACHE_MISSES="N/A"
    fi
    
    # System stats
    CPU_USAGE=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//' || echo "0")
    MEM_TOTAL=$(sysctl -n hw.memsize 2>/dev/null | awk '{printf "%.1f GB", $1/1024/1024/1024}' || echo "N/A")
    MEM_USED=$(vm_stat 2>/dev/null | grep "Pages active" | awk '{print $3}' | sed 's/\.//' | awk '{printf "%.1f GB", ($1*4096)/1024/1024/1024}' || echo "N/A")
    
    # Node processes
    NODE_COUNT=$(pgrep -c node 2>/dev/null || echo "0")
    
    # Clear screen and print stats
    clear
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     VR Flight Tracker - System Monitor                   ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Service Status${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    printf "Backend Server (Port 8080):  %-20s Memory: %s\n" "$SERVER_STATUS" "$SERVER_MEM"
    printf "Frontend Client (Port %-4s):  %-20s Memory: %s\n" "$CLIENT_PORT" "$CLIENT_STATUS" "$CLIENT_MEM"
    printf "API Endpoint:                %-20s\n" "$API_STATUS"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Cache Statistics${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    printf "Cache Size:    %s entries\n" "$CACHE_SIZE"
    printf "Cache Hits:    %s\n" "$CACHE_HITS"
    printf "Cache Misses:  %s\n" "$CACHE_MISSES"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}System Resources${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    printf "CPU Usage:     %s%%\n" "$CPU_USAGE"
    printf "Memory Total:  %s\n" "$MEM_TOTAL"
    printf "Memory Used:   %s\n" "$MEM_USED"
    printf "Node Processes: %s\n" "$NODE_COUNT"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Last Updated: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${YELLOW}Press Ctrl+C to exit monitor${NC}"
    
    sleep 2
done

