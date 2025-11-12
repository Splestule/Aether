#!/bin/bash
# Script to zoom in on the favicon by scaling up and center-cropping

cd "$(dirname "$0")"

# Check if backup exists, if not create one
if [ ! -f "aether-favicon-original-backup.png" ]; then
    echo "Creating backup of current favicon..."
    cp aether-favicon.png aether-favicon-original-backup.png
fi

# Get current dimensions
WIDTH=$(sips -g pixelWidth aether-favicon-original-backup.png | grep pixelWidth | cut -d: -f2 | tr -d ' ')
HEIGHT=$(sips -g pixelHeight aether-favicon-original-backup.png | grep pixelHeight | cut -d: -f2 | tr -d ' ')

echo "Original dimensions: ${WIDTH}x${HEIGHT}"

# Scale up by 2.5x for better zoom
SCALE_FACTOR=2.5
NEW_SIZE=$(echo "$WIDTH * $SCALE_FACTOR" | bc | cut -d. -f1)

echo "Scaling up to: ${NEW_SIZE}x${NEW_SIZE} for zoom effect..."

# Scale up (maintaining aspect if not square)
if [ "$WIDTH" -eq "$HEIGHT" ]; then
    # Square image - scale directly
    sips -Z $NEW_SIZE aether-favicon-original-backup.png --out aether-favicon-zoomed.png
else
    # Non-square - scale to larger dimension, then crop center
    sips --resampleHeightWidthMax $NEW_SIZE aether-favicon-original-backup.png --out aether-favicon-zoomed.png
fi

# Crop center portion (60% of scaled size for more zoom)
CROP_SIZE=$(echo "$NEW_SIZE * 0.6" | bc | cut -d. -f1)
echo "Cropping center ${CROP_SIZE}x${CROP_SIZE} portion..."

# Extract center crop - sips crops from top-left, so we need to calculate offset
# For center crop: offset = (scaled_size - crop_size) / 2
# But sips doesn't support offset easily, so we'll use a workaround
# Scale to final size with crop
sips -c $CROP_SIZE $CROP_SIZE aether-favicon-zoomed.png --out aether-favicon.png

# Final resize to 512x512 for favicon
echo "Final size: 512x512"
sips -Z 512 aether-favicon.png --out aether-favicon.png

# Cleanup
rm -f aether-favicon-zoomed.png

echo "✅ Favicon zoomed and saved as 512x512"
sips -g pixelWidth -g pixelHeight aether-favicon.png | grep -E "pixelWidth|pixelHeight"

