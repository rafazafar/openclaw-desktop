import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createStateStore } from './store.js';

async function mkTempDir(): Promise<string> {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-desktop-'));
  return base;
}

describe('state store', () => {
  const created: string[] = [];

  afterEach(async () => {
    await Promise.all(
      created.map(async (dir) => {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      })
    );
    created.length = 0;
  });

  it('starts with default state and persists telegram token (not exposed in connection status)', async () => {
    const dir = await mkTempDir();
    created.push(dir);

    const store = createStateStore({ dataDir: dir });

    const initial = await store.getState();
    expect(initial.schemaVersion).toBe(1);
    expect(initial.integrations.telegram).toEqual({});

    await store.setTelegramToken('123:ABC');

    const saved = await store.getState();
    expect(saved.integrations.telegram.token).toBe('123:ABC');

    const conn = await store.getTelegramConnection();
    expect(conn).toEqual({
      integrationId: 'telegram',
      connected: true,
      connectedAt: expect.any(String),
      lastValidatedAt: expect.any(String),
      needsAttention: false,
      lastError: undefined
    });

    // Also writes a minimal, non-secret OpenClaw config artifact.
    const generatedPath = path.join(dir, 'openclaw.generated.json');
    const generatedRaw = await fs.readFile(generatedPath, 'utf8');
    expect(generatedRaw).toContain('generatedBy');
    expect(generatedRaw).toContain('openclaw-desktop');
    expect(generatedRaw).not.toContain('123:ABC');
    const generated = JSON.parse(generatedRaw) as any;
    expect(generated.channels.telegram.enabled).toBe(true);
  });

  it('writes permissions + policy into generated config (hooks for enforcement)', async () => {
    const dir = await mkTempDir();
    created.push(dir);

    const store = createStateStore({ dataDir: dir });

    // Defaults: telegram.send is false, but confirm-before-send is true (safe default).
    await store.setTelegramToken('123:ABC');

    const generatedPath = path.join(dir, 'openclaw.generated.json');
    const generatedV1 = JSON.parse(await fs.readFile(generatedPath, 'utf8')) as any;

    expect(generatedV1.permissions).toBeTruthy();
    expect(generatedV1.permissions['telegram.send']).toBe(false);
    expect(generatedV1.policy?.confirmBeforeSend?.telegram).toBe(true);
    expect(generatedV1.channels?.telegram?.allowSend).toBe(false);

    // Enabling send should flip allowSend.
    await store.setPermission('telegram.send', true);
    const generatedV2 = JSON.parse(await fs.readFile(generatedPath, 'utf8')) as any;
    expect(generatedV2.permissions['telegram.send']).toBe(true);
    expect(generatedV2.channels.telegram.allowSend).toBe(true);

    // User can also disable confirm-before-send explicitly.
    await store.setConfirmBeforeSendPolicy('telegram', false);
    const generatedV3 = JSON.parse(await fs.readFile(generatedPath, 'utf8')) as any;
    expect(generatedV3.policy.confirmBeforeSend.telegram).toBe(false);
  });

  it('writes gmail integration config without secrets and gates allowRead by permission', async () => {
    const dir = await mkTempDir();
    created.push(dir);

    const store = createStateStore({ dataDir: dir });

    await store.setGmailOauthTokens({
      accessToken: 'ya29.secret-access-token',
      refreshToken: '1//refresh',
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      accountEmail: 'user@example.com'
    });

    const generatedPath = path.join(dir, 'openclaw.generated.json');
    const generatedRaw = await fs.readFile(generatedPath, 'utf8');

    // Never write secrets to generated config.
    expect(generatedRaw).not.toContain('ya29.secret-access-token');
    expect(generatedRaw).not.toContain('1//refresh');

    const generatedV1 = JSON.parse(generatedRaw) as any;
    expect(generatedV1.integrations?.gmail?.enabled).toBe(true);
    expect(generatedV1.integrations?.gmail?.tokenRef).toBe('openclaw-desktop:gmailOauthTokens');
    expect(generatedV1.integrations?.gmail?.accountEmail).toBe('user@example.com');

    // Default permission is off.
    expect(generatedV1.integrations?.gmail?.allowRead).toBe(false);

    await store.setPermission('gmail.read', true);
    const generatedV2 = JSON.parse(await fs.readFile(generatedPath, 'utf8')) as any;
    expect(generatedV2.integrations?.gmail?.allowRead).toBe(true);
  });

  it('writes state + generated config atomically with a single-file backup', async () => {
    const dir = await mkTempDir();
    created.push(dir);

    const store = createStateStore({ dataDir: dir });

    await store.setTelegramToken('123:ABC');
    const statePath = path.join(dir, 'state.json');
    const genPath = path.join(dir, 'openclaw.generated.json');

    const stateV1 = await fs.readFile(statePath, 'utf8');
    const genV1 = await fs.readFile(genPath, 'utf8');

    // Trigger a rewrite of both files (same token is OK; store updates timestamps)
    await store.setTelegramToken('123:ABC');

    const stateBak = await fs.readFile(statePath + '.bak', 'utf8');
    const genBak = await fs.readFile(genPath + '.bak', 'utf8');

    expect(stateBak).toBe(stateV1);
    expect(genBak).toBe(genV1);

    // Current files should still be valid JSON
    const stateNow = await fs.readFile(statePath, 'utf8');
    const genNow = await fs.readFile(genPath, 'utf8');
    expect(() => JSON.parse(stateNow)).not.toThrow();
    expect(() => JSON.parse(genNow)).not.toThrow();
  });

  it('clearTelegram removes token', async () => {
    const dir = await mkTempDir();
    created.push(dir);

    const store = createStateStore({ dataDir: dir });
    await store.setTelegramToken('123:ABC');
    await store.clearTelegram();

    const state = await store.getState();
    expect(state.integrations.telegram).toEqual({});

    const conn = await store.getTelegramConnection();
    expect(conn.connected).toBe(false);

    const generatedPath = path.join(dir, 'openclaw.generated.json');
    const generated = JSON.parse(await fs.readFile(generatedPath, 'utf8')) as any;
    expect(generated.channels.telegram.enabled).toBe(false);
    expect(generated.channels.telegram.tokenRef).toBeUndefined();
  });

  it('setTelegramError clears token and marks needsAttention', async () => {
    const dir = await mkTempDir();
    created.push(dir);

    const store = createStateStore({ dataDir: dir });
    await store.setTelegramToken('123:ABC');
    await store.setTelegramError('bad_token');

    const state = await store.getState();
    expect(state.integrations.telegram.token).toBeUndefined();
    expect(state.integrations.telegram.lastError).toBe('bad_token');

    const conn = await store.getTelegramConnection();
    expect(conn.connected).toBe(false);
    expect(conn.needsAttention).toBe(true);
    expect(conn.lastError).toBe('bad_token');
  });
});
