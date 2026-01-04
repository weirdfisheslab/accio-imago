#!/bin/bash

# Script to create a zip file of the Chrome extension
# Excludes README.md and agent.md files

ZIP_NAME="accio-imago-extension.zip"
EXTENSION_DIR="extension"

echo "Creating Chrome extension zip: ${ZIP_NAME}"

# Remove existing zip if it exists
if [ -f "${ZIP_NAME}" ]; then
    echo "Removing existing zip file..."
    rm "${ZIP_NAME}"
fi

# Create zip file from the extension directory
zip -j "${ZIP_NAME}" \
    "${EXTENSION_DIR}/content.js" \
    "${EXTENSION_DIR}/manifest.json" \
    "${EXTENSION_DIR}/popup.html" \
    "${EXTENSION_DIR}/popup.js" \
    "${EXTENSION_DIR}/sw.js" \
    "${EXTENSION_DIR}/icons/icon-16.png" \
    "${EXTENSION_DIR}/icons/icon-32.png" \
    "${EXTENSION_DIR}/icons/icon-48.png" \
    "${EXTENSION_DIR}/icons/icon-128.png"

echo "✅ Extension zip created successfully: ${ZIP_NAME}"
echo "📦 Files included:"
zipinfo -1 "${ZIP_NAME}" | sed 's/^/   - /'
