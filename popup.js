const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusBadge = document.getElementById('status');
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

// Check on popup load if we're on a Google Slides page
async function initializePopup() {
  const tab = await getCurrentTab();
  
  if (!isGoogleSlidesUrl(tab.url)) {
    startBtn.disabled = true;
    startBtn.style.opacity = '0.5';
    startBtn.style.cursor = 'not-allowed';
    
    const infoSection = document.querySelector('.info-section');
    const warning = document.createElement('div');
    warning.style.cssText = 'background: #fff3cd; color: #856404; padding: 12px; border-radius: 6px; margin-bottom: 12px; font-size: 12px;';
    warning.innerHTML = '<strong>⚠️ Not a Google Slides</strong><br>Open a Google Slides presentation to use this extension.';
    initialState.insertAdjacentElement('beforebegin', warning);
  }
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
}

// Initialize UI and check if on Google Slides
initializePopup();
