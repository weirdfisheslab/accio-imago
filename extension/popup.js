const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusBadge = document.getElementById('status');
const initialState = document.getElementById('initialState');
const activeState = document.getElementById('activeState');
const sendCodeBtn = document.getElementById('sendCodeBtn');
const verifyCodeBtn = document.getElementById('verifyCodeBtn');
const emailInput = document.getElementById('emailInput');
const codeInput = document.getElementById('codeInput');
const authMessage = document.getElementById('authMessage');
const logoutBtn = document.getElementById('logoutBtn');
const authSection = document.getElementById('authSection');
const userSection = document.getElementById('userSection');
const billingSection = document.getElementById('billingSection');
const planStatus = document.getElementById('planStatus');
const freeStatus = document.getElementById('freeStatus');
const upgradeBtn = document.getElementById('upgradeBtn');
const manageBtn = document.getElementById('manageBtn');
const refreshBtn = document.getElementById('refreshBtn');

let isActive = false;
let currentTabId = null;

const PRODUCT_ID = 'slides_image_downloader';
const FUNCTIONS_BASE_URL = 'https://tbtnsxerhkpuxufaipdc.supabase.co/functions/v1';
const SUPABASE_URL = 'https://tbtnsxerhkpuxufaipdc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRidG5zeGVyaGtwdXh1ZmFpcGRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNTgxNzcsImV4cCI6MjA4MTczNDE3N30.wBMEn6Quz34V-hWSU8jg3uPxgiShbyCbAxNUEW3Vm3s';

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

async function callFunction(path, body) {
  const { accessToken } = await chrome.storage.local.get('accessToken');

  if (!accessToken) {
    return { error: 'Not logged in' };
  }

  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    });

    return response.json();
  } catch (error) {
    console.error('Function error:', error);
    return { error: 'Request failed' };
  }
}

async function requestOtp(email) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ email, create_user: true })
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.msg || errorBody?.error_description || 'Failed to send code');
  }
}

async function verifyOtp(email, token) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ type: 'email', email, token })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error_description || data?.msg || 'Failed to verify code');
  }

  return data;
}

function setBillingUI({ plan, freeExportsRemaining }) {
  if (!planStatus || !freeStatus) return;

  planStatus.textContent = plan === 'pro' ? 'Pro plan active' : 'Free plan';

  if (plan === 'pro') {
    freeStatus.textContent = 'Unlimited exports while active';
    upgradeBtn.classList.add('hidden');
    manageBtn.classList.remove('hidden');
  } else {
    freeStatus.textContent = `Free exports remaining: ${freeExportsRemaining}`;
    upgradeBtn.classList.remove('hidden');
    manageBtn.classList.add('hidden');
  }
}

async function refreshEntitlement() {
  planStatus.textContent = 'Checking plan...';
  freeStatus.textContent = '';
  upgradeBtn.classList.add('hidden');
  manageBtn.classList.add('hidden');

  const data = await callFunction('validate', { product_id: PRODUCT_ID });
  if (data?.error) {
    planStatus.textContent = 'Unable to load plan';
    freeStatus.textContent = data.error;
    return;
  }

  setBillingUI({
    plan: data.plan,
    freeExportsRemaining: data.freeExportsRemaining
  });
}

async function checkLogin() {
  const { accessToken } = await chrome.storage.local.get('accessToken');
  if (accessToken) {
    authSection.classList.add('hidden');
    userSection.classList.remove('hidden');
    billingSection.classList.remove('hidden');
    // We let normal UI logic handle the rest (whether to show startBtn etc)
    // But if we want to hide everything if not logged in:
    const tab = await getCurrentTab();
    if (isGoogleSlidesUrl(tab.url)) {
      initialState.classList.remove('hidden');
    }
    await refreshEntitlement();
  } else {
    authSection.classList.remove('hidden');
    userSection.classList.add('hidden');
    billingSection.classList.add('hidden');
    initialState.classList.add('hidden');
    activeState.classList.add('hidden');
  }
}

sendCodeBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email) {
    authMessage.textContent = 'Enter a valid email address.';
    return;
  }

  authMessage.textContent = 'Sending code...';
  try {
    await requestOtp(email);
    authMessage.textContent = 'Check your email for the code.';
  } catch (error) {
    authMessage.textContent = error.message || 'Failed to send code.';
  }
});

verifyCodeBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const token = codeInput.value.trim();
  if (!email || !token) {
    authMessage.textContent = 'Enter email and code.';
    return;
  }

  authMessage.textContent = 'Verifying...';
  try {
    const data = await verifyOtp(email, token);
    await chrome.storage.local.set({
      accessToken: data.access_token
    });
    codeInput.value = '';
    await checkLogin();
  } catch (error) {
    authMessage.textContent = error.message || 'Failed to verify code.';
  }
});

logoutBtn.addEventListener('click', () => {
  chrome.storage.local.remove(['accessToken'], async () => {
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

upgradeBtn.addEventListener('click', async () => {
  const data = await callFunction('create_checkout_session', { product_id: PRODUCT_ID });
  if (data?.url) {
    chrome.tabs.create({ url: data.url });
  } else {
    alert(data?.error || 'Unable to start checkout');
  }
});

manageBtn.addEventListener('click', async () => {
  const data = await callFunction('create_portal_session', { product_id: PRODUCT_ID });
  if (data?.url) {
    chrome.tabs.create({ url: data.url });
  } else {
    alert(data?.error || 'Unable to open portal');
  }
});

refreshBtn.addEventListener('click', async () => {
  await refreshEntitlement();
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
