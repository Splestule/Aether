#!/bin/bash

# Script to create a macOS app bundle with icon for VR Flight Tracker
# This will create VR Flight Tracker.app that can be placed in the Dock

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" || exit 1

APP_NAME="VR Flight Tracker"
APP_DIR="$SCRIPT_DIR/$APP_NAME.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
ICONSET_DIR="$RESOURCES_DIR/$APP_NAME.iconset"

LOGO_SOURCE="$SCRIPT_DIR/client/public/aether-logo.png"

echo "🚀 Creating macOS app bundle: $APP_NAME.app"
echo ""

# Remove existing app if it exists
if [ -d "$APP_DIR" ]; then
    echo "📦 Removing existing app bundle..."
    rm -rf "$APP_DIR"
fi

# Create app bundle structure
echo "📁 Creating app bundle structure..."
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"
mkdir -p "$ICONSET_DIR"

# Check if logo exists
if [ ! -f "$LOGO_SOURCE" ]; then
    echo "❌ Logo file not found: $LOGO_SOURCE"
    echo "   Please ensure the logo file exists."
    exit 1
fi

# Create icon set from logo
echo "🎨 Creating app icon from logo..."
if command -v sips &> /dev/null; then
    # Use sips (built into macOS) to create icon set
    sips -z 16 16 "$LOGO_SOURCE" --out "$ICONSET_DIR/icon_16x16.png" > /dev/null 2>&1
    sips -z 32 32 "$LOGO_SOURCE" --out "$ICONSET_DIR/icon_16x16@2x.png" > /dev/null 2>&1
    sips -z 32 32 "$LOGO_SOURCE" --out "$ICONSET_DIR/icon_32x32.png" > /dev/null 2>&1
    sips -z 64 64 "$LOGO_SOURCE" --out "$ICONSET_DIR/icon_32x32@2x.png" > /dev/null 2>&1
    sips -z 128 128 "$LOGO_SOURCE" --out "$ICONSET_DIR/icon_128x128.png" > /dev/null 2>&1
    sips -z 256 256 "$LOGO_SOURCE" --out "$ICONSET_DIR/icon_128x128@2x.png" > /dev/null 2>&1
    sips -z 256 256 "$LOGO_SOURCE" --out "$ICONSET_DIR/icon_256x256.png" > /dev/null 2>&1
    sips -z 512 512 "$LOGO_SOURCE" --out "$ICONSET_DIR/icon_256x256@2x.png" > /dev/null 2>&1
    sips -z 512 512 "$LOGO_SOURCE" --out "$ICONSET_DIR/icon_512x512.png" > /dev/null 2>&1
    sips -z 1024 1024 "$LOGO_SOURCE" --out "$ICONSET_DIR/icon_512x512@2x.png" > /dev/null 2>&1
    
    # Convert iconset to icns
    if command -v iconutil &> /dev/null; then
        iconutil -c icns "$ICONSET_DIR" -o "$RESOURCES_DIR/$APP_NAME.icns"
        rm -rf "$ICONSET_DIR"
        echo "   ✅ Icon created successfully"
    else
        echo "   ⚠️  iconutil not found, using PNG directly"
        cp "$LOGO_SOURCE" "$RESOURCES_DIR/appicon.png"
    fi
else
    echo "   ⚠️  sips not found, copying logo as icon"
    cp "$LOGO_SOURCE" "$RESOURCES_DIR/appicon.png"
fi

# Create the executable script
echo "📝 Creating app executable..."
cat > "$MACOS_DIR/$APP_NAME" << 'APPSCRIPT'
#!/bin/bash

# Get the directory where the app bundle is located
APP_DIR="$( cd "$( dirname "$( dirname "$( dirname "$( dirname "${BASH_SOURCE[0]}" )" )" )" )" && pwd )"
cd "$APP_DIR" || exit 1

# Execute the start.command script
exec "$APP_DIR/start.command"
APPSCRIPT

chmod +x "$MACOS_DIR/$APP_NAME"

# Create Info.plist
echo "📋 Creating Info.plist..."
cat > "$CONTENTS_DIR/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundleIconFile</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>com.vrflighttracker.app</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
EOF

echo ""
echo "✅ App bundle created successfully!"
echo ""
echo "📦 App location: $APP_DIR"
echo ""
echo "📌 To add to Dock:"
echo "   1. Open Finder"
echo "   2. Navigate to: $SCRIPT_DIR"
echo "   3. Drag '$APP_NAME.app' to your Dock"
echo ""
echo "🎯 You can now double-click the app or use it from the Dock!"







