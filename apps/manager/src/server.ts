import http from 'node:http';
import { URL } from 'node:url';

export type GatewayStatus = 'running' | 'stopped' | 'starting' | 'stopping';

export type ManagerStatusResponse = {
  ok: true;
  gateway: {
    status: GatewayStatus;
  };
};

export type ManagerServerOptions = {
  /** Token required in `x-openclaw-token` header. */
  authToken: string;
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
  return http.createServer((req, res) => {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    // Local auth: require a header token for all endpoints (MVP).
    const token = String(req.headers['x-openclaw-token'] ?? '');
    if (token !== opts.authToken) return unauthorized(res);

    if (method === 'GET' && url.pathname === '/status') {
      const body: ManagerStatusResponse = {
        ok: true,
        gateway: {
          status: 'stopped'
        }
      };
      return json(res, 200, body);
    }

    return json(res, 404, { ok: false, error: 'not_found' });
  });
}
