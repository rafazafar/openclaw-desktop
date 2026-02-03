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

export type ManagerServerOptions = {
  /** Token required in `x-openclaw-token` header. */
  authToken: string;
  /** Override for tests; defaults to OpenClaw CLI-backed controller. */
  gateway?: GatewayController;
  /** Override for tests; defaults to local JSON file store. */
  stateStore?: StateStore;
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

export function createManagerServer(opts: ManagerServerOptions): http.Server {
  const gateway = opts.gateway ?? createGatewayController();
  const stateStore = opts.stateStore ?? createStateStore();

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

      return json(res, 404, { ok: false, error: 'not_found' });
    })().catch((err) => {
      // Last-resort guard: avoid crashing the server on unexpected errors.
      json(res, 500, { ok: false, error: 'internal_error', message: (err as Error).message });
    });
  });
}
