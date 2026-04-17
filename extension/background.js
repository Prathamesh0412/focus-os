// Focus OS Background Service Worker
const API_URL = 'http://localhost:3001';
const API_KEY = '02313202e4207fed50089c8e7d99be82c85f3f8f2cc42e9b9d9ebe8b9fca6f3c';

// State management
let currentActiveTab = null;
let currentDomain = null;
let sessionStartTimestamp = null;
let activeSessionId = null;
let lastEventSentTime = null;
let eventQueue = [];
let isFocusMode = false;

// Default blocked domains
const DEFAULT_BLOCKED_DOMAINS = [
  'facebook.com', 'twitter.com', 'instagram.com', 'youtube.com',
  'reddit.com', 'tiktok.com', 'netflix.com', 'twitch.tv'
];

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Focus OS Extension Installed');
  
  // Set default settings
  chrome.storage.sync.set({
    blockedDomains: DEFAULT_BLOCKED_DOMAINS,
    focusMode: false,
    warningDelay: 5000, // 5 seconds
    autoCloseDelay: 10000 // 10 seconds
  });
});

// Check existing tabs on extension startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Focus OS Extension Started');
  await checkAllTabs();
});

// Also check when extension is reloaded
chrome.runtime.onSuspend.addListener(() => {
  console.log('Focus OS Extension Suspended');
});

// Check all existing tabs
async function checkAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const settings = await chrome.storage.sync.get(['blockedDomains']);
    
    if (settings.blockedDomains) {
      for (const tab of tabs) {
        if (tab.url && !tab.pinned) {
          const domain = extractDomain(tab.url);
          await checkDomainRestriction(domain, settings.blockedDomains);
        }
      }
    }
  } catch (error) {
    console.error('Error checking existing tabs:', error);
  }
}

// Tab tracking
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    await handleTabChange(tab);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    await handleTabChange(tab);
  }
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.url) {
    await handleTabChange(tab);
  }
});

// Handle tab changes
async function handleTabChange(tab) {
  try {
    const domain = extractDomain(tab.url);
    
    // Update current state
    currentActiveTab = tab;
    currentDomain = domain;
    
    // Get settings and always check domain restrictions
    const settings = await chrome.storage.sync.get(['focusMode', 'blockedDomains']);
    isFocusMode = settings.focusMode || false;
    
    // Always enforce blocking, regardless of focus mode
    if (settings.blockedDomains) {
      await checkDomainRestriction(domain, settings.blockedDomains);
    }
    
    // Send activity event
    await sendActivityEvent(domain);
    
  } catch (error) {
    console.error('Error handling tab change:', error);
  }
}

// Check domain restrictions
async function checkDomainRestriction(domain, blockedDomains) {
  if (!domain || !blockedDomains.includes(domain)) {
    return;
  }
  
  console.log(`Restricting domain: ${domain}`);
  
  // Show warning immediately
  await showWarningNotification(domain);
  
  // Set very short timer for auto-close (3 seconds)
  const settings = await chrome.storage.sync.get(['autoCloseDelay']);
  const delay = 3000; // Force immediate closing
  
  setTimeout(async () => {
    await closeDistractingTab(domain);
  }, delay);
}

// Show warning notification
async function showWarningNotification(domain) {
  chrome.notifications.create({
    type: 'basic',
    title: 'Focus OS Warning',
    message: `${domain} is distracting. Return to focus or tab will be closed.`
  });
}

// Close distracting tab
async function closeDistractingTab(domain) {
  try {
    const tabs = await chrome.tabs.query({ url: `*://*.${domain}/*` });
    
    for (const tab of tabs) {
      if (!tab.pinned) {
        await chrome.tabs.remove(tab.id);
        console.log(`Closed distracting tab: ${tab.url}`);
      }
    }
    
    chrome.notifications.create({
      type: 'basic',
      title: 'Focus OS',
      message: `Distracting tab ${domain} was closed.`
    });
    
  } catch (error) {
    console.error('Error closing tab:', error);
  }
}

// Send activity event to API
async function sendActivityEvent(domain) {
  if (!activeSessionId) {
    await checkActiveSession();
  }
  
  if (!activeSessionId) {
    return; // No active session
  }
  
  const event = {
    domain: domain,
    url: currentActiveTab?.url,
    title: currentActiveTab?.title,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    durationSeconds: 15, // Default 15 seconds
    category: classifyDomain(domain),
    source: 'CHROME_EXTENSION',
    tabId: currentActiveTab?.id,
    windowId: currentActiveTab?.windowId,
    isActive: true
  };
  
  // Queue event for batch sending
  eventQueue.push(event);
  
  // Send batch every 30 seconds
  if (!lastEventSentTime || Date.now() - lastEventSentTime > 30000) {
    await sendEventBatch();
  }
}

// Send batch of events
async function sendEventBatch() {
  if (eventQueue.length === 0) return;
  
  try {
    const response = await fetch(`${API_URL}/api/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        events: eventQueue,
        sessionId: activeSessionId
      })
    });
    
    if (response.ok) {
      eventQueue = [];
      lastEventSentTime = Date.now();
      console.log(`Sent ${eventQueue.length} activity events`);
    }
    
  } catch (error) {
    console.error('Error sending events:', error);
  }
}

// Check for active session
async function checkActiveSession() {
  try {
    const response = await fetch(`${API_URL}/api/sessions/active`, {
      headers: {
        'X-API-Key': API_KEY
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      activeSessionId = data.session?.id || null;
    }
    
  } catch (error) {
    console.error('Error checking active session:', error);
  }
}

// Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

// Classify domain
function classifyDomain(domain) {
  if (!domain) return 'NEUTRAL';
  
  const productive = ['github.com', 'stackoverflow.com', 'docs.google.com', 'notion.so'];
  const distracting = ['facebook.com', 'twitter.com', 'instagram.com', 'youtube.com', 'reddit.com'];
  
  if (productive.some(d => domain.includes(d))) return 'FOCUS';
  if (distracting.some(d => domain.includes(d))) return 'DISTRACTION';
  return 'NEUTRAL';
}

// Start focus mode
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'startFocusMode') {
    await chrome.storage.sync.set({ focusMode: true });
    isFocusMode = true;
    sendResponse({ success: true });
  }
  
  if (request.action === 'stopFocusMode') {
    await chrome.storage.sync.set({ focusMode: false });
    isFocusMode = false;
    sendResponse({ success: true });
  }
  
  if (request.action === 'getStatus') {
    sendResponse({
      focusMode: isFocusMode,
      currentDomain: currentDomain,
      activeSession: activeSessionId !== null
    });
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'checkTabs') {
    await checkAllTabs();
    sendResponse({ success: true });
  }
  return true;
});

// Periodic session check
setInterval(checkActiveSession, 15000); // Every 15 seconds

// Periodic event sending
setInterval(sendEventBatch, 30000); // Every 30 seconds
