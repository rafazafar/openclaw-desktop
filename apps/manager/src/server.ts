import http from 'node:http';
import { URL } from 'node:url';
import { createGatewayController, type GatewayController, type GatewayState } from './gateway.js';
import { createStateStore, type IntegrationConnection, type StateStore } from './state/store.js';

export type ManagerStatusResponse = {
  ok: true;
  gateway: GatewayState;
  integrations: {
    telegram: IntegrationConnection;
  };
};

export type ManagerGatewayActionResponse = {
  ok: true;
  gateway: GatewayState;
};

export type ManagerTelegramConnectResponse = {
  ok: true;
  integrations: {
    telegram: IntegrationConnection;
  };
};

export type ManagerTelegramDisconnectResponse = {
  ok: true;
  integrations: {
    telegram: IntegrationConnection;
  };
};

export type ManagerServerOptions = {
  /** Token required in `x-openclaw-token` header. */
  authToken: string;
  /** Override for tests; defaults to OpenClaw CLI-backed controller. */
  gateway?: GatewayController;
  /** Override for tests; defaults to local JSON file store. */
  stateStore?: StateStore;
  /** Override for tests; defaults to global fetch. */
  telegramFetch?: typeof fetch;
};

function json(res: http.ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(payload);
}

function unauthorized(res: http.ServerResponse): void {
  json(res, 401, { ok: false, error: 'unauthorized' });
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c)));
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('invalid_json');
  }
}

function looksLikeTelegramToken(token: string): boolean {
  // Common bot token shape: <digits>:<35-ish chars>
  return /^\d+:[A-Za-z0-9_-]{10,}$/.test(token);
}

async function validateTelegramToken(
  fetchFn: typeof fetch,
  token: string
): Promise<{ ok: true; accountLabel?: string } | { ok: false; error: string }> {
  try {
    const res = await fetchFn(`https://api.telegram.org/bot${token}/getMe`, { method: 'GET' });
    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok) return { ok: false, error: `telegram_http_${res.status}` };
    if (!data || data.ok !== true) return { ok: false, error: 'telegram_not_ok' };
    const username = data?.result?.username;
    const firstName = data?.result?.first_name;
    const label = username ? `@${username}` : firstName ? String(firstName) : undefined;
    return { ok: true, accountLabel: label };
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'telegram_fetch_failed' };
  }
}

export function createManagerServer(opts: ManagerServerOptions): http.Server {
  const gateway = opts.gateway ?? createGatewayController();
  const stateStore = opts.stateStore ?? createStateStore();
  const telegramFetch = opts.telegramFetch ?? fetch;

  return http.createServer((req, res) => {
    void (async () => {
      const method = req.method ?? 'GET';
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');

      // Local auth: require a header token for all endpoints (MVP).
      const token = String(req.headers['x-openclaw-token'] ?? '');
      if (token !== opts.authToken) return unauthorized(res);

      if (method === 'GET' && url.pathname === '/status') {
        const body: ManagerStatusResponse = {
          ok: true,
          gateway: await gateway.status(),
          integrations: {
            telegram: await stateStore.getTelegramConnection()
          }
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/gateway/start') {
        const body: ManagerGatewayActionResponse = {
          ok: true,
          gateway: await gateway.start()
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/gateway/stop') {
        const body: ManagerGatewayActionResponse = {
          ok: true,
          gateway: await gateway.stop()
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/gateway/restart') {
        const body: ManagerGatewayActionResponse = {
          ok: true,
          gateway: await gateway.restart()
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/integrations/telegram/connect') {
        let parsed: any = null;
        try {
          parsed = (await readJson(req)) as any;
        } catch (err) {
          if ((err as Error).message === 'invalid_json') {
            return json(res, 400, { ok: false, error: 'invalid_json' });
          }
          throw err;
        }
        const token = String(parsed?.token ?? '').trim();

        if (!token || !looksLikeTelegramToken(token)) {
          await stateStore.setTelegramError('invalid_token_format');
          return json(res, 400, { ok: false, error: 'invalid_token' });
        }

        const validated = await validateTelegramToken(telegramFetch, token);
        if (!validated.ok) {
          await stateStore.setTelegramError(validated.error);
          return json(res, 400, { ok: false, error: 'telegram_validation_failed' });
        }

        await stateStore.setTelegramToken(token);
        const body: ManagerTelegramConnectResponse = {
          ok: true,
          integrations: {
            telegram: await stateStore.getTelegramConnection()
          }
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/integrations/telegram/disconnect') {
        await stateStore.clearTelegram();
        const body: ManagerTelegramDisconnectResponse = {
          ok: true,
          integrations: {
            telegram: await stateStore.getTelegramConnection()
          }
        };
        return json(res, 200, body);
      }

      return json(res, 404, { ok: false, error: 'not_found' });
    })().catch((err) => {
      // Last-resort guard: avoid crashing the server on unexpected errors.
      json(res, 500, { ok: false, error: 'internal_error', message: (err as Error).message });
    });
  });
}
