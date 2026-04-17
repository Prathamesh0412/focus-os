// Focus OS Tab Selector Script
let tabs = [];
let selectedTabs = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  await loadTabs();
  setupEventListeners();
});

async function loadTabs() {
  try {
    const allTabs = await chrome.tabs.query({});
    tabs = allTabs.filter(tab => tab.url && !tab.pinned);
    
    const container = document.getElementById('tabsContainer');
    container.innerHTML = '';
    
    tabs.forEach(tab => {
      const tabElement = createTabElement(tab);
      container.appendChild(tabElement);
    });
    
  } catch (error) {
    console.error('Error loading tabs:', error);
  }
}

function createTabElement(tab) {
  const div = document.createElement('div');
  div.className = 'tab-item';
  div.dataset.tabId = tab.id;
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'tab-checkbox';
  checkbox.checked = true; // Default to selected
  
  const info = document.createElement('div');
  info.className = 'tab-info';
  
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title || 'Untitled';
  
  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = new URL(tab.url).hostname;
  
  info.appendChild(title);
  info.appendChild(url);
  
  div.appendChild(checkbox);
  div.appendChild(info);
  
  // Add click handler
  div.addEventListener('click', (e) => {
    if (e.target.type !== 'checkbox') {
      checkbox.checked = !checkbox.checked;
    }
    updateTabSelection(tab.id, checkbox.checked);
  });
  
  checkbox.addEventListener('change', (e) => {
    updateTabSelection(tab.id, e.target.checked);
  });
  
  // Default selection
  selectedTabs.add(tab.id);
  
  return div;
}

function updateTabSelection(tabId, isSelected) {
  const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
  
  if (isSelected) {
    selectedTabs.add(tabId);
    tabElement.classList.add('selected');
  } else {
    selectedTabs.delete(tabId);
    tabElement.classList.remove('selected');
  }
  
  updateSelectAllCheckbox();
}

function setupEventListeners() {
  // Select all checkbox
  const selectAllCheckbox = document.getElementById('selectAll');
  selectAllCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    
    tabs.forEach(tab => {
      const checkbox = document.querySelector(`[data-tab-id="${tab.id}"] .tab-checkbox`);
      checkbox.checked = isChecked;
      updateTabSelection(tab.id, isChecked);
    });
  });
  
  // Cancel button
  document.getElementById('cancelBtn').addEventListener('click', () => {
    window.close();
  });
  
  // Start focus button
  document.getElementById('startFocusBtn').addEventListener('click', async () => {
    await startFocusSession();
  });
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('selectAll');
  const allSelected = tabs.length > 0 && selectedTabs.size === tabs.length;
  selectAllCheckbox.checked = allSelected;
}

async function startFocusSession() {
  try {
    // Get tabs to close (not selected)
    const tabsToClose = tabs.filter(tab => !selectedTabs.has(tab.id));
    
    // Close unselected tabs
    for (const tab of tabsToClose) {
      await chrome.tabs.remove(tab.id);
    }
    
    // Start focus mode
    await chrome.storage.sync.set({ focusMode: true });
    
    // Notify background script
    await chrome.runtime.sendMessage({ action: 'startFocusMode' });
    
    // Close this window
    window.close();
    
  } catch (error) {
    console.error('Error starting focus session:', error);
  }
}
