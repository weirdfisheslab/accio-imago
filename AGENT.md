# Accio Imago - Agent Guide

This document describes how AI agents (or developers) can understand and work with the Accio Imago codebase.

## Project Overview

**Accio Imago** is a Chrome Extension that enables users to download high-quality images from Google Slides presentations with a single click. The extension works exclusively on Google Slides and uses smart image detection to identify and highlight SVG image elements. The store-facing name is **"Accio Imago - Download images from Google Slides"**.

### Core Purpose

The extension solves the problem of downloading images from Google Slides, which can be cumbersome through the native interface. Users can activate download mode, hover over images to highlight them, and click to download directly.

## Architecture Overview

The extension follows Chrome's Manifest V3 architecture with the following main components:

### File Structure

```
accio-imago/
├── extension/
│   ├── manifest.json          # Extension configuration and permissions
│   ├── popup.html            # Extension popup UI (Start/Stop buttons)
│   ├── popup.js              # Popup logic and URL validation
│   ├── content.js            # Main content script (image detection, highlighting)
│   └── sw.js                 # Service worker (handles downloads)
├── build.sh              # Build script to create distribution zip
└── README.md             # User documentation
```

### Component Architecture

#### 1. **Popup** (`extension/popup.html` + `extension/popup.js`)
- **Purpose**: Provides the user interface for the extension
- **Responsibilities**:
  - Displays "Start Download Mode" button
  - Validates that the user is on a Google Slides presentation
  - Sends toggle message to content script
  - Auto-closes after activation
  - Handles authentication (Supabase integration for action verification)
- **Key Functions**:
  - `isGoogleSlidesUrl()`: Validates Google Slides URL
  - `verifyAction()`: Sends action data to backend for verification
  - `initializePopup()`: Sets up UI on load

#### 2. **Content Script** (`extension/content.js`)
- **Purpose**: Runs in the context of the web page and handles image detection
- **Responsibilities**:
  - Creates overlay and stop button UI elements
  - Monitors mouse movements when download mode is active
  - Detects SVG `<image>` elements (how Google Slides renders images)
  - Highlights images with cyan border on hover
  - Extracts image URLs and triggers downloads
  - Cleans up all event listeners and UI when stopped
- **Key Functions**:
  - `isImage()`: Detects SVG or HTML image elements
  - `downloadImage()`: Handles both filesystem: and HTTP(S) URLs
  - `cleanup()`: Removes all listeners and UI elements
- **Lifecycle**:
  1. Injects once on page load (checks `window.__HH_INSTALLED__`)
  2. Creates fixed overlay, label, and stop button
  3. Waits for TOGGLE message from popup
  4. Activates on mousemove listener and monitors for image hovers
  5. Cleans up when stop button is clicked

#### 3. **Service Worker** (`extension/sw.js`)
- **Purpose**: Handles downloads for HTTP(S) URLs (filesystem: URLs are handled in content.js)
- **Responsibilities**:
  - Listens for DOWNLOAD_IMAGE messages from content script
  - Initiates chrome.downloads API for regular URLs
  - Injects content script if not already present
  - Manages inter-component messaging
- **Key Functions**:
  - `toggleOnActiveTab()`: Sends TOGGLE message to content script
  - Message listener: Processes DOWNLOAD_IMAGE requests

## Data Flow

### User Interaction Flow

1. **Activation**:
   - User clicks extension icon
   - Popup displays with "Start Download Mode" button
   - Popup validates URL is Google Slides
   - User clicks "Start Download Mode"

2. **Download Mode Active**:
   - Service worker sends TOGGLE message to content script
   - Content script activates mousemove listener
   - Overlay and stop button become visible
   - User hovers over images → images highlighted with cyan border
   - User clicks image

3. **Image Download**:
   - Content script detects click on image element
   - Extracts `xlink:href` (for SVG) or `src` (for HTML img)
   - For `filesystem:` URLs: Content script downloads directly
   - For HTTP(S) URLs: Sends DOWNLOAD_IMAGE message to service worker
   - Service worker initiates download via chrome.downloads API
   - No new tabs are opened; download happens silently

4. **Deactivation**:
   - User clicks red "Stop download" button
   - Content script receives STOP message
   - All event listeners removed
   - Overlay, label, and stop button hidden
   - Page returns to normal state

## Key Technical Decisions

### Why SVG Detection?
Google Slides renders images as SVG `<image>` elements with `xlink:href` attributes pointing to `filesystem:` URLs. This is more efficient than attempting to intercept downloads or manipulate the DOM.

### Pointer Events: None
The overlay uses `pointer-events: none` so it never captures mouse events. This allows users to interact with the page normally while the overlay provides visual feedback.

### Content Script Injection Strategy
The content script is injected on all URLs (`<all_urls>`) at document start. It immediately sets `window.__HH_INSTALLED__` to prevent duplicate injections. The script doesn't activate until it receives a TOGGLE message.

### Filesystem URL Handling
`filesystem:` URLs used by Google Slides are blob-like and can only be downloaded from the same context where they're available. The content script handles these directly using fetch + blob download, while the service worker handles regular HTTP(S) URLs.

### Auto-Close Popup
After clicking "Start Download Mode", the popup automatically closes so users have full screen access to the presentation. The persistent stop button ensures they can always stop download mode.

## Extension Permissions

From `manifest.json`:
- **scripting**: Required to inject content scripts
- **storage**: Required for storing authentication tokens
- **downloads**: Required to initiate file downloads
- **host_permissions** (`<all_urls>`): Allows running on any URL

## Integration Points

