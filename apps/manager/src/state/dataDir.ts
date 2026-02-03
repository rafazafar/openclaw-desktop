import os from 'node:os';
import path from 'node:path';

export function resolveDataDir(): string {
  return (
    process.env.OPENCLAW_DESKTOP_DATA_DIR ||
    (process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'openclaw-desktop')
      : path.join(os.homedir(), '.openclaw-desktop'))
  );
}
