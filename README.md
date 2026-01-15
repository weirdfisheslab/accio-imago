# Accio Imago 🖼️

A Chrome Extension to download high-quality images from Google Slides with ease.

## Features

- **Google Slides only**: Works exclusively on Google Slides presentations
- **Smart image detection**: Automatically detects SVG image elements used by Google Slides
- **One-click download**: Hover over images and click to download high-quality deeplinks
- **GIF support**: Downloads GIFs and animated images, unlike other extensions that only handle static images
- **Persistent stop button**: Always visible so you can stop at any time
- **Clean workflow**: Automatically injects and cleans up when done

## Installation

You can install Accio Imago in two ways:

### Option 1: Install from Chrome Web Store (Recommended)

1. Visit the [Chrome Web Store page](https://chromewebstore.google.com/detail/accio-imago-download-imag/geiiegcdagboeemhdlombhmapghbfbce)
2. Click **"Add to Chrome"**
3. Confirm the installation in the popup dialog
4. The extension will be automatically installed and ready to use

### Option 2: Install from Zip File (Manual Installation)

1. Download the `accio-imago-extension.zip` file from this repository
2. Extract the zip file to a folder on your computer
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable **Developer mode** (toggle in the top right corner)
5. Click **"Load unpacked"** button
6. Select the extracted folder (the folder containing `manifest.json`, `popup.html`, etc.)
7. The "Accio Imago - Download images from Google Slides" extension should now appear in your extensions menu

## Usage

### Quick Start

1. **Open a Google Slides presentation**
2. **Click the Accio Imago extension icon** in your toolbar
3. **Click "Start Download Mode"** - the popup will close automatically
4. **Hover over images** - they will be highlighted with a cyan border
5. **Click any highlighted image** to download it
6. **Click the red "⊘ Stop Download Mode" button** when you're done

### Features

- **Automatic Google Slides detection**: Extension only activates on `docs.google.com/presentation/` URLs
- **Popup auto-closes**: After clicking "Start", the popup closes so you have full screen access
- **Persistent stop button**: Red button in bottom-right corner is always visible while downloading
- **Direct downloads**: High-quality image deeplinks download directly to your Downloads folder
- **GIF support**: Unlike other extensions, Accio Imago can download GIFs and animated images from Google Slides
- **No tab clutter**: Downloads happen in the background without opening new tabs

## How It Works

- The extension checks that you're on a Google Slides presentation
- When activated, it injects a content script that monitors mouse movements
- Only SVG `<image>` elements (how Google Slides renders images) are highlighted
- Clicking an image extracts its `xlink:href` deeplink and downloads it directly
- The `filesystem:` URLs used by Google Slides are handled directly by the content script
- When you click "Stop", all listeners are removed and the page returns to normal

## Development

### File Structure

- `extension/manifest.json` - Extension configuration and permissions
- `extension/popup.html` - Popup UI
- `extension/popup.js` - Popup logic and UI management
- `extension/content.js` - Content script (image detection, highlighting, downloads)
- `extension/sw.js` - Service worker (handles non-filesystem URL downloads)
- `build.sh` - Script to create distribution zip file
- `README.md` - User documentation
- `agent.md` - Developer/agent guide with detailed architecture and technical information

### Key Components

**Google Slides Detection** (`isGoogleSlidesUrl()`):
- Validates that current tab is a Google Slides presentation
- Disables start button if not on the right URL

**Image Detection** (`isImage()`):
- Detects SVG `<image>` elements with `filesystem:` URLs
- Only highlights actual image elements, ignores containers
- HTML `<img>` tags also supported for compatibility

**Download Handler** (`downloadImage()`):
- Handles `filesystem:` URLs directly from content script
- Delegates regular HTTP/HTTPS URLs to service worker
- No new tabs are opened - everything downloads silently

**Cleanup** (`cleanup()`):
- Removes all event listeners
- Hides overlay and stop button
- Resets extension state

### Building & Distribution

To create a distribution zip file for manual installation:

```bash
./build.sh
```

This creates `accio-imago-extension.zip` containing only the essential extension files:
- `content.js`
- `manifest.json`
- `popup.html`
- `popup.js`
- `sw.js`
- `logo.png`
- `icons/` (all icon files)

The zip file can be used for manual installation (see [Installation - Option 2](#option-2-install-from-zip-file-manual-installation) above). The script automatically excludes documentation files (`README.md`, `AGENT.md`) and other non-essential files.
