// Focus OS Popup Script
document.addEventListener('DOMContentLoaded', async () => {
  const startFocusBtn = document.getElementById('startFocus');
  const stopFocusBtn = document.getElementById('stopFocus');
  const openDashboardBtn = document.getElementById('openDashboard');
  const focusModeStatus = document.getElementById('focusModeStatus');
  const sessionStatus = document.getElementById('sessionStatus');
  const currentSiteDiv = document.getElementById('currentSite');
  const currentDomainSpan = document.getElementById('currentDomain');

  // Load initial status and check tabs
  await updateStatus();
  await chrome.runtime.sendMessage({ action: 'checkTabs' });

  // Event listeners
  startFocusBtn.addEventListener('click', async () => {
    // Open tab selector window
    chrome.windows.create({
      url: chrome.runtime.getURL('tabselector.html'),
      type: 'popup',
      width: 400,
      height: 500,
      focused: true
    });
    
    // Close popup
    window.close();
  });

  stopFocusBtn.addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({ action: 'stopFocusMode' });
    if (response.success) {
      await updateStatus();
    }
  });

  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:8080' });
  });

  // Update status display
  async function updateStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
      const status = response;

      // Update focus mode status
      if (status.focusMode) {
        focusModeStatus.textContent = 'Active';
        focusModeStatus.className = 'status-value status-active';
        startFocusBtn.style.display = 'none';
        stopFocusBtn.style.display = 'block';
      } else {
        focusModeStatus.textContent = 'Inactive';
        focusModeStatus.className = 'status-value status-inactive';
        startFocusBtn.style.display = 'block';
        stopFocusBtn.style.display = 'none';
      }

      // Update session status
      if (status.activeSession) {
        sessionStatus.textContent = 'Active';
        sessionStatus.className = 'status-value status-active';
      } else {
        sessionStatus.textContent = 'None';
        sessionStatus.className = 'status-value status-inactive';
      }

      // Update current site
      if (status.currentDomain) {
        currentDomainSpan.textContent = status.currentDomain;
        currentSiteDiv.style.display = 'block';
      } else {
        currentSiteDiv.style.display = 'none';
      }

    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  // Update status every 2 seconds
  setInterval(updateStatus, 2000);
});
