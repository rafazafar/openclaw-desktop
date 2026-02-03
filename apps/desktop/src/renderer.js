const statusEl = document.getElementById('status');
const hintEl = document.getElementById('hint');
const rawEl = document.getElementById('raw');
const refreshBtn = document.getElementById('refresh');
const toggleBtn = document.getElementById('toggle');

/** @type {any | null} */
let lastStatus = null;
/** @type {ReturnType<typeof setInterval> | null} */
let pollTimer = null;

function setHint(text) {
  hintEl.textContent = text;
}

function setStatusText(text) {
  statusEl.textContent = text;
}

function setRaw(data) {
  rawEl.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

function applyGatewayState(gateway) {
  const status = gateway?.status ?? 'unknown';
  setStatusText(status);

  const inFlight = status === 'starting' || status === 'stopping';
  toggleBtn.disabled = inFlight;

  if (status === 'running') {
    toggleBtn.textContent = 'Turn Off';
    setHint('Gateway is running. Auto-refreshing every 2s.');
  } else if (status === 'stopped') {
    toggleBtn.textContent = 'Turn On';
    setHint('Gateway is stopped. Auto-refreshing every 2s.');
  } else if (status === 'starting') {
    toggleBtn.textContent = 'Starting…';
    setHint('Starting gateway…');
  } else if (status === 'stopping') {
    toggleBtn.textContent = 'Stopping…';
    setHint('Stopping gateway…');
  } else {
    toggleBtn.textContent = 'Toggle';
    const err = gateway?.lastError?.message;
    setHint(err ? `Gateway error: ${err}` : 'Auto-refreshing every 2s.');
  }
}

async function refreshStatus({ quiet = false } = {}) {
  if (!quiet) {
    refreshBtn.disabled = true;
    toggleBtn.disabled = true;
    setHint('Loading…');
  }

  try {
    const data = await window.openclaw.status();
    lastStatus = data;

    applyGatewayState(data?.gateway);
    setRaw(data);

    // Refresh button should always be usable.
    refreshBtn.disabled = false;
  } catch (err) {
    lastStatus = null;
    setStatusText('error');
    setRaw(String(err?.message ?? err));
    setHint('Failed to reach manager. Is @openclaw/manager running?');
    refreshBtn.disabled = false;
    toggleBtn.disabled = false;
    toggleBtn.textContent = 'Toggle';
  }
}

async function toggleGateway() {
  const current = lastStatus?.gateway?.status;

  // If we don't know, start by fetching a fresh status.
  if (!current) return refreshStatus();

  // Don't fight transitions; let polling settle it.
  if (current === 'starting' || current === 'stopping') return;

  refreshBtn.disabled = true;
  toggleBtn.disabled = true;

  try {
    if (current === 'running') {
      setStatusText('stopping');
      setHint('Stopping gateway…');
      const data = await window.openclaw.gatewayStop();
      lastStatus = data;
      applyGatewayState(data?.gateway);
      setRaw(data);
    } else {
      setStatusText('starting');
      setHint('Starting gateway…');
      const data = await window.openclaw.gatewayStart();
      lastStatus = data;
      applyGatewayState(data?.gateway);
      setRaw(data);
    }
  } catch (err) {
    setStatusText('error');
    setRaw(String(err?.message ?? err));
    setHint('Gateway action failed. Check manager logs.');
    toggleBtn.disabled = false;
  } finally {
    refreshBtn.disabled = false;
  }
}

refreshBtn.addEventListener('click', () => refreshStatus());
toggleBtn.addEventListener('click', toggleGateway);

// Auto-load once, then poll.
refreshStatus();
pollTimer = setInterval(() => refreshStatus({ quiet: true }), 2000);
