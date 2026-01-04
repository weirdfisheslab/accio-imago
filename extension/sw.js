async function toggleOnActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  function send() {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE" }, () => {
      const err = chrome.runtime.lastError;
      if (err) console.debug("sendMessage error (expected if not injected yet):", err.message);
    });
  }

  // Try to send first. If no receiver, inject content.js, then send again.
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE" }, async (response) => {
    if (chrome.runtime.lastError) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ["content.js"]
        });
        send();
      } catch (e) {
        console.error("Injection failed:", e);
      }
    }
  });
}

// Listen for download requests from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DOWNLOAD_IMAGE') {
    handleImageDownload(msg.url, msg.filename, sendResponse);
    return true; // Will respond asynchronously
  }
});

async function handleImageDownload(url, filename, sendResponse) {
  try {
    if (url.startsWith('filesystem:')) {
      // For filesystem URLs, fetch and create a blob download
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      await chrome.downloads.download({
        url: blobUrl,
        filename: filename,
        saveAs: false
      });
      
      // Clean up blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      sendResponse({ success: true });
    } else {
      // For regular URLs, use downloads API directly
      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false
      });
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('Download failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "toggle-highlight") toggleOnActiveTab();
});

chrome.action.onClicked.addListener(() => {
  toggleOnActiveTab();
});
