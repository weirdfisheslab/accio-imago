const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusBadge = document.getElementById('status');
const initialState = document.getElementById('initialState');
const activeState = document.getElementById('activeState');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authSection = document.getElementById('authSection');
const userSection = document.getElementById('userSection');

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

// Check on popup load if we're on a Google Slides page
async function initializePopup() {
  await checkLogin();
  const tab = await getCurrentTab();

  if (!isGoogleSlidesUrl(tab.url)) {
    startBtn.disabled = true;
    startBtn.style.opacity = '0.5';
    startBtn.style.cursor = 'not-allowed';

    const infoSection = document.querySelector('.info-section');
    const warning = document.createElement('div');
    warning.innerHTML = '<strong>⚠️ Not a Google Slides</strong><br>Open a Google Slides presentation to use this extension.';
    initialState.insertAdjacentElement('beforebegin', warning);
  }
}

async function verifyAction(actionType, metadata = {}) {
  const { accessToken } = await chrome.storage.local.get('accessToken');

  if (!accessToken) {
    return { allowed: false, error: 'Not logged in' };
  }

  try {
    const response = await fetch('https://tbtnsxerhkpuxufaipdc.supabase.co/functions/v1/verify-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ action_type: actionType, metadata })
    });

    return response.json();
  } catch (error) {
    console.error('Verification error:', error);
    return { allowed: false, error: 'Verification failed' };
  }
}

async function checkLogin() {
  const { accessToken } = await chrome.storage.local.get('accessToken');
  if (accessToken) {
    authSection.classList.add('hidden');
    userSection.classList.remove('hidden');
    // We let normal UI logic handle the rest (whether to show startBtn etc)
    // But if we want to hide everything if not logged in:
    const tab = await getCurrentTab();
    if (isGoogleSlidesUrl(tab.url)) {
      initialState.classList.remove('hidden');
    }
  } else {
    authSection.classList.remove('hidden');
    userSection.classList.add('hidden');
    initialState.classList.add('hidden');
    activeState.classList.add('hidden');
  }
}

loginBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://your-site.lovable.app/auth?extension=true' });
});

logoutBtn.addEventListener('click', () => {
  chrome.storage.local.remove('accessToken', async () => {
    await checkLogin();
  });
});

startBtn.addEventListener('click', async () => {
  const tab = await getCurrentTab();

  // Double check it's a Google Slides tab
  if (!isGoogleSlidesUrl(tab.url)) {
    alert('Please open a Google Slides presentation first.');
    return;
  }

  const verification = await verifyAction('generate_content', { source: 'popup' });
  if (!verification.allowed) {
    alert(verification.error || 'Access denied');
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
});

function updateUI() {
  // If not logged in, UI is handled by checkLogin
  chrome.storage.local.get('accessToken', ({ accessToken }) => {
    if (!accessToken) return;

    if (isActive) {
      initialState.classList.add('hidden');
      activeState.classList.remove('hidden');
      statusBadge.textContent = 'ON';
      statusBadge.classList.remove('inactive');
      statusBadge.classList.add('active');
    } else {
      initialState.classList.remove('hidden');
      activeState.classList.add('hidden');
      statusBadge.textContent = 'OFF';
      statusBadge.classList.remove('active');
      statusBadge.classList.add('inactive');
    }
  });
}

// Initialize UI and check if on Google Slides
initializePopup();
