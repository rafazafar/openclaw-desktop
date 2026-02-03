import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createManagerServer } from './server.js';
import type { GatewayController } from './gateway.js';

function listen(server: ReturnType<typeof createManagerServer>): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('unexpected address');
      const url = `http://127.0.0.1:${addr.port}`;
      resolve({
        url,
        close: () => new Promise((r, rej) => server.close((err) => (err ? rej(err) : r())))
      });
    });
  });
}

function createStateStoreStub(overrides?: Partial<any>) {
  return {
    getState: vi.fn(async () => ({ schemaVersion: 1 as const, integrations: { telegram: {} } })),
    writeState: vi.fn(async () => undefined),
    getTelegramConnection: vi.fn(async () => ({ integrationId: 'telegram' as const, connected: false })),
    setTelegramToken: vi.fn(async () => undefined),
    setTelegramError: vi.fn(async () => undefined),
    clearTelegram: vi.fn(async () => undefined),
    getGmailOauthCredsSummary: vi.fn(async () => ({ configured: false })),
    setGmailOauthCreds: vi.fn(async () => undefined),
    clearGmailOauthCreds: vi.fn(async () => undefined),
    getPermissions: vi.fn(async () => ({ catalog: [], enabled: {} })),
    setPermission: vi.fn(async () => undefined),
    resetPermissions: vi.fn(async () => undefined),
    getConfirmBeforeSendPolicy: vi.fn(async () => ({ enabled: { telegram: true, gmail: true } })),
    setConfirmBeforeSendPolicy: vi.fn(async () => undefined),
    ...(overrides ?? {})
  };
}

function createAuditLogStub(overrides?: Partial<any>) {
  return {
    filePath: () => 'audit.jsonl',
    append: vi.fn(async () => undefined),
    readRecent: vi.fn(async () => ({ lines: [], events: [], truncated: false })),
    ...(overrides ?? {})
  };
}

