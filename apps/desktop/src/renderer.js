const statusEl = document.getElementById('status');
const hintEl = document.getElementById('hint');
const rawEl = document.getElementById('raw');
const refreshBtn = document.getElementById('refresh');
const toggleBtn = document.getElementById('toggle');

async function refresh() {
  refreshBtn.disabled = true;
  toggleBtn.disabled = true;
  hintEl.textContent = 'Loading…';

  try {
    const data = await window.openclaw.status();
    statusEl.textContent = data?.gateway?.status ?? 'unknown';
    rawEl.textContent = JSON.stringify(data, null, 2);
    hintEl.textContent = 'OK';
  } catch (err) {
    statusEl.textContent = 'error';
    rawEl.textContent = String(err?.message ?? err);
    hintEl.textContent = 'Failed to reach manager. Is @openclaw/manager running?';
  } finally {
    refreshBtn.disabled = false;
    toggleBtn.disabled = false;
  }
}

refreshBtn.addEventListener('click', refresh);

// Stub: lifecycle endpoints land in T1.1.
// For now, On/Off just refreshes status so the UI wiring exists.
toggleBtn.addEventListener('click', refresh);

// Auto-load once.
refresh();
