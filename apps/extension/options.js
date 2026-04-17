// Focus OS Extension - Options Page Script

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settings-form');
  const apiBaseUrlInput = document.getElementById('apiBaseUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('save-btn');
  const testBtn = document.getElementById('test-btn');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  const result = await chrome.storage.local.get(['apiBaseUrl', 'apiKey']);
  apiBaseUrlInput.value = result.apiBaseUrl || 'http://localhost:3000';
  apiKeyInput.value = result.apiKey || '';

  // Show status message
  function showStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${isError ? 'error' : 'success'}`;
    statusDiv.style.display = 'block';

    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  // Save settings
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const apiBaseUrl = apiBaseUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!apiBaseUrl) {
      showStatus('API Base URL is required', true);
      return;
    }

    if (!apiKey) {
      showStatus('API Key is required', true);
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await chrome.storage.local.set({ apiBaseUrl, apiKey });
      showStatus('Settings saved successfully!');
    } catch (error) {
      showStatus('Failed to save settings', true);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Settings';
    }
  });

  // Test connection
  testBtn.addEventListener('click', async () => {
    const apiBaseUrl = apiBaseUrlInput.value.trim() || 'http://localhost:3000';
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('Please enter an API Key first', true);
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';

    try {
      const response = await fetch(`${apiBaseUrl}/api/sessions/active`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (response.ok) {
        showStatus('Connection successful!');
      } else if (response.status === 401) {
        showStatus('Invalid API Key', true);
      } else {
        showStatus(`Connection failed: ${response.status}`, true);
      }
    } catch (error) {
      showStatus(`Connection failed: ${error.message}`, true);
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Test Connection';
    }
  });
});
