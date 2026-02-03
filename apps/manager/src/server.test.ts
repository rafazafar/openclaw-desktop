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
      status: vi.fn(async () => ({ status: 'running' })),
      start: vi.fn(async () => ({ status: 'running' })),
      stop: vi.fn(async () => ({ status: 'stopped' })),
      restart: vi.fn(async () => ({ status: 'running' }))
    };

    const server = createManagerServer({ authToken: 'secret', gateway });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/status`, {
      headers: { 'x-openclaw-token': 'secret' }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, gateway: { status: 'running' } });
    expect(gateway.status).toHaveBeenCalledTimes(1);

    await close();
  });

  it('POST /gateway/start calls controller start', async () => {
    const gateway: GatewayController = {
      status: vi.fn(async () => ({ status: 'stopped' })),
      start: vi.fn(async () => ({ status: 'running' })),
      stop: vi.fn(async () => ({ status: 'stopped' })),
      restart: vi.fn(async () => ({ status: 'running' }))
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
});
