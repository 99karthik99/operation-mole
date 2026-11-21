import { setupServer } from 'msw/node';

/** Mock API server; tests register handlers with `server.use(...)`. */
export const server = setupServer();
