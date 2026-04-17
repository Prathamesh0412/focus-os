// Focus OS Options Script
const DEFAULT_BLOCKED_DOMAINS = [
  'facebook.com', 'twitter.com', 'instagram.com', 'youtube.com',
  'reddit.com', 'tiktok.com', 'netflix.com', 'twitch.tv'
];

// Load settings on page load
document.addEventListener('DOMContentLoaded', loadSettings);

async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get([
      'blockedDomains',
      'warningDelay',
      'autoCloseDelay',
      'apiUrl',
      'apiKey'
    ]);

    // Load blocked domains
    const domains = settings.blockedDomains || DEFAULT_BLOCKED_DOMAINS;
    document.getElementById('blockedDomainsList').innerHTML = domains
      .map(domain => `
        <div class="domain-item">
          <span>${domain}</span>
          <button class="remove-btn" onclick="removeDomain('${domain}')">Remove</button>
        </div>
      `).join('');

    // Load other settings
    document.getElementById('warningDelay').value = settings.warningDelay || 5000;
    document.getElementById('autoCloseDelay').value = settings.autoCloseDelay || 10000;
    document.getElementById('apiUrl').value = settings.apiUrl || 'http://localhost:3001';
    document.getElementById('apiKey').value = settings.apiKey || '02313202e4207fed50089c8e7d99be82c85f3f8f2cc42e9b9d9ebe8b9fca6f3c';

  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings() {
  try {
    // Get blocked domains
    const domainElements = document.querySelectorAll('#blockedDomainsList .domain-item span');
    const blockedDomains = Array.from(domainElements).map(el => el.textContent);

    // Get other settings
    const settings = {
      blockedDomains,
      warningDelay: parseInt(document.getElementById('warningDelay').value),
      autoCloseDelay: parseInt(document.getElementById('autoCloseDelay').value),
      apiUrl: document.getElementById('apiUrl').value,
      apiKey: document.getElementById('apiKey').value
    };

    await chrome.storage.sync.set(settings);

    // Show success message
    const statusEl = document.getElementById('status');
    statusEl.style.display = 'block';
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);

  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

async function addDomain() {
  const input = document.getElementById('newDomain');
  const domain = input.value.trim().toLowerCase();

  if (!domain) return;

  try {
    const settings = await chrome.storage.sync.get(['blockedDomains']);
    const blockedDomains = settings.blockedDomains || DEFAULT_BLOCKED_DOMAINS;

    if (!blockedDomains.includes(domain)) {
      blockedDomains.push(domain);
      await chrome.storage.sync.set({ blockedDomains });
      
      // Add to UI
      const listEl = document.getElementById('blockedDomainsList');
      const domainEl = document.createElement('div');
      domainEl.className = 'domain-item';
      domainEl.innerHTML = `
        <span>${domain}</span>
        <button class="remove-btn" onclick="removeDomain('${domain}')">Remove</button>
      `;
      listEl.appendChild(domainEl);

      // Clear input
      input.value = '';
    }
  } catch (error) {
    console.error('Error adding domain:', error);
  }
}

async function removeDomain(domain) {
  try {
    const settings = await chrome.storage.sync.get(['blockedDomains']);
    let blockedDomains = settings.blockedDomains || DEFAULT_BLOCKED_DOMAINS;
    
    blockedDomains = blockedDomains.filter(d => d !== domain);
    await chrome.storage.sync.set({ blockedDomains });
    
    // Reload UI
    loadSettings();
  } catch (error) {
    console.error('Error removing domain:', error);
  }
}

async function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    try {
      await chrome.storage.sync.set({
        blockedDomains: DEFAULT_BLOCKED_DOMAINS,
        warningDelay: 5000,
        autoCloseDelay: 10000,
        apiUrl: 'http://localhost:3001',
        apiKey: '02313202e4207fed50089c8e7d99be82c85f3f8f2cc42e9b9d9ebe8b9fca6f3c'
      });
      
      // Reload UI
      loadSettings();
    } catch (error) {
      console.error('Error resetting settings:', error);
    }
  }
}
