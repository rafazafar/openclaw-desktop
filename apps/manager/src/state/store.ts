import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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
};

const DEFAULT_STATE: AppStateV1 = {
  schemaVersion: 1,
  integrations: {
    telegram: {}
  }
};

export type StateStore = {
  getState(): Promise<AppStateV1>;
  writeState(next: AppStateV1): Promise<void>;
  getTelegramConnection(): Promise<IntegrationConnection>;
  setTelegramToken(token: string): Promise<void>;
  clearTelegram(): Promise<void>;
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
    // Not atomic yet (see T3.2). Keep simple for MVP.
    await fs.writeFile(statePath, JSON.stringify(next, null, 2) + '\n', 'utf8');
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
    const next: AppStateV1 = {
      ...state,
      integrations: {
        ...state.integrations,
        telegram: {
          ...state.integrations.telegram,
          token,
          connectedAt: state.integrations.telegram.connectedAt ?? new Date().toISOString(),
          lastError: undefined
        }
      }
    };
    await writeState(next);
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
  }

  return {
    getState,
    writeState,
    getTelegramConnection,
    setTelegramToken,
    clearTelegram
  };
}
