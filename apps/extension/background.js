// Focus OS Chrome Extension - Background Service Worker
// Production-ready focus enforcement with distraction warnings and auto-close

// Global state
let currentActiveTab = null;
let currentDomain = null;
let sessionStartTimestamp = null;
let activeSessionId = null;
let distractionStartTime = null;
let distractionWarningTimeout = null;
let distractionAutoCloseTimeout = null;
let lastEventSentTime = null;
let blockedDomains = [];
let allowedDomains = [];
let userSettings = {};

// Configuration
const SESSION_POLL_INTERVAL = 15000; // 15 seconds
const DEFAULT_DISTRACTION_TIMEOUT = 120000; // 2 minutes
const DEFAULT_GRACE_PERIOD = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const BATCH_SIZE = 10;
let eventQueue = [];

// Extract domain from URL
function extractDomain(url) {
  if (!url) return null;

  // Ignore special URLs
  if (url.startsWith('chrome://') ||
      url.startsWith('extension://') ||
      url.startsWith('about:') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('chrome-search://') ||
      url.startsWith('moz-extension://')) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === 'localhost') {
      return 'localhost';
    }

    const parts = hostname.split('.');
    if (parts.length <= 2) {
      return hostname;
    }

    // Get last two parts (e.g., example.com from www.example.com)
    return parts.slice(-2).join('.');
  } catch {
    return null;
  }
}

// Get extension settings from storage
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      'apiBaseUrl', 
      'apiKey', 
      'distractionTimeoutMinutes',
      'gracePeriodSeconds',
      'autoCloseEnabled',
      'warningEnabled',
      'ignorePinnedTabs'
    ], (result) => {
      userSettings = {
        apiBaseUrl: result.apiBaseUrl || 'http://localhost:3000',
        apiKey: result.apiKey || '02313202e4207fed50089c8e7d99be82c85f3f8f2cc42e9b9d9ebe8b9fca6f3c',
        distractionTimeoutMinutes: result.distractionTimeoutMinutes || 2,
        gracePeriodSeconds: result.gracePeriodSeconds || 30,
        autoCloseEnabled: result.autoCloseEnabled || false,
        warningEnabled: result.warningEnabled !== false,
        ignorePinnedTabs: result.ignorePinnedTabs !== false,
      };
      resolve(userSettings);
    });
  });
}

// Load domain lists from API
async function loadDomainLists() {
  try {
    const { apiBaseUrl, apiKey } = await getSettings();
    
    if (!apiKey) return;

    const [blockedResponse, allowedResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/api/settings/blocked-domains`, {
        headers: { 'X-API-Key': apiKey }
      }),
      fetch(`${apiBaseUrl}/api/settings/allowed-domains`, {
        headers: { 'X-API-Key': apiKey }
      })
    ]);

    if (blockedResponse.ok) {
      const blockedData = await blockedResponse.json();
      blockedDomains = blockedData.domains.map(d => d.domain);
    }

    if (allowedResponse.ok) {
      const allowedData = await allowedResponse.json();
      allowedDomains = allowedData.domains.map(d => d.domain);
    }

    console.log('[Focus OS] Domain lists loaded:', {
      blocked: blockedDomains.length,
      allowed: allowedDomains.length
    });
  } catch (error) {
    console.error('[Focus OS] Error loading domain lists:', error);
  }
}

// Check for active session
async function checkActiveSession() {
  try {
    const { apiBaseUrl, apiKey } = await getSettings();

    if (!apiKey) {
      console.log('[Focus OS] No API key configured');
      return null;
    }

    const response = await fetch(`${apiBaseUrl}/api/sessions/active`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.error('[Focus OS] Invalid API key');
      }
      return null;
    }

    const data = await response.json();
    return data.session;
  } catch (error) {
    console.error('[Focus OS] Error checking active session:', error);
    return null;
  }
}

// Send activity event to backend
async function sendActivityEvent(eventData) {
  try {
    const { apiBaseUrl, apiKey } = await getSettings();

    if (!apiKey) {
      console.log('[Focus OS] No API key configured, queuing event');
      eventQueue.push(eventData);
      return;
    }

    console.log('[Focus OS] Sending event:', eventData);

    const response = await fetch(`${apiBaseUrl}/api/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Focus OS] Error sending event:', errorData);
      eventQueue.push(eventData);
      return;
    }

    const result = await response.json();
    console.log('[Focus OS] Event sent:', eventData.domain, eventData.durationSeconds + 's', result.category);

    lastEventSentTime = Date.now();
  } catch (error) {
    console.error('[Focus OS] Error sending activity event:', error);
    eventQueue.push(eventData);
  }
}

