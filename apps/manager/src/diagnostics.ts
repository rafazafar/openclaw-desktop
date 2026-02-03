import type { GatewayController, GatewayState } from './gateway.js';
import type { StateStore } from './state/store.js';

export type DiagnosticLevel = 'ok' | 'warn' | 'error';

export type DiagnosticCheck = {
  id: string;
  level: DiagnosticLevel;
  summary: string;
  details?: Record<string, unknown>;
};

export type DiagnosticsRunResult = {
  ok: true;
  ranAt: string;
  summary: {
    overall: DiagnosticLevel;
    okCount: number;
    warnCount: number;
    errorCount: number;
  };
  checks: DiagnosticCheck[];
};

function gatewayStateToCheck(state: GatewayState): DiagnosticCheck {
  if (state.status === 'error') {
    return {
      id: 'gateway.status',
      level: 'error',
      summary: state.lastError?.message || 'Gateway status returned error',
      details: { status: state.status }
    };
  }

  return {
    id: 'gateway.status',
    level: 'ok',
    summary: `Gateway is ${state.status}`,
    details: { status: state.status }
  };
}

export async function runDiagnostics(opts: {
  gateway: GatewayController;
  stateStore: StateStore;
  logFileResolver: () => Promise<string | null>;
}): Promise<DiagnosticsRunResult> {
  const checks: DiagnosticCheck[] = [];

  // 1) Can we query gateway status? (This exercises the OpenClaw CLI path.)
  let gatewayState: GatewayState = { status: 'error', lastError: { message: 'unknown' } };
  try {
    gatewayState = await opts.gateway.status();
  } catch (err) {
    gatewayState = { status: 'error', lastError: { message: (err as Error).message || 'gateway_status_failed' } };
  }
  checks.push(gatewayStateToCheck(gatewayState));

  // 2) Can we read app state?
  try {
    const state = await opts.stateStore.getState();
    checks.push({
      id: 'manager.state',
      level: 'ok',
      summary: 'State store readable',
      details: { schemaVersion: state.schemaVersion }
    });
  } catch (err) {
    checks.push({
      id: 'manager.state',
      level: 'error',
      summary: 'Failed to read state store',
      details: { error: (err as Error).message || 'state_read_failed' }
    });
  }

  // 3) Do we have a gateway log file path?
  try {
    const file = await opts.logFileResolver();
    if (file) {
      checks.push({
        id: 'gateway.logs',
        level: 'ok',
        summary: 'Gateway log file detected',
        details: { file }
      });
    } else {
      checks.push({
        id: 'gateway.logs',
        level: 'warn',
        summary: 'No gateway log file detected yet'
      });
    }
  } catch (err) {
    checks.push({
      id: 'gateway.logs',
      level: 'warn',
      summary: 'Failed to resolve gateway log file path',
      details: { error: (err as Error).message || 'log_path_failed' }
    });
  }

  // 4) Telegram connection (informational unless lastError set).
  try {
    const tg = await opts.stateStore.getTelegramConnection();
    if (tg.connected) {
      checks.push({
        id: 'integrations.telegram',
        level: 'ok',
        summary: 'Telegram connected',
        details: { accountLabel: tg.accountLabel }
      });
    } else if (tg.lastError) {
      checks.push({
        id: 'integrations.telegram',
        level: 'warn',
        summary: 'Telegram needs attention',
        details: { lastError: tg.lastError }
      });
    } else {
      checks.push({
        id: 'integrations.telegram',
        level: 'warn',
        summary: 'Telegram not connected'
      });
    }
  } catch (err) {
    checks.push({
      id: 'integrations.telegram',
      level: 'warn',
      summary: 'Failed to read Telegram connection state',
      details: { error: (err as Error).message || 'telegram_state_failed' }
    });
  }

  const okCount = checks.filter((c) => c.level === 'ok').length;
  const warnCount = checks.filter((c) => c.level === 'warn').length;
  const errorCount = checks.filter((c) => c.level === 'error').length;
  const overall: DiagnosticLevel = errorCount > 0 ? 'error' : warnCount > 0 ? 'warn' : 'ok';

  return {
    ok: true,
    ranAt: new Date().toISOString(),
    summary: { overall, okCount, warnCount, errorCount },
    checks
  };
}
