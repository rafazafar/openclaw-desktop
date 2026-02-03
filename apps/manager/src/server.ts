import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import { createGatewayController, type GatewayController, type GatewayState } from './gateway.js';
import { resolveGatewayLogFilePath, tailFileLines } from './logs.js';
import { runDiagnostics, type DiagnosticsRunResult } from './diagnostics.js';
import { createAuditLog, type AuditLog } from './audit.js';
import {
  createStateStore,
  type ConfirmBeforeSendPolicyState,
  type GmailOauthCredsSummary,
  type GmailOauthTokensSummary,
  type IntegrationConnection,
  type StateStore
} from './state/store.js';
import { PERMISSION_CATALOG_V1, type PermissionId } from '@openclaw/policy';

export type ManagerStatusResponse = {
  ok: true;
  gateway: GatewayState;
  integrations: {
    telegram: IntegrationConnection;
    gmail: IntegrationConnection;
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

export type ManagerLogsRecentResponse = {
  ok: true;
  logs: {
    available: boolean;
    file?: string;
    lines: string[];
    truncated?: boolean;
    error?: string;
  };
};

export type ManagerDiagnosticsRunResponse = DiagnosticsRunResult;

export type ManagerAuditRecentResponse = {
  ok: true;
  audit: {
    file: string;
    events: unknown[];
    truncated: boolean;
  };
};

export type ManagerGmailOauthCredsGetResponse = {
  ok: true;
  gmail: {
    oauthCreds: GmailOauthCredsSummary;
  };
};

export type ManagerGmailOauthCredsSetResponse = ManagerGmailOauthCredsGetResponse;
export type ManagerGmailOauthCredsClearResponse = ManagerGmailOauthCredsGetResponse;

export type ManagerGmailOauthStatusResponse = {
  ok: true;
  gmail: {
    oauthCreds: GmailOauthCredsSummary;
    oauthTokens: GmailOauthTokensSummary;
    redirectUri: string;
  };
};

export type ManagerGmailOauthStartResponse = {
  ok: true;
  gmail: {
    authUrl: string;
    redirectUri: string;
    scope: string;
  };
};

export type ManagerPermissionsGetResponse = {
  ok: true;
  permissions: {
    catalog: {
      id: PermissionId;
      title: string;
      description: string;
      group: string;
      risk: string;
      defaultEnabled: boolean;
    }[];
    enabled: Record<PermissionId, boolean>;
  };
};

export type ManagerPermissionsSetResponse = {
  ok: true;
  permissions: {
    enabled: Record<PermissionId, boolean>;
  };
};

export type ManagerPoliciesGetResponse = {
  ok: true;
  policies: {
    confirmBeforeSend: ConfirmBeforeSendPolicyState;
  };
};

export type ManagerPolicyConfirmBeforeSendSetResponse = {
  ok: true;
  policies: {
    confirmBeforeSend: ConfirmBeforeSendPolicyState;
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
  /** Override for tests; defaults to global fetch. */
  googleFetch?: typeof fetch;
  /** Override for tests; resolves the gateway log file path. */
  logFileResolver?: () => Promise<string | null>;
  /** Override for tests; defaults to JSONL audit log in app data dir. */
  auditLog?: AuditLog;
};

function json(res: http.ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(payload);
}

function html(res: http.ServerResponse, statusCode: number, body: string): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(body);
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
  const googleFetch = opts.googleFetch ?? fetch;
  const auditLog = opts.auditLog ?? createAuditLog();

  async function safeAudit(event: Parameters<AuditLog['append']>[0]): Promise<void> {
    try {
      await auditLog.append(event);
    } catch {
      // Best-effort only; do not fail requests due to audit write issues.
    }
  }

  // Gmail OAuth: we keep a single pending state in-memory (MVP).
  // This is sufficient for local, single-user desktop flows.
  let pendingGmailOauth:
    | { state: string; createdAtMs: number; redirectUri: string; scope: string }
    | undefined;

  return http.createServer((req, res) => {
    void (async () => {
      const method = req.method ?? 'GET';
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');

      const isPublicOauthCallback =
        method === 'GET' && url.pathname === '/integrations/gmail/oauth/callback';

      // Local auth: require a header token for all endpoints (MVP),
      // except the OAuth callback which is reached via an external browser.
      if (!isPublicOauthCallback) {
        const token = String(req.headers['x-openclaw-token'] ?? '');
        if (token !== opts.authToken) return unauthorized(res);
      }

      if (method === 'GET' && url.pathname === '/status') {
        const body: ManagerStatusResponse = {
          ok: true,
          gateway: await gateway.status(),
          integrations: {
            telegram: await stateStore.getTelegramConnection(),
            gmail: await stateStore.getGmailConnection()
          }
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/gateway/start') {
        const next = await gateway.start();
        await safeAudit({ type: 'gateway.start', actor: 'desktop-ui', details: { status: next.status } });
        const body: ManagerGatewayActionResponse = {
          ok: true,
          gateway: next
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/gateway/stop') {
        const next = await gateway.stop();
        await safeAudit({ type: 'gateway.stop', actor: 'desktop-ui', details: { status: next.status } });
        const body: ManagerGatewayActionResponse = {
          ok: true,
          gateway: next
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/gateway/restart') {
        const next = await gateway.restart();
        await safeAudit({ type: 'gateway.restart', actor: 'desktop-ui', details: { status: next.status } });
        const body: ManagerGatewayActionResponse = {
          ok: true,
          gateway: next
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
          await safeAudit({
            type: 'integrations.telegram.connect_failed',
            actor: 'desktop-ui',
            details: { error: 'invalid_token_format' }
          });
          return json(res, 400, { ok: false, error: 'invalid_token' });
        }

        const validated = await validateTelegramToken(telegramFetch, token);
        if (!validated.ok) {
          await stateStore.setTelegramError(validated.error);
          await safeAudit({
            type: 'integrations.telegram.connect_failed',
            actor: 'desktop-ui',
            details: { error: validated.error }
          });
          return json(res, 400, { ok: false, error: 'telegram_validation_failed' });
        }

        await stateStore.setTelegramToken(token);
        await safeAudit({
          type: 'integrations.telegram.connect',
          actor: 'desktop-ui',
          details: { accountLabel: validated.accountLabel }
        });
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
        await safeAudit({ type: 'integrations.telegram.disconnect', actor: 'desktop-ui' });
        const body: ManagerTelegramDisconnectResponse = {
          ok: true,
          integrations: {
            telegram: await stateStore.getTelegramConnection()
          }
        };
        return json(res, 200, body);
      }

      if (method === 'GET' && url.pathname === '/integrations/gmail/oauth-creds') {
        const body: ManagerGmailOauthCredsGetResponse = {
          ok: true,
          gmail: {
            oauthCreds: await stateStore.getGmailOauthCredsSummary()
          }
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/integrations/gmail/oauth-creds/set') {
        let parsed: any = null;
        try {
          parsed = (await readJson(req)) as any;
        } catch (err) {
          if ((err as Error).message === 'invalid_json') {
            return json(res, 400, { ok: false, error: 'invalid_json' });
          }
          throw err;
        }

        const clientId = String(parsed?.clientId ?? '').trim();
        const clientSecret = String(parsed?.clientSecret ?? '').trim();

        if (!clientId || !clientSecret) {
          await safeAudit({
            type: 'integrations.gmail.oauthCreds.set_failed',
            actor: 'desktop-ui',
            details: { error: 'missing_fields' }
          });
          return json(res, 400, { ok: false, error: 'missing_fields' });
        }

        await stateStore.setGmailOauthCreds(clientId, clientSecret);
        await safeAudit({ type: 'integrations.gmail.oauthCreds.set', actor: 'desktop-ui' });

        const body: ManagerGmailOauthCredsSetResponse = {
          ok: true,
          gmail: {
            oauthCreds: await stateStore.getGmailOauthCredsSummary()
          }
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/integrations/gmail/oauth-creds/clear') {
        await stateStore.clearGmailOauthCreds();
        await safeAudit({ type: 'integrations.gmail.oauthCreds.clear', actor: 'desktop-ui' });

        const body: ManagerGmailOauthCredsClearResponse = {
          ok: true,
          gmail: {
            oauthCreds: await stateStore.getGmailOauthCredsSummary()
          }
        };
        return json(res, 200, body);
      }

      if (method === 'GET' && url.pathname === '/integrations/gmail/oauth/status') {
        const host = String(req.headers.host ?? '127.0.0.1');
        const redirectUri = `http://${host}/integrations/gmail/oauth/callback`;

        const body: ManagerGmailOauthStatusResponse = {
          ok: true,
          gmail: {
            oauthCreds: await stateStore.getGmailOauthCredsSummary(),
            oauthTokens: await stateStore.getGmailOauthTokensSummary(),
            redirectUri
          }
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/integrations/gmail/oauth/start') {
        const host = String(req.headers.host ?? '127.0.0.1');
        const redirectUri = `http://${host}/integrations/gmail/oauth/callback`;

        const scope = 'https://www.googleapis.com/auth/gmail.readonly';
        const creds = await stateStore.getGmailOauthCreds();
        if (!creds) {
          await safeAudit({
            type: 'integrations.gmail.oauth.start_failed',
            actor: 'desktop-ui',
            details: { error: 'missing_oauth_creds' }
          });
          return json(res, 400, { ok: false, error: 'missing_oauth_creds', redirectUri });
        }

        const state = crypto.randomUUID();
        pendingGmailOauth = { state, createdAtMs: Date.now(), redirectUri, scope };

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', creds.clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', scope);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('include_granted_scopes', 'true');
        authUrl.searchParams.set('state', state);

        await safeAudit({ type: 'integrations.gmail.oauth.start', actor: 'desktop-ui' });

        const body: ManagerGmailOauthStartResponse = {
          ok: true,
          gmail: {
            authUrl: authUrl.toString(),
            redirectUri,
            scope
          }
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/integrations/gmail/oauth/clear') {
        await stateStore.clearGmailOauthTokens();
        await safeAudit({ type: 'integrations.gmail.oauth.clear', actor: 'desktop-ui' });

        const host = String(req.headers.host ?? '127.0.0.1');
        const redirectUri = `http://${host}/integrations/gmail/oauth/callback`;

        const body: ManagerGmailOauthStatusResponse = {
          ok: true,
          gmail: {
            oauthCreds: await stateStore.getGmailOauthCredsSummary(),
            oauthTokens: await stateStore.getGmailOauthTokensSummary(),
            redirectUri
          }
        };
        return json(res, 200, body);
      }

      if (method === 'GET' && url.pathname === '/integrations/gmail/oauth/callback') {
        const error = String(url.searchParams.get('error') ?? '').trim();
        const code = String(url.searchParams.get('code') ?? '').trim();
        const state = String(url.searchParams.get('state') ?? '').trim();

        if (error) {
          return html(
            res,
            400,
            `<!doctype html><html><body><h3>Gmail authorization failed</h3><p>${error}</p></body></html>`
          );
        }

        if (!pendingGmailOauth) {
          return html(
            res,
            400,
            '<!doctype html><html><body><h3>No pending OAuth request</h3><p>Please start the flow again from the desktop app.</p></body></html>'
          );
        }

        const expired = Date.now() - pendingGmailOauth.createdAtMs > 10 * 60 * 1000;
        if (expired || !state || state !== pendingGmailOauth.state || !code) {
          return html(
            res,
            400,
            '<!doctype html><html><body><h3>Invalid OAuth callback</h3><p>Please start the flow again from the desktop app.</p></body></html>'
          );
        }

        const creds = await stateStore.getGmailOauthCreds();
        if (!creds) {
          return html(
            res,
            400,
            '<!doctype html><html><body><h3>Missing OAuth client credentials</h3><p>Enter your client id/secret in the desktop app and try again.</p></body></html>'
          );
        }

        const tokenRes = await googleFetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            redirect_uri: pendingGmailOauth.redirectUri,
            grant_type: 'authorization_code'
          }).toString()
        });

        if (!tokenRes.ok) {
          const txt = await tokenRes.text().catch(() => '');
          pendingGmailOauth = undefined;
          await safeAudit({
            type: 'integrations.gmail.oauth.callback_failed',
            actor: 'browser',
            details: { status: tokenRes.status }
          });
          return html(
            res,
            400,
            `<!doctype html><html><body><h3>Token exchange failed</h3><p>HTTP ${tokenRes.status}</p><pre>${txt}</pre></body></html>`
          );
        }

        const data = (await tokenRes.json().catch(() => null)) as any;
        const accessToken = String(data?.access_token ?? '').trim();
        if (!accessToken) {
          pendingGmailOauth = undefined;
          return html(
            res,
            400,
            '<!doctype html><html><body><h3>Token exchange failed</h3><p>Missing access token.</p></body></html>'
          );
        }

        const refreshToken = data?.refresh_token ? String(data.refresh_token) : undefined;
        const tokenType = data?.token_type ? String(data.token_type) : undefined;
        const scope = data?.scope ? String(data.scope) : pendingGmailOauth.scope;
        const expiresInSec = Number(data?.expires_in ?? 0);
        const expiresAt =
          Number.isFinite(expiresInSec) && expiresInSec > 0
            ? new Date(Date.now() + expiresInSec * 1000).toISOString()
            : undefined;

        // Best-effort: resolve account identity from Gmail API.
        let accountEmail: string | undefined;
        try {
          const profileRes = await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
            method: 'GET',
            headers: {
              authorization: `Bearer ${accessToken}`
            }
          });
          if (profileRes.ok) {
            const profile = (await profileRes.json().catch(() => null)) as any;
            const email = String(profile?.emailAddress ?? '').trim();
            if (email) accountEmail = email;
          }
        } catch {
          // ignore; identity is optional
        }

        await stateStore.setGmailOauthTokens({
          accessToken,
          refreshToken,
          scope,
          tokenType,
          expiresAt,
          accountEmail
        });
        await safeAudit({ type: 'integrations.gmail.oauth.authorized', actor: 'browser' });

        pendingGmailOauth = undefined;

        return html(
          res,
          200,
          '<!doctype html><html><body><h3>Gmail authorized</h3><p>You can close this tab and return to the desktop app.</p></body></html>'
        );
      }

      if (method === 'GET' && url.pathname === '/logs/recent') {
        const linesParam = Number(url.searchParams.get('lines') ?? '200');
        const linesWanted = Number.isFinite(linesParam) ? linesParam : 200;

        const resolve = opts.logFileResolver ?? resolveGatewayLogFilePath;
        const file = await resolve();
        if (!file) {
          const body: ManagerLogsRecentResponse = {
            ok: true,
            logs: { available: false, lines: [], error: 'no_log_file' }
          };
          return json(res, 200, body);
        }

        try {
          const tailed = await tailFileLines(file, linesWanted);
          const body: ManagerLogsRecentResponse = {
            ok: true,
            logs: { available: true, file, lines: tailed.lines, truncated: tailed.truncated }
          };
          return json(res, 200, body);
        } catch (err) {
          const body: ManagerLogsRecentResponse = {
            ok: true,
            logs: {
              available: false,
              file,
              lines: [],
              error: (err as Error).message || 'failed_to_read_logs'
            }
          };
          return json(res, 200, body);
        }
      }

      if (method === 'POST' && url.pathname === '/diagnostics/run') {
        const resolver = opts.logFileResolver ?? resolveGatewayLogFilePath;
        const body: ManagerDiagnosticsRunResponse = await runDiagnostics({
          gateway,
          stateStore,
          logFileResolver: resolver
        });
        await safeAudit({ type: 'diagnostics.run', actor: 'desktop-ui', details: { overall: body.summary.overall } });
        return json(res, 200, body);
      }

      if (method === 'GET' && url.pathname === '/permissions') {
        const perms = await stateStore.getPermissions();
        const body: ManagerPermissionsGetResponse = {
          ok: true,
          permissions: {
            catalog: perms.catalog.map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              group: p.group,
              risk: p.risk,
              defaultEnabled: p.defaultEnabled
            })),
            enabled: { ...perms.enabled }
          }
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/permissions/set') {
        let parsed: any = null;
        try {
          parsed = (await readJson(req)) as any;
        } catch (err) {
          if ((err as Error).message === 'invalid_json') {
            return json(res, 400, { ok: false, error: 'invalid_json' });
          }
          throw err;
        }

        const id = String(parsed?.id ?? '').trim();
        const enabled = parsed?.enabled;

        const isKnown = PERMISSION_CATALOG_V1.some((p) => p.id === id);
        if (!isKnown) return json(res, 400, { ok: false, error: 'unknown_permission' });
        if (typeof enabled !== 'boolean') return json(res, 400, { ok: false, error: 'invalid_enabled' });

        await stateStore.setPermission(id as PermissionId, enabled);
        await safeAudit({ type: 'permissions.set', actor: 'desktop-ui', details: { id, enabled } });
        const next = await stateStore.getPermissions();

        const body: ManagerPermissionsSetResponse = {
          ok: true,
          permissions: {
            enabled: { ...next.enabled }
          }
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/permissions/reset') {
        await stateStore.resetPermissions();
        await safeAudit({ type: 'permissions.reset', actor: 'desktop-ui' });
        const next = await stateStore.getPermissions();
        const body: ManagerPermissionsSetResponse = {
          ok: true,
          permissions: {
            enabled: { ...next.enabled }
          }
        };
        return json(res, 200, body);
      }

      if (method === 'GET' && url.pathname === '/policies') {
        const confirmBeforeSend = await stateStore.getConfirmBeforeSendPolicy();
        const body: ManagerPoliciesGetResponse = {
          ok: true,
          policies: {
            confirmBeforeSend
          }
        };
        return json(res, 200, body);
      }

      if (method === 'POST' && url.pathname === '/policies/confirm-before-send/set') {
        let parsed: any = null;
        try {
          parsed = (await readJson(req)) as any;
        } catch (err) {
          if ((err as Error).message === 'invalid_json') {
            return json(res, 400, { ok: false, error: 'invalid_json' });
          }
          throw err;
        }

        const integrationId = String(parsed?.integrationId ?? '').trim();
        const enabled = parsed?.enabled;
        if (integrationId !== 'telegram' && integrationId !== 'gmail') {
          return json(res, 400, { ok: false, error: 'invalid_integration' });
        }
        if (typeof enabled !== 'boolean') return json(res, 400, { ok: false, error: 'invalid_enabled' });

        await stateStore.setConfirmBeforeSendPolicy(integrationId as 'telegram' | 'gmail', enabled);
        await safeAudit({
          type: 'policies.confirmBeforeSend.set',
          actor: 'desktop-ui',
          details: { integrationId, enabled }
        });
        const confirmBeforeSend = await stateStore.getConfirmBeforeSendPolicy();

        const body: ManagerPolicyConfirmBeforeSendSetResponse = {
          ok: true,
          policies: {
            confirmBeforeSend
          }
        };
        return json(res, 200, body);
      }

      if (method === 'GET' && url.pathname === '/audit/recent') {
        const limitParam = Number(url.searchParams.get('lines') ?? '200');
        const limit = Number.isFinite(limitParam) ? limitParam : 200;
        const recent = await auditLog.readRecent(Math.max(0, Math.min(1000, limit)));
        const body: ManagerAuditRecentResponse = {
          ok: true,
          audit: {
            file: auditLog.filePath(),
            events: recent.events,
            truncated: recent.truncated
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