// Send queued events
async function sendQueuedEvents() {
  if (eventQueue.length === 0) return;

  const eventsToSend = eventQueue.splice(0, BATCH_SIZE);
  
  try {
    const { apiBaseUrl, apiKey } = await getSettings();
    
    const response = await fetch(`${apiBaseUrl}/api/activity/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ events: eventsToSend }),
    });

    if (response.ok) {
      console.log('[Focus OS] Batch sent:', eventsToSend.length, 'events');
    } else {
      // Re-queue if failed
      eventQueue.unshift(...eventsToSend);
    }
  } catch (error) {
    // Re-queue if failed
    eventQueue.unshift(...eventsToSend);
  }
}

// Classify domain as focus, distraction, or neutral
function classifyDomain(domain) {
  if (!domain) return 'NEUTRAL';

  // Check if domain is blocked
  const isBlocked = blockedDomains.some(blocked => 
    domain === blocked || domain.endsWith(`.${blocked}`)
  );

  if (isBlocked) return 'DISTRACTION';

  // Check if domain is allowed
  const isAllowed = allowedDomains.some(allowed => 
    domain === allowed || domain.endsWith(`.${allowed}`)
  );

  if (isAllowed) return 'FOCUS';

  return 'NEUTRAL';
}

// Show distraction warning
async function showDistractionWarning(domain, timeRemaining) {
  const { warningEnabled } = await getSettings();
  
  if (!warningEnabled) return;

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Focus OS - Distraction Warning',
    message: `You've been on ${domain} for ${Math.floor(timeRemaining / 1000)} seconds. Return to focus!`,
    priority: 2,
    buttons: [
      { title: 'Return to Focus' },
      { title: 'Ignore' }
    ]
  });
}

// Close distracting tab
async function closeDistractingTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    console.log('[Focus OS] Closed distracting tab:', tabId);
  } catch (error) {
    console.error('[Focus OS] Error closing tab:', error);
  }
}

// Handle distraction detection
async function handleDistraction(tabId, domain) {
  const { autoCloseEnabled, gracePeriodSeconds } = await getSettings();
  const distractionTimeoutMs = (userSettings.distractionTimeoutMinutes || 2) * 60000;

  // Clear existing timeouts
  if (distractionWarningTimeout) {
    clearTimeout(distractionWarningTimeout);
  }
  if (distractionAutoCloseTimeout) {
    clearTimeout(distractionAutoCloseTimeout);
  }

  distractionStartTime = Date.now();

  // Show warning after grace period
  distractionWarningTimeout = setTimeout(() => {
    const timeSpent = Date.now() - distractionStartTime;
    showDistractionWarning(domain, distractionTimeoutMs - timeSpent);
  }, gracePeriodSeconds);

  // Auto-close if enabled and timeout reached
  if (autoCloseEnabled) {
    distractionAutoCloseTimeout = setTimeout(() => {
      closeDistractingTab(tabId);
    }, distractionTimeoutMs);
  }
}

// Clear distraction handling
function clearDistractionHandling() {
  if (distractionWarningTimeout) {
    clearTimeout(distractionWarningTimeout);
    distractionWarningTimeout = null;
  }
  if (distractionAutoCloseTimeout) {
    clearTimeout(distractionAutoCloseTimeout);
    distractionAutoCloseTimeout = null;
  }
  distractionStartTime = null;
}

// Flush current activity (when switching tabs or domains)
async function flushCurrentActivity(newDomain, newSessionId) {
  console.log('[Focus OS] Flush called:', { 
    currentActiveTab, 
    currentDomain, 
    sessionStartTimestamp, 
    newDomain, 
    newSessionId, 
    activeSessionId 
  });
  
  if (!currentActiveTab || !sessionStartTimestamp) {
    console.log('[Focus OS] Missing required data for flush');
    return;
  }

  const sessionId = newSessionId || activeSessionId;
  
  if (!sessionId) {
    console.log('[Focus OS] No active session, not tracking');
    clearDistractionHandling();
    return;
  }

  const now = new Date();
  const durationSeconds = Math.floor((now.getTime() - sessionStartTimestamp) / 1000);

  if (durationSeconds > 1 && currentDomain) {
    const eventData = {
      sessionId,
      domain: currentDomain,
      startedAt: new Date(sessionStartTimestamp).toISOString(),
      endedAt: now.toISOString(),
      durationSeconds,
      tabId: currentActiveTab,
    };

    await sendActivityEvent(eventData);
  } else {
    console.log('[Focus OS] Skipping event:', { durationSeconds, currentDomain });
  }

  // Handle distraction detection for new domain
  if (newDomain && sessionId) {
    const classification = classifyDomain(newDomain);
    
    if (classification === 'DISTRACTION') {
      await handleDistraction(currentActiveTab, newDomain);
    } else {
      clearDistractionHandling();
    }
  }

  currentDomain = newDomain;
  sessionStartTimestamp = Date.now();
}

