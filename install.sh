#!/bin/bash

set -e

# Get the absolute path to the directory containing the script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# --- Select and prepare the correct binary ---
OS_NAME=$(uname -s)
case "$OS_NAME" in
  Darwin)
    SOURCE_BINARY="$DIR/native-host/app.mac"
    TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    ;;
  Linux)
    SOURCE_BINARY="$DIR/native-host/app.linux"
    TARGET_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    ;;
  *)
    echo "Unsupported OS: $OS_NAME. This script only supports macOS and Linux." >&2
    exit 1
    ;;
esac

if [ ! -f "$SOURCE_BINARY" ]; then
  echo "Error: The required binary for your OS was not found at $SOURCE_BINARY" >&2
  exit 1
fi

DEST_BINARY="$DIR/native-host/app"
cp "$SOURCE_BINARY" "$DEST_BINARY"
chmod +x "$DEST_BINARY"
# --- End of selection ---

# Prompt for the extension ID
echo "Please go to your browser's extensions page (e.g., chrome://extensions) to find your extension's ID."
read -p "Paste the extension ID here: " EXTENSION_ID

# Ensure the target directory exists
mkdir -p "$TARGET_DIR"

HOST_NAME="com.twio142.extension_manager"

# Path to the final manifest file
MANIFEST_PATH="$TARGET_DIR/$HOST_NAME.json"

# Create the manifest file directly in the target directory
cat << EOF > "$MANIFEST_PATH"
{
  "name": "$HOST_NAME",
  "description": "Native host for Extension Manager to open URLs",
  "path": "$DEST_BINARY",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo
echo "Success! The native messaging host has been installed."
echo "Please restart your browser for the changes to take effect."