### Supabase Backend Integration
The extension communicates with a Supabase backend to verify user actions:
- Endpoint: `https://tbtnsxerhkpuxufaipdc.supabase.co/functions/v1/verify-action`
- Uses access tokens stored in `chrome.storage.local`
- Sends action metadata for audit/security purposes

## Development Guidelines

### Adding Features

1. **New UI Elements**: Add to `extension/popup.html` and style in `extension/popup.js`
2. **Download Behavior**: Modify `downloadImage()` in `extension/content.js` or download handler in `extension/sw.js`
3. **Image Detection**: Modify `isImage()` in `extension/content.js` to support new element types
4. **New Messaging**: Define message types in `extension/sw.js` listener and corresponding handlers

### Testing

1. Load unpacked extension: `chrome://extensions/ → Load unpacked → select folder`
2. Open a Google Slides presentation
3. Click extension icon to test popup
4. Click "Start Download Mode" to activate content script
5. Test image detection and download functionality
6. Click stop button to verify cleanup

### Debugging

- **Content Script Logs**: Open DevTools on the presentation page (F12)
- **Service Worker Logs**: `chrome://extensions/ → Details → "Inspect views" → "service worker"`
- **Popup Logs**: Click extension icon, right-click popup, select "Inspect popup"
- **Message Flow**: Check console for message errors during TOGGLE/DOWNLOAD_IMAGE operations

### Supabase + Stripe CLI (Cloud Default)

- Supabase Cloud is the default setup; do not start local Docker services unless explicitly requested.
- Use the Supabase CLI and Stripe CLI directly with secrets loaded from the root `.env` file.

## Common Modifications

### Support More Document Types
1. Modify `isGoogleSlidesUrl()` to accept Google Docs/Sheets URLs
2. Adjust `isImage()` to detect image elements in those contexts
3. Update popup warning message

### Change Download Behavior
- Modify `downloadImage()` in `extension/content.js` to customize filename, format, or destination
- Update service worker message handler in `extension/sw.js` for HTTP(S) downloads

### Update UI Styling
- Overlay cyan color: Search for `#00d4ff` in `extension/content.js`
- Stop button styling: Update stopButton style object in `extension/content.js`
- Popup colors: Modify CSS in `extension/popup.html`

### Add Keyboard Shortcuts
- Edit `commands` section in `manifest.json`
- Handle keyboard events in `extension/popup.js` or `extension/content.js`

## Dependencies

- **No external dependencies**: The extension uses only Chrome APIs and vanilla JavaScript
- **Chrome APIs Used**:
  - `chrome.tabs.*`: Tab management and messaging
  - `chrome.scripting.*`: Content script injection
  - `chrome.downloads.*`: File downloads
  - `chrome.storage.*`: Data persistence
  - `chrome.runtime.*`: Message passing

## Build & Distribution

### Creating a Distribution Package
```bash
./build.sh
```

This script bundles the extension for distribution, creating `accio-imago-extension.zip` with only the essential files:
- `extension/content.js`
- `extension/manifest.json`
- `extension/popup.html`
- `extension/popup.js`
- `extension/sw.js`

The script automatically excludes documentation files (`README.md`, `agent.md`) and other non-essential files.

### Manual Installation
1. Navigate to `chrome://extensions/`
2. Enable Developer Mode (top right toggle)
3. Click "Load unpacked"
4. Select the extension folder

### Publishing to Chrome Web Store
Requires Google Developer account and follows Chrome Web Store submission process (not automated in current setup).

## Performance Considerations

- **Minimal Resource Usage**: Content script only activates on user action
- **No Background Polling**: Downloads triggered by user clicks, not background processes
- **Efficient Event Handling**: Mousemove listener only active during download mode
- **Memory Cleanup**: All event listeners properly removed on deactivation

## Security Considerations

- **URL Validation**: Extension only works on official Google Slides URLs
- **No External Scripts**: All code is local; no remote script injection
- **Controlled Downloads**: User must explicitly click each image to download
- **Backend Verification**: Actions verified with Supabase for audit trail
- **Storage**: Sensitive tokens stored in Chrome's encrypted storage

## Future Enhancement Opportunities

1. **Batch Downloads**: Select multiple images and download all at once
2. **Format Options**: Convert to PNG, JPG, WebP on download
3. **Google Drive Integration**: Save directly to Google Drive instead of Downloads
4. **Preview Panel**: Show thumbnail preview before downloading
5. **Search & Filter**: Search for images by name or size
6. **Settings Panel**: Allow customization of download behavior
7. **Other Document Types**: Extend to Google Docs, Sheets
8. **Browser Support**: Port to Firefox, Edge, Safari

## Troubleshooting Guide for Developers

### Issue: Extension doesn't activate on Google Slides
- **Check**: `isGoogleSlidesUrl()` is correctly matching the URL
- **Verify**: Content script was injected (check DevTools console)
- **Solution**: Ensure you're on the correct Google Slides URL format

### Issue: Images not being detected
- **Check**: Use inspector to verify image elements are SVG `<image>` with `xlink:href`
- **Verify**: `isImage()` function matches the element structure
- **Solution**: May need to update selector or attribute names if Google Slides changes

### Issue: Downloads fail silently
- **Check**: Service worker logs for `DOWNLOAD_IMAGE` message receipt
- **Verify**: `chrome.downloads` permission is present in manifest
- **Solution**: For filesystem: URLs, ensure content script context is handling download

### Issue: Stop button doesn't appear
- **Check**: Popup was clicked and TOGGLE message was sent
- **Verify**: Content script is running (check `window.__HH_INSTALLED__`)
- **Solution**: Reload extension and try again
