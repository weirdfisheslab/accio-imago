# Accio Imago 🖼️

A Chrome Extension to download high-quality images from Google Slides with ease.

## Features

- **Google Slides only**: Works exclusively on Google Slides presentations
- **Smart image detection**: Automatically detects SVG image elements used by Google Slides
- **One-click download**: Hover over images and click to download high-quality deeplinks
- **Persistent stop button**: Always visible so you can stop at any time
- **Clean workflow**: Automatically injects and cleans up when done

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** and select the extension folder
5. The "Accio Imago" extension should now appear in your extensions menu

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

- `manifest.json` - Extension configuration and permissions
- `popup.html` - Simple popup UI with Start/Stop buttons
- `popup.js` - Popup logic and Google Slides URL validation
- `content.js` - Main content script (image detection, highlighting, downloads)
- `sw.js` - Service worker (handles non-filesystem URL downloads)
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

To create a distribution zip file for the Chrome Extension:

```bash
./build.sh
```

This creates `accio-imago-extension.zip` containing only the essential extension files:
- `content.js`
- `manifest.json` 
- `popup.html`
- `popup.js`
- `sw.js`

The script automatically excludes documentation files (`README.md`, `agent.md`) and other non-essential files.

## Future Improvements

- [ ] Support for other document types (Docs, Sheets)
- [ ] Batch download multiple images at once
- [ ] Save images to Google Drive directly
- [ ] Preview before downloading
- [ ] Settings panel for customization
- [ ] Download as different formats

## License

MIT
