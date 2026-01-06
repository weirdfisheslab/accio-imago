const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const initialState = document.getElementById('initialState');
const activeState = document.getElementById('activeState');
const sendCodeBtn = document.getElementById('sendCodeBtn');
const verifyCodeBtn = document.getElementById('verifyCodeBtn');
const emailInput = document.getElementById('emailInput');
const emailDisplay = document.getElementById('emailDisplay');
const codeInput = document.getElementById('codeInput');
const authMessage = document.getElementById('authMessage');
const codeSentRow = document.getElementById('codeSentRow');
const codeSentText = document.getElementById('codeSentText');
const resetEmailBtn = document.getElementById('resetEmailBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authSection = document.getElementById('authSection');
const userSection = document.getElementById('userSection');
const billingSection = document.getElementById('billingSection');
const planStatus = document.getElementById('planStatus');
const freeStatus = document.getElementById('freeStatus');
const upgradeBtn = document.getElementById('upgradeBtn');
const upgradeOptions = document.getElementById('upgradeOptions');
const monthlyBtn = document.getElementById('monthlyBtn');
const yearlyBtn = document.getElementById('yearlyBtn');
const cancelUpgradeBtn = document.getElementById('cancelUpgradeBtn');
const manageBtn = document.getElementById('manageBtn');
const refreshBtn = document.getElementById('refreshBtn');

let isActive = false;
let currentTabId = null;

const PRODUCT_ID = 'slides_image_downloader';
const FUNCTIONS_BASE_URL = 'https://tbtnsxerhkpuxufaipdc.supabase.co/functions/v1';
const SUPABASE_URL = 'https://tbtnsxerhkpuxufaipdc.supabase.co';
const SUPABASE_ANON_KEY = '';
const BILLING_INTERVALS = ['monthly', 'yearly'];
const PENDING_EMAIL_KEY = 'pendingEmail';
const OTP_SENT_KEY = 'otpSent';

function updateVerifyButtonState() {
  const code = codeInput.value.trim();
  verifyCodeBtn.disabled = code.length !== 6;
}

function setAuthMessage(message) {
  authMessage.textContent = message;
  authMessage.classList.toggle('hidden', !message);
}

function setOtpVisibility(visible) {
  codeInput.classList.toggle('hidden', !visible);
  verifyCodeBtn.classList.toggle('hidden', !visible);
  codeSentRow.classList.toggle('hidden', !visible);
  emailInput.classList.toggle('hidden', visible);
  emailDisplay.classList.add('hidden');
  sendCodeBtn.classList.toggle('hidden', visible);
  emailInput.disabled = visible;
  sendCodeBtn.disabled = visible;
  if (!visible) {
    codeInput.value = '';
    updateVerifyButtonState();
  }
}

function updateCodeSentText(email) {
  if (!email) {
    codeSentText.textContent = 'Code sent';
    return;
  }
  codeSentText.textContent = `Code sent to ${email}`;
  emailDisplay.textContent = email;
}

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
  await checkLogin();
  const tab = await getCurrentTab();

  if (!isGoogleSlidesUrl(tab.url)) {
    startBtn.disabled = true;
    startBtn.style.opacity = '0.5';
    startBtn.style.cursor = 'not-allowed';

    const infoSection = document.querySelector('.info-section');
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
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (_error) {
        data = { error: text };
      }
    }
    if (!response.ok) {
      return { error: data?.error || data?.message || `Request failed (${response.status})` };
    }
    return data;
  } catch (error) {
    console.error('Function error:', error);
    return { error: error?.message ? `Network error: ${error.message}` : 'Network error' };
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
    upgradeOptions.classList.add('hidden');
    manageBtn.classList.remove('hidden');
  } else {
    freeStatus.textContent = `Free exports remaining: ${freeExportsRemaining}`;
    upgradeBtn.classList.remove('hidden');
    upgradeOptions.classList.add('hidden');
    manageBtn.classList.add('hidden');
  }
}

async function refreshEntitlement() {
  planStatus.textContent = 'Checking plan...';
  freeStatus.textContent = '';
  upgradeBtn.classList.add('hidden');
  upgradeOptions.classList.add('hidden');
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
    const { pendingEmail, otpSent } = await chrome.storage.local.get([PENDING_EMAIL_KEY, OTP_SENT_KEY]);
    if (pendingEmail && !emailInput.value) {
      emailInput.value = pendingEmail;
    }
    if (otpSent && pendingEmail) {
      updateCodeSentText(pendingEmail);
      setOtpVisibility(true);
      setAuthMessage('');
    } else {
      setOtpVisibility(false);
      setAuthMessage('Login to enable features');
    }
  }
}

sendCodeBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email) {
    setAuthMessage('Enter a valid email address.');
    return;
  }

  setAuthMessage('Sending code...');
  try {
    await chrome.storage.local.set({ [PENDING_EMAIL_KEY]: email, [OTP_SENT_KEY]: true });
    await requestOtp(email);
    updateCodeSentText(email);
    setOtpVisibility(true);
    setAuthMessage('');
  } catch (error) {
    setAuthMessage(error.message || 'Failed to send code.');
  }
});

verifyCodeBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const token = codeInput.value.trim();
  if (!email || !token) {
    setAuthMessage('Enter email and code.');
    return;
  }

  setAuthMessage('Verifying...');
  try {
    const data = await verifyOtp(email, token);
    await chrome.storage.local.set({
      accessToken: data.access_token
    });
    await chrome.storage.local.remove([PENDING_EMAIL_KEY, OTP_SENT_KEY]);
    codeInput.value = '';
    await checkLogin();
  } catch (error) {
    setAuthMessage(error.message || 'Failed to verify code.');
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
  upgradeBtn.classList.add('hidden');
  upgradeOptions.classList.remove('hidden');
});

cancelUpgradeBtn.addEventListener('click', async () => {
  upgradeOptions.classList.add('hidden');
  upgradeBtn.classList.remove('hidden');
});

async function startCheckout(billingInterval) {
  if (!BILLING_INTERVALS.includes(billingInterval)) {
    alert('Invalid billing interval');
    return;
  }
  const data = await callFunction('create_checkout_session', {
    product_id: PRODUCT_ID,
    billing_interval: billingInterval
  });
  if (data?.url) {
    chrome.tabs.create({ url: data.url });
  } else {
    alert(data?.error || 'Unable to start checkout');
  }
}

monthlyBtn.addEventListener('click', async () => {
  await startCheckout('monthly');
});

yearlyBtn.addEventListener('click', async () => {
  await startCheckout('yearly');
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
  await stopDownloadMode(tab);
});

codeInput.addEventListener('input', updateVerifyButtonState);

resetEmailBtn.addEventListener('click', async () => {
  emailInput.value = '';
  await chrome.storage.local.remove([PENDING_EMAIL_KEY, OTP_SENT_KEY]);
  setOtpVisibility(false);
  setAuthMessage('Login to enable features');
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
  // If not logged in, UI is handled by checkLogin
  chrome.storage.local.get('accessToken', ({ accessToken }) => {
    if (!accessToken) return;

    if (isActive) {
      initialState.classList.add('hidden');
      activeState.classList.remove('hidden');
    } else {
      initialState.classList.remove('hidden');
      activeState.classList.add('hidden');
    }
  });
}

// Initialize UI and check if on Google Slides
initializePopup();
updateVerifyButtonState();
