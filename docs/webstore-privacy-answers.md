# Accio Imago — Chrome Web Store Privacy Form Answers

## Open Source
This extension is open source. The source code is publicly available, allowing transparency and community review of all functionality and data handling practices.

## Remote Code
- **Select**: "No, I do not use remote code"
- **Note**: The extension does not load or execute remote JavaScript. It operates entirely locally in the browser.

## Permission Justifications

### scripting
"Used to inject the content script into the active tab when the user starts download mode on Google Slides. Required to highlight images and enable click-to-download functionality."

### storage
"Used to store minimal local state for the extension interface (e.g., whether download mode is active). No user data or authentication tokens are stored."

### downloads
"Used to initiate image file downloads when the user clicks on an image in the presentation."

### host permissions
"Limited access to `https://docs.google.com/presentation/*` to detect and interact with images in Google Slides presentations. No other domains are accessed."

## Data Usage Selections

### Select (None)
Since the extension is free and requires no authentication, **no data usage categories should be selected**.

## Single Purpose Description
"Allows users to download images from Google Slides presentations with one click, highlighting images and initiating downloads only when explicitly requested by the user."

## Product Description (Store Listing Details)
"Accio Imago enables you to download high-quality images and GIFs from Google Slides with a single click. Activate download mode from the popup, hover over images to highlight them, and click to save. Works exclusively on Google Slides presentations, collects no user data, and downloads only what you explicitly select."
