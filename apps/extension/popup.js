// Focus OS Extension - Popup Script

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

async function updatePopup() {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const timer = document.getElementById('timer');
  const focusTime = document.getElementById('focus-time');
  const distractionTime = document.getElementById('distraction-time');

  try {
    const result = await chrome.storage.local.get(['apiBaseUrl', 'apiKey']);
    const apiBaseUrl = result.apiBaseUrl || 'http://localhost:3000';
    const apiKey = result.apiKey;

    if (!apiKey) {
      statusDot.className = 'status-dot inactive';
      statusText.textContent = 'Not configured';
      timer.textContent = '--:--:--';
      return;
    }

    const response = await fetch(`${apiBaseUrl}/api/sessions/active`, {
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      statusDot.className = 'status-dot inactive';
      statusText.textContent = 'Not tracking';
      timer.textContent = '--:--:--';
      return;
    }

    const data = await response.json();

    if (!data.session) {
      statusDot.className = 'status-dot inactive';
      statusText.textContent = 'No active session';
      timer.textContent = '--:--:--';
      focusTime.textContent = '0m';
      distractionTime.textContent = '0m';
      return;
    }

    const session = data.session;
    statusDot.className = 'status-dot active';
    statusText.textContent = 'Tracking';

    // Calculate elapsed time
    const startTime = new Date(session.startedAt).getTime();
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    timer.textContent = formatDuration(elapsedSeconds);

    // Update stats
    focusTime.textContent = formatTime(session.totalFocusSeconds);
    distractionTime.textContent = formatTime(session.totalDistractionSeconds);

  } catch (error) {
    console.error('Error updating popup:', error);
    statusDot.className = 'status-dot inactive';
    statusText.textContent = 'Error';
  }
}

// Update on load
updatePopup();

// Refresh every 5 seconds
const interval = setInterval(updatePopup, 5000);

// Cleanup on close
window.addEventListener('unload', () => {
  clearInterval(interval);
});

// Open dashboard link
document.getElementById('dashboard-link').addEventListener('click', async (e) => {
  e.preventDefault();
  const result = await chrome.storage.local.get(['apiBaseUrl']);
  const apiBaseUrl = result.apiBaseUrl || 'http://localhost:3000';
  chrome.tabs.create({ url: `${apiBaseUrl}/dashboard` });
});

// Open settings link
document.getElementById('settings-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
