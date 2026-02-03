import { describe, expect, it } from 'vitest';
import { createManagerServer } from './server.js';

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

  it('GET /status returns stubbed gateway status', async () => {
    const server = createManagerServer({ authToken: 'secret' });
    const { url, close } = await listen(server);

    const res = await fetch(`${url}/status`, {
      headers: { 'x-openclaw-token': 'secret' }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, gateway: { status: 'stopped' } });

    await close();
  });
});
