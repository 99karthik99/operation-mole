import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';

const port = Number(process.env.API_PORT ?? 5181);
// Local tool with filesystem access: bind to loopback only.
const host = process.env.HOST ?? '127.0.0.1';
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
const staticDir =
  process.env.NODE_ENV === 'production' && existsSync(webDist) ? webDist : undefined;

// Compare the repo's example folders unless OM_LEFT / OM_RIGHT say otherwise.
const examples = fileURLToPath(new URL('../../../examples', import.meta.url));
const defaultLeft = process.env.OM_LEFT ?? `${examples}/left`;
const defaultRight = process.env.OM_RIGHT ?? `${examples}/right`;

// Sessions, cloned repos and the database. Kept out of git (see .gitignore).
const dataDir =
  process.env.OM_DATA_DIR ?? fileURLToPath(new URL('../../../.data', import.meta.url));

const app = buildApp({
  logger: true,
  dataDir,
  defaultLeft,
  defaultRight,
  ...(staticDir ? { staticDir } : {}),
});

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
