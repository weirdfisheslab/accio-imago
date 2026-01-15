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

# Create zip file from the extension directory (preserve paths)
(cd "${EXTENSION_DIR}" && zip -r "../${ZIP_NAME}" \
    "content.js" \
    "manifest.json" \
    "popup.html" \
    "popup.js" \
    "sw.js" \
    "logo.png" \
    "icons")

echo "✅ Extension zip created successfully: ${ZIP_NAME}"
echo "📦 Files included:"
zipinfo -1 "${ZIP_NAME}" | sed 's/^/   - /'
