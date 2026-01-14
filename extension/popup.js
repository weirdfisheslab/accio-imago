const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const initialState = document.getElementById('initialState');
const activeState = document.getElementById('activeState');

let isActive = false;
let currentTabId = null;

// Get current active tab
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Check if URL is a Google Slides presentation
function isGoogleSlidesUrl(url) {
  return url && url.includes('https://docs.google.com/presentation/');
}

function getContentStatus(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(Boolean(response?.enabled));
    });
  });
}

// Check on popup load if we're on a Google Slides page
async function initializePopup() {
  const tab = await getCurrentTab();

  if (!isGoogleSlidesUrl(tab.url)) {
    startBtn.disabled = true;
    startBtn.style.opacity = '0.5';
    startBtn.style.cursor = 'not-allowed';

    const warning = document.createElement('div');
    warning.classList.add('warning-box');
    warning.innerHTML = '<strong>⚠️ Not a Google Slides</strong><br>Open a Google Slides presentation to use this extension.';
    initialState.insertAdjacentElement('beforebegin', warning);
    initialState.classList.add('hidden');
    return;
  }

  const enabled = await getContentStatus(tab.id);
  if (enabled) {
    await stopDownloadMode(tab);
  }
}

function setBillingUI({ plan, freeExportsRemaining }) {
  // Billing UI no longer needed for free extension
}

async function refreshEntitlement() {
  // Entitlement checks no longer needed for free extension
}

async function checkLogin() {
  // Login no longer required - always show download interface
  initialState.classList.remove('hidden');
}

startBtn.addEventListener('click', async () => {
  const tab = await getCurrentTab();

  // Double check it's a Google Slides tab
  if (!isGoogleSlidesUrl(tab.url)) {
    alert('Please open a Google Slides presentation first.');
    return;
  }

  currentTabId = tab.id;
  isActive = true;

  try {
    // Inject content script only in current tab
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["content.js"]
    });

    // Send message to enable highlighting
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE' }, () => {
      chrome.runtime.lastError; // ignore errors
    });
  } catch (error) {
    console.error('Failed to inject:', error);
    isActive = false;
    return;
  }

  updateUI();

  // Close the popup after starting
  window.close();
});

stopBtn.addEventListener('click', async () => {
  const tab = await getCurrentTab();
  await stopDownloadMode(tab);
});

async function stopDownloadMode(tab) {
  isActive = false;

  // Send message to disable and cleanup
  chrome.tabs.sendMessage(tab.id, { type: 'CLEANUP' }, () => {
    chrome.runtime.lastError; // ignore errors
  });

  // Remove content script by reloading it (or sending cleanup message)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      function: () => {
        // Remove the installed flag so script can be re-injected if needed
        window.__HH_INSTALLED__ = false;
      }
    });
  } catch (error) {
    console.debug('Cleanup error:', error);
  }

  updateUI();
}

function updateUI() {
  // Always allow UI updates since no login required
  if (isActive) {
    initialState.classList.add('hidden');
    activeState.classList.remove('hidden');
  } else {
    initialState.classList.remove('hidden');
    activeState.classList.add('hidden');
  }
}

// Initialize UI and check if on Google Slides
initializePopup();

function openFeedback(event) {
  event.preventDefault();
  chrome.tabs.create({ url: 'https://forms.gle/YOUR_FEEDBACK_FORM_ID' });
}

function openSupport(event) {
  event.preventDefault();
  chrome.tabs.create({ url: 'https://YOUR_SUPPORT_URL.com' });
}