describe('manager server', () => {
  it('requires auth token', async () => {
    const server = createManagerServer({ authToken: 'secret' });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/status`);
    expect(res.status).toBe(401);

    await close();
  });

  it('GET /status returns gateway status from controller', async () => {
    const gateway: GatewayController = {
      status: vi.fn(async () => ({ status: 'running' as const })),
      start: vi.fn(async () => ({ status: 'running' as const })),
      stop: vi.fn(async () => ({ status: 'stopped' as const })),
      restart: vi.fn(async () => ({ status: 'running' as const }))
    };

    const stateStore = createStateStoreStub();

    const server = createManagerServer({ authToken: 'secret', gateway, stateStore });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/status`, {
      headers: { 'x-openclaw-token': 'secret' }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      gateway: { status: 'running' },
      integrations: { telegram: { integrationId: 'telegram', connected: false } }
    });
    expect(gateway.status).toHaveBeenCalledTimes(1);

    await close();
  });

  it('POST /gateway/start calls controller start', async () => {
    const gateway: GatewayController = {
      status: vi.fn(async () => ({ status: 'stopped' as const })),
      start: vi.fn(async () => ({ status: 'running' as const })),
      stop: vi.fn(async () => ({ status: 'stopped' as const })),
      restart: vi.fn(async () => ({ status: 'running' as const }))
    };

    const auditLog = createAuditLogStub();
    const server = createManagerServer({ authToken: 'secret', gateway, auditLog });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/gateway/start`, {
      method: 'POST',
      headers: { 'x-openclaw-token': 'secret' }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, gateway: { status: 'running' } });
    expect(gateway.start).toHaveBeenCalledTimes(1);

    await close();
  });

  it('POST /integrations/telegram/connect validates token and persists it', async () => {
    const telegramFetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, result: { username: 'my_bot' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    const stateStore = createStateStoreStub({
      getTelegramConnection: vi.fn(async () => ({ integrationId: 'telegram' as const, connected: true }))
    });

    const auditLog = createAuditLogStub();
    const server = createManagerServer({ authToken: 'secret', stateStore, telegramFetch, auditLog });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/integrations/telegram/connect`, {
      method: 'POST',
      headers: { 'x-openclaw-token': 'secret', 'content-type': 'application/json' },
      body: JSON.stringify({ token: '123456:ABCDEF_1234567890' })
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, integrations: { telegram: { integrationId: 'telegram', connected: true } } });
    expect(stateStore.setTelegramToken).toHaveBeenCalledTimes(1);
    expect(telegramFetch).toHaveBeenCalledTimes(1);

    await close();
  });

  it('POST /integrations/telegram/connect rejects invalid token format', async () => {
    const stateStore = createStateStoreStub();

    const auditLog = createAuditLogStub();
    const server = createManagerServer({ authToken: 'secret', stateStore, auditLog });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/integrations/telegram/connect`, {
      method: 'POST',
      headers: { 'x-openclaw-token': 'secret', 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'not-a-token' })
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: 'invalid_token' });
    expect(stateStore.setTelegramError).toHaveBeenCalledTimes(1);

    await close();
  });

  it('POST /integrations/telegram/disconnect clears telegram state', async () => {
    const stateStore = createStateStoreStub({
      getState: vi.fn(async () => ({ schemaVersion: 1 as const, integrations: { telegram: { token: '123:ABC' } } }))
    });

    const auditLog = createAuditLogStub();
    const server = createManagerServer({ authToken: 'secret', stateStore, auditLog });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/integrations/telegram/disconnect`, {
      method: 'POST',
      headers: { 'x-openclaw-token': 'secret' }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, integrations: { telegram: { integrationId: 'telegram', connected: false } } });
    expect(stateStore.clearTelegram).toHaveBeenCalledTimes(1);

    await close();
  });

  it('GET /logs/recent returns last N lines from the resolved log file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-desktop-test-'));
    const logPath = path.join(dir, 'gateway.log');
    await fs.writeFile(logPath, ['one', 'two', 'three'].join('\n'), 'utf8');

    const server = createManagerServer({
      authToken: 'secret',
      logFileResolver: async () => logPath
    });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/logs/recent?lines=2`, {
      headers: { 'x-openclaw-token': 'secret' }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.logs.available).toBe(true);
    expect(body.logs.file).toBe(logPath);
    expect(body.logs.lines).toEqual(['two', 'three']);

    await close();
  });

  it('POST /diagnostics/run returns a checklist summary', async () => {
    const gateway: GatewayController = {
      status: vi.fn(async () => ({ status: 'running' as const })),
      start: vi.fn(async () => ({ status: 'running' as const })),
      stop: vi.fn(async () => ({ status: 'stopped' as const })),
      restart: vi.fn(async () => ({ status: 'running' as const }))
    };

    const stateStore = createStateStoreStub();

    const auditLog = createAuditLogStub();
    const server = createManagerServer({
      authToken: 'secret',
      gateway,
      stateStore,
      logFileResolver: async () => null,
      auditLog
    });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/diagnostics/run`, {
      method: 'POST',
      headers: { 'x-openclaw-token': 'secret' }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.summary.overall).toBe('warn');
    expect(Array.isArray(body.checks)).toBe(true);
    expect(body.checks.some((c: any) => c.id === 'gateway.status')).toBe(true);

    await close();
  });

  it('GET /permissions returns enabled map', async () => {
    const stateStore = createStateStoreStub({
      getPermissions: vi.fn(async () => ({
        catalog: [
          {
            id: 'gateway.control',
            title: 'Control OpenClaw Gateway',
            description: '...',
            group: 'gateway',
            risk: 'medium',
            defaultEnabled: true
          }
        ],
        enabled: { 'gateway.control': true }
      }))
    });

    const server = createManagerServer({ authToken: 'secret', stateStore });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/permissions`, {
      headers: { 'x-openclaw-token': 'secret' }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.permissions.enabled['gateway.control']).toBe(true);

    await close();
  });

  it('POST /permissions/set validates and writes permission override', async () => {
    const setPermission = vi.fn(async () => undefined);
    const getPermissions = vi.fn(async () => ({
      catalog: [],
      enabled: { 'gateway.control': false }
    }));

    const auditLog = createAuditLogStub();
    const stateStore = createStateStoreStub({ setPermission, getPermissions });
    const server = createManagerServer({ authToken: 'secret', stateStore, auditLog });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/permissions/set`, {
      method: 'POST',
      headers: { 'x-openclaw-token': 'secret', 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'gateway.control', enabled: false })
    });

    expect(res.status).toBe(200);
    expect(setPermission).toHaveBeenCalledTimes(1);
    expect(auditLog.append).toHaveBeenCalledWith({
      type: 'permissions.set',
      actor: 'desktop-ui',
      details: { id: 'gateway.control', enabled: false }
    });

    await close();
  });

  it('GET /integrations/gmail/oauth-creds returns summary without secrets', async () => {
    const stateStore = createStateStoreStub({
      getGmailOauthCredsSummary: vi.fn(async () => ({
        configured: true,
        clientIdSuffix: 'ent.com',
        updatedAt: '2026-02-04T00:00:00.000Z'
      }))
    });

    const server = createManagerServer({ authToken: 'secret', stateStore });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/integrations/gmail/oauth-creds`, {
      headers: { 'x-openclaw-token': 'secret' }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.gmail.oauthCreds.configured).toBe(true);
    // Should not include any secret fields.
    expect(body.gmail.oauthCreds.clientSecret).toBeUndefined();

    await close();
  });

  it('POST /integrations/gmail/oauth-creds/set persists creds', async () => {
    const setGmailOauthCreds = vi.fn(async () => undefined);
    const stateStore = createStateStoreStub({
      setGmailOauthCreds,
      getGmailOauthCredsSummary: vi.fn(async () => ({ configured: true, clientIdSuffix: 'ent.com' }))
    });

    const auditLog = createAuditLogStub();
    const server = createManagerServer({ authToken: 'secret', stateStore, auditLog });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/integrations/gmail/oauth-creds/set`, {
      method: 'POST',
      headers: { 'x-openclaw-token': 'secret', 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: 'abc.apps.googleusercontent.com', clientSecret: 'shhh' })
    });

    expect(res.status).toBe(200);
    expect(setGmailOauthCreds).toHaveBeenCalledWith('abc.apps.googleusercontent.com', 'shhh');

    await close();
  });

  it('POST /integrations/gmail/oauth-creds/set validates required fields', async () => {
    const stateStore = createStateStoreStub();

    const server = createManagerServer({ authToken: 'secret', stateStore });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/integrations/gmail/oauth-creds/set`, {
      method: 'POST',
      headers: { 'x-openclaw-token': 'secret', 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: '', clientSecret: '' })
    });

    expect(res.status).toBe(400);

    await close();
  });

  it('GET /audit/recent returns parsed audit events', async () => {
    const auditLog = createAuditLogStub({
      filePath: () => 'C:/tmp/audit.jsonl',
      readRecent: vi.fn(async () => ({
        lines: [],
        truncated: false,
        events: [
          { ts: '2026-02-04T00:00:00.000Z', type: 'permissions.set', actor: 'desktop-ui', details: { id: 'x', enabled: true } }
        ]
      }))
    });

    const server = createManagerServer({ authToken: 'secret', auditLog });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/audit/recent?lines=10`, {
      headers: { 'x-openclaw-token': 'secret' }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.audit.file).toBe('C:/tmp/audit.jsonl');
    expect(body.audit.events.length).toBe(1);

    await close();
  });

  it('GET /policies returns confirm-before-send state', async () => {
    const stateStore = createStateStoreStub({
      getConfirmBeforeSendPolicy: vi.fn(async () => ({ enabled: { telegram: false, gmail: true } }))
    });

    const server = createManagerServer({ authToken: 'secret', stateStore });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/policies`, {
      headers: { 'x-openclaw-token': 'secret' }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      policies: {
        confirmBeforeSend: { enabled: { telegram: false, gmail: true } }
      }
    });

    await close();
  });

  it('POST /policies/confirm-before-send/set updates policy', async () => {
    const setConfirmBeforeSendPolicy = vi.fn(async () => undefined);
    const getConfirmBeforeSendPolicy = vi.fn(async () => ({ enabled: { telegram: true, gmail: true } }));

    const stateStore = createStateStoreStub({
      setConfirmBeforeSendPolicy,
      getConfirmBeforeSendPolicy
    });

    const auditLog = createAuditLogStub();
    const server = createManagerServer({ authToken: 'secret', stateStore, auditLog });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/policies/confirm-before-send/set`, {
      method: 'POST',
      headers: { 'x-openclaw-token': 'secret', 'content-type': 'application/json' },
      body: JSON.stringify({ integrationId: 'telegram', enabled: true })
    });

    expect(res.status).toBe(200);
    expect(setConfirmBeforeSendPolicy).toHaveBeenCalledTimes(1);

    await close();
  });
});
