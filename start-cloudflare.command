#!/bin/bash

# Cloudflare Tunnel Startup Script for VR Flight Tracker
# Double-click this file in Finder to start servers and Cloudflare tunnels

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" || {
    echo "❌ Error: Could not change to script directory: $SCRIPT_DIR"
    echo "Press any key to close this window..."
    read -n 1
    exit 1
}

# Clear the terminal
clear

# Display header
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 VR Flight Tracker - Cloudflare Tunnel Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Make sure the shell script is executable
chmod +x start-cloudflare.sh

# Check if the script exists
if [ ! -f "start-cloudflare.sh" ]; then
    echo "❌ Error: start-cloudflare.sh not found in: $SCRIPT_DIR"
    echo ""
    echo "Press any key to close this window..."
    read -n 1
    exit 1
fi

# Run the startup script
./start-cloudflare.sh

# Keep terminal open if script exits (in case of error)
if [ $? -ne 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Script exited with an error. Press any key to close this window..."
    read -n 1
fi
