#!/bin/bash

# VR Flight Tracker Startup Script
# This .command file will execute when double-clicked on macOS

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" || exit 1

# Execute the main start script
exec "$SCRIPT_DIR/start.sh"

