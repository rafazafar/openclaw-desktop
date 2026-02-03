import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type GatewayStatus =
  | 'running'
  | 'stopped'
  | 'starting'
  | 'stopping'
  | 'error';

export type GatewayState = {
  status: GatewayStatus;
  lastError?: { message: string };
};

export type GatewayController = {
  status: () => Promise<GatewayState>;
  start: () => Promise<GatewayState>;
  stop: () => Promise<GatewayState>;
  restart: () => Promise<GatewayState>;
};

function parseGatewayStatus(output: string): GatewayState {
  const m = output.match(/^Runtime:\s*(\w+)/m);
  const raw = (m?.[1] ?? '').toLowerCase();

  if (raw === 'running') return { status: 'running' };
  if (raw === 'stopped') return { status: 'stopped' };
  if (raw === 'starting') return { status: 'starting' };
  if (raw === 'stopping') return { status: 'stopping' };

  // Unknown state: treat as error but keep it recoverable.
  return {
    status: 'error',
    lastError: { message: `Unable to parse gateway status from CLI output (Runtime: ${raw || 'missing'})` }
  };
}

async function runOpenClawGateway(args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync('openclaw', ['gateway', ...args], {
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 5 * 1024 * 1024
  });

  // openclaw prints useful info to stdout; stderr is usually empty.
  return `${stdout}\n${stderr}`.trim();
}

export function createGatewayController(): GatewayController {
  return {
    async status() {
      try {
        const out = await runOpenClawGateway(['status']);
        return parseGatewayStatus(out);
      } catch (err) {
        return { status: 'error', lastError: { message: (err as Error).message } };
      }
    },

    async start() {
      const current = await this.status();
      if (current.status === 'running' || current.status === 'starting') return current;

      try {
        await runOpenClawGateway(['start']);
      } catch (err) {
        return { status: 'error', lastError: { message: (err as Error).message } };
      }

      return this.status();
    },

    async stop() {
      const current = await this.status();
      if (current.status === 'stopped' || current.status === 'stopping') return current;

      try {
        await runOpenClawGateway(['stop']);
      } catch (err) {
        return { status: 'error', lastError: { message: (err as Error).message } };
      }

      return this.status();
    },

    async restart() {
      const current = await this.status();
      if (current.status === 'stopped') {
        // User intent is "get it running"; treat restart as start when stopped.
        return this.start();
      }

      try {
        await runOpenClawGateway(['restart']);
      } catch (err) {
        return { status: 'error', lastError: { message: (err as Error).message } };
      }

      return this.status();
    }
  };
}
