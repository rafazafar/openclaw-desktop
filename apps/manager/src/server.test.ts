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

    const stateStore = {
      getState: vi.fn(async () => ({ schemaVersion: 1 as const, integrations: { telegram: {} } })),
      writeState: vi.fn(async () => undefined),
      getTelegramConnection: vi.fn(async () => ({ integrationId: 'telegram' as const, connected: false })),
      setTelegramToken: vi.fn(async () => undefined),
      setTelegramError: vi.fn(async () => undefined),
      clearTelegram: vi.fn(async () => undefined)
    };

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

    const server = createManagerServer({ authToken: 'secret', gateway });
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

    const stateStore = {
      getState: vi.fn(async () => ({ schemaVersion: 1 as const, integrations: { telegram: {} } })),
      writeState: vi.fn(async () => undefined),
      getTelegramConnection: vi.fn(async () => ({ integrationId: 'telegram' as const, connected: true })),
      setTelegramToken: vi.fn(async () => undefined),
      setTelegramError: vi.fn(async () => undefined),
      clearTelegram: vi.fn(async () => undefined)
    };

    const server = createManagerServer({ authToken: 'secret', stateStore, telegramFetch });
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
    const stateStore = {
      getState: vi.fn(async () => ({ schemaVersion: 1 as const, integrations: { telegram: {} } })),
      writeState: vi.fn(async () => undefined),
      getTelegramConnection: vi.fn(async () => ({ integrationId: 'telegram' as const, connected: false })),
      setTelegramToken: vi.fn(async () => undefined),
      setTelegramError: vi.fn(async () => undefined),
      clearTelegram: vi.fn(async () => undefined)
    };

    const server = createManagerServer({ authToken: 'secret', stateStore });
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
});
