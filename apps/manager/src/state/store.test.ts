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
