const statusEl = document.getElementById('status');
const hintEl = document.getElementById('hint');
const rawEl = document.getElementById('raw');
const refreshBtn = document.getElementById('refresh');
const toggleBtn = document.getElementById('toggle');

const telegramStateEl = document.getElementById('telegram-state');
const telegramHintEl = document.getElementById('telegram-hint');
const telegramTokenEl = document.getElementById('telegram-token');
const telegramConnectBtn = document.getElementById('telegram-connect');
const telegramDisconnectBtn = document.getElementById('telegram-disconnect');

const logsEl = document.getElementById('logs');
const logsHintEl = document.getElementById('logs-hint');
const logsRefreshBtn = document.getElementById('logs-refresh');
const logsCopyBtn = document.getElementById('logs-copy');

/** @type {any | null} */
let lastStatus = null;
/** @type {ReturnType<typeof setInterval> | null} */
let pollTimer = null;
/** @type {ReturnType<typeof setInterval> | null} */
let logsTimer = null;

let lastLogsText = '';

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

function applyTelegramState(telegram) {
  const connected = Boolean(telegram?.connected);
  telegramStateEl.textContent = connected ? 'connected' : 'not connected';

  if (connected) {
    const label = telegram?.accountLabel ? ` (${telegram.accountLabel})` : '';
    telegramHintEl.textContent = `Telegram is connected${label}.`;
    telegramConnectBtn.disabled = true;
    telegramDisconnectBtn.disabled = false;
    telegramTokenEl.disabled = true;
    telegramTokenEl.value = '';
  } else {
    telegramConnectBtn.disabled = false;
    telegramDisconnectBtn.disabled = true;
    telegramTokenEl.disabled = false;
    const err = telegram?.lastError
      ? `Last error: ${telegram.lastError}`
      : 'Connect a bot token to use Telegram as the chat surface.';
    telegramHintEl.textContent = err;
  }
}

async function refreshLogs({ quiet = false } = {}) {
  if (!quiet) {
    logsRefreshBtn.disabled = true;
    logsHintEl.textContent = 'Loading logs…';
  }

  try {
    const data = await window.openclaw.logsRecent(200);
    const logs = data?.logs;

    if (!logs?.available) {
      lastLogsText = '';
      logsEl.textContent = '';
      const file = logs?.file ? ` (${logs.file})` : '';
      const err = logs?.error ? `: ${logs.error}` : '';
      logsHintEl.textContent = `Logs unavailable${file}${err}`;
      return;
    }

    const file = logs.file ? ` — ${logs.file}` : '';
    const trunc = logs.truncated ? ' (tail)' : '';
    logsHintEl.textContent = `Recent gateway logs${trunc}${file}`;

    lastLogsText = Array.isArray(logs.lines) ? logs.lines.join('\n') : '';
    logsEl.textContent = lastLogsText;
  } catch (err) {
    lastLogsText = '';
    logsEl.textContent = '';
    logsHintEl.textContent = `Failed to load logs: ${String(err?.message ?? err)}`;
  } finally {
    logsRefreshBtn.disabled = false;
  }
}

async function copyLogs() {
  if (!lastLogsText) {
    logsHintEl.textContent = 'No logs to copy.';
    return;
  }

  try {
    await navigator.clipboard.writeText(lastLogsText);
    logsHintEl.textContent = 'Copied logs to clipboard.';
  } catch (err) {
    logsHintEl.textContent = `Copy failed: ${String(err?.message ?? err)}`;
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
    applyTelegramState(data?.integrations?.telegram);
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

async function connectTelegram() {
  const token = String(telegramTokenEl.value ?? '').trim();
  if (!token) {
    telegramHintEl.textContent = 'Enter a bot token first.';
    return;
  }

  telegramConnectBtn.disabled = true;
  telegramDisconnectBtn.disabled = true;
  telegramHintEl.textContent = 'Validating token…';

  try {
    const data = await window.openclaw.telegramConnect(token);
    lastStatus = { ...(lastStatus ?? {}), ...data };
    await refreshStatus({ quiet: true });
  } catch (err) {
    telegramConnectBtn.disabled = false;
    telegramDisconnectBtn.disabled = false;
    telegramHintEl.textContent = `Failed to connect: ${String(err?.message ?? err)}`;
  }
}

async function disconnectTelegram() {
  telegramConnectBtn.disabled = true;
  telegramDisconnectBtn.disabled = true;
  telegramHintEl.textContent = 'Disconnecting…';

  try {
    const data = await window.openclaw.telegramDisconnect();
    lastStatus = { ...(lastStatus ?? {}), ...data };
    await refreshStatus({ quiet: true });
  } catch (err) {
    telegramHintEl.textContent = `Failed to disconnect: ${String(err?.message ?? err)}`;
    telegramConnectBtn.disabled = false;
    telegramDisconnectBtn.disabled = false;
  }
}

refreshBtn.addEventListener('click', () => refreshStatus());
toggleBtn.addEventListener('click', toggleGateway);
telegramConnectBtn.addEventListener('click', connectTelegram);
telegramDisconnectBtn.addEventListener('click', disconnectTelegram);
telegramTokenEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') void connectTelegram();
});

logsRefreshBtn.addEventListener('click', () => refreshLogs());
logsCopyBtn.addEventListener('click', copyLogs);

// Auto-load once, then poll.
refreshStatus();
refreshLogs({ quiet: true });

pollTimer = setInterval(() => refreshStatus({ quiet: true }), 2000);
logsTimer = setInterval(() => refreshLogs({ quiet: true }), 5000);
