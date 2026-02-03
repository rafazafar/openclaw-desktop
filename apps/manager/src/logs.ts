import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type TailResult = {
  lines: string[];
  truncated: boolean;
};

function formatLocalDateYYYYMMDD(d: Date): string {
  // en-CA yields YYYY-MM-DD in a stable way.
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function resolveGatewayLogFilePath(): Promise<string | null> {
  // 1) Respect OpenClaw config override if present.
  const cfgPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  try {
    if (await fileExists(cfgPath)) {
      const raw = await fs.readFile(cfgPath, 'utf8');
      const cfg = JSON.parse(raw) as any;
      const file = cfg?.logging?.file;
      if (typeof file === 'string' && file.trim()) {
        const date = formatLocalDateYYYYMMDD(new Date());
        const resolved = file.replaceAll('YYYY-MM-DD', date);
        return resolved;
      }
    }
  } catch {
    // Ignore parse/read errors for MVP; fall back to defaults.
  }

  // 2) Default location per docs: /tmp/openclaw/openclaw-YYYY-MM-DD.log
  // On Windows, this maps to something like: %TEMP%\openclaw\openclaw-YYYY-MM-DD.log
  const date = formatLocalDateYYYYMMDD(new Date());
  return path.join(os.tmpdir(), 'openclaw', `openclaw-${date}.log`);
}

export async function tailFileLines(filePath: string, lineCount: number): Promise<TailResult> {
  const linesWanted = Math.max(1, Math.min(2000, Math.floor(lineCount || 200)));
  const stat = await fs.stat(filePath);

  // Read only the last chunk of the file to avoid loading large logs.
  // 256KB is enough for hundreds of structured JSONL lines.
  const maxBytes = 256 * 1024;
  const start = Math.max(0, stat.size - maxBytes);
  const len = stat.size - start;

  const fh = await fs.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(len);
    await fh.read({ buffer: buf, position: start, length: len });
    const text = buf.toString('utf8');

    // Normalize to lines. Keep empty lines out.
    const all = text.split(/\r?\n/).filter((l) => l.length > 0);
    const sliced = all.slice(-linesWanted);

    // If we read a partial chunk (start > 0) and the first line isn't a full line,
    // we may be missing its beginning; drop it.
    const droppedPartial = start > 0 && all.length > 0 && !text.startsWith('\n') && !text.startsWith('\r');
    const cleaned = droppedPartial ? sliced.slice(1) : sliced;

    const truncated = start > 0 || all.length > linesWanted;
    return { lines: cleaned, truncated };
  } finally {
    await fh.close();
  }
}