// Handle tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const domain = extractDomain(tab.url);
    const session = await checkActiveSession();

    activeSessionId = session ? session.id : null;

    // Check if tab is pinned and should be ignored
    if (tab.pinned && (await getSettings()).ignorePinnedTabs) {
      console.log('[Focus OS] Ignoring pinned tab');
      return;
    }

    if (!currentDomain && domain && activeSessionId) {
      currentDomain = domain;
      sessionStartTimestamp = Date.now();
      console.log('[Focus OS] Initial tracking started for:', domain);
    }

    await flushCurrentActivity(domain, activeSessionId);
    currentActiveTab = tab.id;

    console.log('[Focus OS] Tab activated:', domain, 'Session:', activeSessionId ? 'active' : 'inactive');
  } catch (error) {
    console.error('[Focus OS] Error in onActivated:', error);
  }
});

// Handle tab URL updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    const domain = extractDomain(changeInfo.url);
    const session = await checkActiveSession();

    activeSessionId = session ? session.id : null;

    if (domain !== currentDomain) {
      await flushCurrentActivity(domain, activeSessionId);
      currentActiveTab = tabId;
      console.log('[Focus OS] URL updated:', domain);
    }
  }
});

// Handle window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await flushCurrentActivity(null, null);
    clearDistractionHandling();
    console.log('[Focus OS] Window lost focus');
  } else {
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab) {
        const domain = extractDomain(tab.url);
        const session = await checkActiveSession();
        activeSessionId = session ? session.id : null;
        await flushCurrentActivity(domain, activeSessionId);
        currentActiveTab = tab.id;
        console.log('[Focus OS] Window focused:', domain);
      }
    } catch (error) {
      console.error('[Focus OS] Error in onFocusChanged:', error);
    }
  }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
  // Could implement focus restoration logic here
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  chrome.notifications.clear(notificationId);
  
  if (buttonIndex === 0) {
    // "Return to Focus" - could implement logic to switch back to productive tab
    console.log('[Focus OS] User wants to return to focus');
  }
});

// Periodic session check and event queue processing
chrome.alarms.create('checkSession', { periodInMinutes: SESSION_POLL_INTERVAL / 60000 });
chrome.alarms.create('processQueue', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkSession') {
    const session = await checkActiveSession();
    const wasActive = activeSessionId !== null;
    activeSessionId = session ? session.id : null;

    if (wasActive && !activeSessionId) {
      await flushCurrentActivity(null, null);
      clearDistractionHandling();
      console.log('[Focus OS] Session ended');
    }

    updateBadge(activeSessionId !== null);
  } else if (alarm.name === 'processQueue') {
    await sendQueuedEvents();
  }
});

// Update extension badge
function updateBadge(isActive) {
  if (isActive) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Initialize extension
async function initialize() {
  console.log('[Focus OS] Initializing production-ready extension...');

  await getSettings();
  await loadDomainLists();

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) {
      currentActiveTab = tab.id;
      currentDomain = extractDomain(tab.url);
      sessionStartTimestamp = Date.now();
    }
  } catch (error) {
    console.error('[Focus OS] Error getting active tab:', error);
  }

  const session = await checkActiveSession();
  activeSessionId = session ? session.id : null;

  updateBadge(activeSessionId !== null);

  console.log('[Focus OS] Initialized. Session:', activeSessionId ? 'active' : 'inactive');
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.apiBaseUrl || changes.apiKey) {
      console.log('[Focus OS] Configuration changed, reinitializing...');
      initialize();
    } else if (changes.distractionTimeoutMinutes || 
               changes.gracePeriodSeconds || 
               changes.autoCloseEnabled || 
               changes.warningEnabled) {
      getSettings();
    }
  }
});

// Start extension
initialize();
