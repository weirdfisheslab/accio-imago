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
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE" }, async () => {
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

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "toggle-highlight") toggleOnActiveTab();
});

chrome.action.onClicked.addListener(() => {
  toggleOnActiveTab();
});
