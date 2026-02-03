import { contextBridge } from 'electron';

const DEFAULT_MANAGER_URL = 'http://127.0.0.1:3210';
const DEFAULT_TOKEN = 'dev-token';

async function managerFetch(path, init = {}) {
  const baseUrl = process.env.OPENCLAW_MANAGER_URL ?? DEFAULT_MANAGER_URL;
  const token = process.env.OPENCLAW_MANAGER_TOKEN ?? DEFAULT_TOKEN;

  const url = new URL(path, baseUrl);
  const headers = new Headers(init.headers ?? {});
  headers.set('x-openclaw-token', token);

  const res = await fetch(url, { ...init, headers });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error ? String(json.error) : `http_${res.status}`;
    throw new Error(msg);
  }
  return json;
}

contextBridge.exposeInMainWorld('openclaw', {
  status: async () => managerFetch('/status'),
  gatewayStart: async () => managerFetch('/gateway/start', { method: 'POST' }),
  gatewayStop: async () => managerFetch('/gateway/stop', { method: 'POST' }),
  gatewayRestart: async () => managerFetch('/gateway/restart', { method: 'POST' }),
  telegramConnect: async (token) =>
    managerFetch('/integrations/telegram/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token })
    }),
  telegramDisconnect: async () =>
    managerFetch('/integrations/telegram/disconnect', { method: 'POST' }),
  logsRecent: async (lines = 200) =>
    managerFetch(`/logs/recent?lines=${encodeURIComponent(String(lines))}`),

  permissionsGet: async () => managerFetch('/permissions'),
  permissionSet: async (id, enabled) =>
    managerFetch('/permissions/set', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, enabled })
    }),
  permissionsReset: async () => managerFetch('/permissions/reset', { method: 'POST' }),

  policiesGet: async () => managerFetch('/policies'),
  confirmBeforeSendSet: async (integrationId, enabled) =>
    managerFetch('/policies/confirm-before-send/set', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ integrationId, enabled })
    }),

  gmailOauthCredsGet: async () => managerFetch('/integrations/gmail/oauth-creds'),
  gmailOauthCredsSet: async (clientId, clientSecret) =>
    managerFetch('/integrations/gmail/oauth-creds/set', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret })
    }),
  gmailOauthCredsClear: async () =>
    managerFetch('/integrations/gmail/oauth-creds/clear', { method: 'POST' }),

  gmailOauthStatus: async () => managerFetch('/integrations/gmail/oauth/status'),
  gmailOauthStart: async () => managerFetch('/integrations/gmail/oauth/start', { method: 'POST' }),
  gmailOauthClear: async () => managerFetch('/integrations/gmail/oauth/clear', { method: 'POST' }),

  openExternal: async (url) => {
    const { shell } = await import('electron');
    await shell.openExternal(String(url));
  }
});
