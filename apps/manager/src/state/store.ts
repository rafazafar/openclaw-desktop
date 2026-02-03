import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  PERMISSION_CATALOG_V1,
  type PermissionDef,
  type PermissionId
} from '@openclaw/policy';

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return false;
    throw err;
  }
}

/**
 * Best-effort atomic write with single-file rollback.
 *
 * Strategy:
 * 1) write `tmp` in same directory
 * 2) fsync
 * 3) rename current → .bak (if present)
 * 4) rename tmp → target
 *
 * On Windows, renaming over an existing path is not reliable, so we always
 * move the previous file out of the way first.
 */
async function atomicWriteFileWithBackup(targetPath: string, contents: string): Promise<void> {
  const dir = path.dirname(targetPath);
  const tmpPath = path.join(
    dir,
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`
  );
  const bakPath = `${targetPath}.bak`;

  // 1) Write temp
  await fs.writeFile(tmpPath, contents, 'utf8');

  // 2) Flush temp to disk (best-effort)
  const handle = await fs.open(tmpPath, 'r+');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }

  const hadTarget = await pathExists(targetPath);

  try {
    // 3) Move existing to backup (single rollback point)
    if (hadTarget) {
      if (await pathExists(bakPath)) {
        await fs.rm(bakPath, { force: true });
      }
      await fs.rename(targetPath, bakPath);
    }

    // 4) Put new file in place
    await fs.rename(tmpPath, targetPath);
  } catch (err) {
    // Roll back if we already moved the old file away.
    try {
      const hasTargetNow = await pathExists(targetPath);
      const hasBakNow = await pathExists(bakPath);
      if (!hasTargetNow && hasBakNow) {
        await fs.rename(bakPath, targetPath);
      }
    } catch {
      // ignore rollback errors; original error will be thrown
    }

    // Cleanup tmp (may already be moved)
    try {
      await fs.rm(tmpPath, { force: true });
    } catch {
      // ignore
    }

    throw err;
  }
}

export type IntegrationConnection = {
  integrationId: 'telegram';
  connected: boolean;
  accountLabel?: string;
  connectedAt?: string;
  lastValidatedAt?: string;
  needsAttention?: boolean;
  lastError?: string;
};

export type AppStateV1 = {
  schemaVersion: 1;
  integrations: {
    telegram: {
      /** Stored as plaintext for MVP/dev only. Do not return via API. */
      token?: string;
      connectedAt?: string;
      lastValidatedAt?: string;
      lastError?: string;
    };
  };
  /**
   * Per-permission enablement map.
   *
   * For MVP, we store a full materialized map. Unknown keys are ignored.
   */
  permissions?: Partial<Record<PermissionId, boolean>>;

  /**
   * Policy overrides.
   *
   * Policies are stored as partial overrides; defaults are defined in-code.
   */
  policies?: {
    confirmBeforeSend?: Partial<Record<'telegram' | 'gmail', boolean>>;
  };
};

const DEFAULT_STATE: AppStateV1 = {
  schemaVersion: 1,
  integrations: {
    telegram: {}
  },
  permissions: undefined
};

export type PermissionsState = {
  catalog: ReadonlyArray<PermissionDef>;
  enabled: Readonly<Record<PermissionId, boolean>>;
};

export type ConfirmBeforeSendPolicyState = {
  enabled: Readonly<Record<'telegram' | 'gmail', boolean>>;
};

export type StateStore = {
  getState(): Promise<AppStateV1>;
  writeState(next: AppStateV1): Promise<void>;

  // Integrations
  getTelegramConnection(): Promise<IntegrationConnection>;
  setTelegramToken(token: string): Promise<void>;
  setTelegramError(message: string): Promise<void>;
  clearTelegram(): Promise<void>;

  // Permissions
  getPermissions(): Promise<PermissionsState>;
  setPermission(id: PermissionId, enabled: boolean): Promise<void>;
  resetPermissions(): Promise<void>;

  // Policies
  getConfirmBeforeSendPolicy(): Promise<ConfirmBeforeSendPolicyState>;
  setConfirmBeforeSendPolicy(integrationId: 'telegram' | 'gmail', enabled: boolean): Promise<void>;
};

function resolveDataDir(): string {
  return (
    process.env.OPENCLAW_DESKTOP_DATA_DIR ||
    (process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'openclaw-desktop')
      : path.join(os.homedir(), '.openclaw-desktop'))
  );
}

async function readJsonFile(filePath: string): Promise<unknown | undefined> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return undefined;
    throw err;
  }
}

function isAppStateV1(value: unknown): value is AppStateV1 {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<AppStateV1>;
  return (
    v.schemaVersion === 1 &&
    typeof v.integrations === 'object' &&
    !!v.integrations &&
    typeof (v.integrations as any).telegram === 'object'
  );
}

function getDefaultPermissions(): Record<PermissionId, boolean> {
  return Object.fromEntries(
    PERMISSION_CATALOG_V1.map((p) => [p.id, Boolean(p.defaultEnabled)])
  ) as Record<PermissionId, boolean>;
}

function materializePermissions(state: AppStateV1): Record<PermissionId, boolean> {
  const base = getDefaultPermissions();
  const overrides = state.permissions ?? {};
  for (const p of PERMISSION_CATALOG_V1) {
    const v = overrides[p.id];
    if (typeof v === 'boolean') base[p.id] = v;
  }
  return base;
}

function getDefaultConfirmBeforeSendPolicy(): Record<'telegram' | 'gmail', boolean> {
  // Safe by default: if sending is ever enabled, confirmations should be on.
  return { telegram: true, gmail: true };
}

function materializeConfirmBeforeSendPolicy(state: AppStateV1): Record<'telegram' | 'gmail', boolean> {
  const base = getDefaultConfirmBeforeSendPolicy();
  const overrides = state.policies?.confirmBeforeSend ?? {};
  for (const k of ['telegram', 'gmail'] as const) {
    const v = overrides[k];
    if (typeof v === 'boolean') base[k] = v;
  }
  return base;
}

export function createStateStore(opts?: { dataDir?: string }): StateStore {
  const dataDir = opts?.dataDir ?? resolveDataDir();
  const statePath = path.join(dataDir, 'state.json');

  async function ensureDir(): Promise<void> {
    await fs.mkdir(dataDir, { recursive: true });
  }

  async function getState(): Promise<AppStateV1> {
    const parsed = await readJsonFile(statePath);
    if (!parsed) return DEFAULT_STATE;

    if (isAppStateV1(parsed)) return parsed;

    // If state is unknown/corrupt, keep a safe default for now.
    // (Migrations will be added later.)
    return DEFAULT_STATE;
  }

  async function writeState(next: AppStateV1): Promise<void> {
    await ensureDir();
    await atomicWriteFileWithBackup(
      statePath,
      JSON.stringify(next, null, 2) + '\n'
    );
  }

  async function writeGeneratedOpenClawConfig(next: AppStateV1): Promise<void> {
    await ensureDir();

    // MVP: generate a small, non-secret config artifact.
    // (Telegram token stays in app state for now; config contains only a reference.)
    const telegramEnabled = Boolean(next.integrations.telegram.token);
    const permissions = materializePermissions(next);
    const confirmBeforeSend = materializeConfirmBeforeSendPolicy(next);

    const config = {
      meta: {
        generatedBy: 'openclaw-desktop',
        generatorVersion: 1
      },
      permissions,
      policy: {
        confirmBeforeSend
      },
      channels: {
        telegram: {
          enabled: telegramEnabled,
          ...(telegramEnabled ? { tokenRef: 'openclaw-desktop:telegramBotToken' } : {}),
          // Hook for gateway/tool enforcement: allow outbound sends only when explicitly enabled.
          allowSend: Boolean(permissions['telegram.send'])
        }
      }
    };

    const outPath = path.join(dataDir, 'openclaw.generated.json');
    await atomicWriteFileWithBackup(outPath, JSON.stringify(config, null, 2) + '\n');
  }

  async function getTelegramConnection(): Promise<IntegrationConnection> {
    const state = await getState();
    const tg = state.integrations.telegram;
    return {
      integrationId: 'telegram',
      connected: Boolean(tg.token),
      connectedAt: tg.connectedAt,
      lastValidatedAt: tg.lastValidatedAt,
      needsAttention: Boolean(tg.lastError),
      lastError: tg.lastError
    };
  }

  async function setTelegramToken(token: string): Promise<void> {
    const state = await getState();
    const now = new Date().toISOString();
    const next: AppStateV1 = {
      ...state,
      integrations: {
        ...state.integrations,
        telegram: {
          ...state.integrations.telegram,
          token,
          connectedAt: state.integrations.telegram.connectedAt ?? now,
          lastValidatedAt: now,
          lastError: undefined
        }
      }
    };
    await writeState(next);
    await writeGeneratedOpenClawConfig(next);
  }

  async function setTelegramError(message: string): Promise<void> {
    const state = await getState();
    const now = new Date().toISOString();
    const next: AppStateV1 = {
      ...state,
      integrations: {
        ...state.integrations,
        telegram: {
          ...state.integrations.telegram,
          token: undefined,
          lastValidatedAt: now,
          lastError: message
        }
      }
    };
    await writeState(next);
    await writeGeneratedOpenClawConfig(next);
  }

  async function clearTelegram(): Promise<void> {
    const state = await getState();
    const next: AppStateV1 = {
      ...state,
      integrations: {
        ...state.integrations,
        telegram: {}
      }
    };
    await writeState(next);
    await writeGeneratedOpenClawConfig(next);
  }

  async function getPermissions(): Promise<PermissionsState> {
    const state = await getState();
    return {
      catalog: PERMISSION_CATALOG_V1,
      enabled: materializePermissions(state)
    };
  }

  async function setPermission(id: PermissionId, enabled: boolean): Promise<void> {
    const state = await getState();
    const next: AppStateV1 = {
      ...state,
      permissions: {
        ...(state.permissions ?? {}),
        [id]: enabled
      }
    };
    await writeState(next);
    await writeGeneratedOpenClawConfig(next);
  }

  async function resetPermissions(): Promise<void> {
    const state = await getState();
    const next: AppStateV1 = { ...state, permissions: undefined };
    await writeState(next);
    await writeGeneratedOpenClawConfig(next);
  }

  async function getConfirmBeforeSendPolicy(): Promise<ConfirmBeforeSendPolicyState> {
    const state = await getState();
    return {
      enabled: materializeConfirmBeforeSendPolicy(state)
    };
  }

  async function setConfirmBeforeSendPolicy(
    integrationId: 'telegram' | 'gmail',
    enabled: boolean
  ): Promise<void> {
    const state = await getState();
    const next: AppStateV1 = {
      ...state,
      policies: {
        ...(state.policies ?? {}),
        confirmBeforeSend: {
          ...(state.policies?.confirmBeforeSend ?? {}),
          [integrationId]: enabled
        }
      }
    };
    await writeState(next);
    await writeGeneratedOpenClawConfig(next);
  }

  return {
    getState,
    writeState,
    getTelegramConnection,
    setTelegramToken,
    setTelegramError,
    clearTelegram,
    getPermissions,
    setPermission,
    resetPermissions,
    getConfirmBeforeSendPolicy,
    setConfirmBeforeSendPolicy
  };
}
