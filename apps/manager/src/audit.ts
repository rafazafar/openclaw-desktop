import fs from 'node:fs/promises';
import path from 'node:path';
import { tailFileLines } from './logs.js';
import { resolveDataDir } from './state/dataDir.js';

export type AuditEventType =
  | 'gateway.start'
  | 'gateway.stop'
  | 'gateway.restart'
  | 'integrations.telegram.connect'
  | 'integrations.telegram.connect_failed'
  | 'integrations.telegram.disconnect'
  | 'integrations.gmail.oauthCreds.set'
  | 'integrations.gmail.oauthCreds.set_failed'
  | 'integrations.gmail.oauthCreds.clear'
  | 'integrations.gmail.oauth.start'
  | 'integrations.gmail.oauth.start_failed'
  | 'integrations.gmail.oauth.clear'
  | 'integrations.gmail.oauth.callback_failed'
  | 'integrations.gmail.oauth.authorized'
  | 'permissions.set'
  | 'permissions.reset'
  | 'policies.confirmBeforeSend.set'
  | 'diagnostics.run';

export type AuditEvent = {
  ts: string;
  type: AuditEventType;
  actor: 'desktop-ui' | 'browser' | 'unknown';
  details?: Record<string, unknown>;
};

export type AuditLog = {
  filePath(): string;
  append(event: Omit<AuditEvent, 'ts'> & { ts?: string }): Promise<void>;
  readRecent(limit: number): Promise<{ lines: string[]; events: AuditEvent[]; truncated: boolean }>;
};

export function createAuditLog(opts?: { dataDir?: string }): AuditLog {
  const dataDir = opts?.dataDir ?? resolveDataDir();
  const auditPath = path.join(dataDir, 'audit.jsonl');

  async function ensureDir(): Promise<void> {
    await fs.mkdir(dataDir, { recursive: true });
  }

  async function append(event: Omit<AuditEvent, 'ts'> & { ts?: string }): Promise<void> {
    await ensureDir();
    const payload: AuditEvent = {
      ts: event.ts ?? new Date().toISOString(),
      type: event.type,
      actor: event.actor,
      details: event.details
    };

    // Best-effort durability: open+append+sync+close.
    const handle = await fs.open(auditPath, 'a');
    try {
      await handle.appendFile(JSON.stringify(payload) + '\n', 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async function readRecent(limit: number): Promise<{ lines: string[]; events: AuditEvent[]; truncated: boolean }> {
    if (limit <= 0) return { lines: [], events: [], truncated: false };

    try {
      const tailed = await tailFileLines(auditPath, limit);
      const events: AuditEvent[] = [];
      for (const line of tailed.lines) {
        try {
          const parsed = JSON.parse(line) as AuditEvent;
          if (parsed && typeof parsed.ts === 'string' && typeof parsed.type === 'string') {
            events.push(parsed);
          }
        } catch {
          // ignore malformed audit lines
        }
      }
      return { lines: tailed.lines, events, truncated: tailed.truncated };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return { lines: [], events: [], truncated: false };
      throw err;
    }
  }

  return {
    filePath: () => auditPath,
    append,
    readRecent
  };
}
