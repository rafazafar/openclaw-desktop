import { createManagerServer } from './server.js';

const HOST = '127.0.0.1';
const PORT = Number(process.env.OPENCLAW_MANAGER_PORT ?? 3210);

// DEV token (plumbing only). This will be replaced by a stronger local auth mechanism.
const AUTH_TOKEN =
  process.env.OPENCLAW_MANAGER_TOKEN ??
  (process.env.NODE_ENV === 'production' ? '' : 'dev-token');

if (!AUTH_TOKEN) {
  console.error(
    'OPENCLAW_MANAGER_TOKEN is required in production (refusing to start)'
  );
  process.exit(1);
}

const server = createManagerServer({ authToken: AUTH_TOKEN });

server.listen(PORT, HOST, () => {
  console.log(`openclaw manager listening on http://${HOST}:${PORT}`);
});
