import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test/server.ts';
import { getDefaults } from './api.ts';

const unreachable = /can't reach the om api server/i;

describe('api errors', () => {
  it('explains when the API server is down (proxy 502)', async () => {
    server.use(http.get('*/api/defaults', () => new HttpResponse(null, { status: 502 })));
    await expect(getDefaults()).rejects.toThrow(unreachable);
  });

  it('explains when the network request fails outright', async () => {
    server.use(http.get('*/api/defaults', () => HttpResponse.error()));
    await expect(getDefaults()).rejects.toThrow(unreachable);
  });

  it('uses the server message for API errors', async () => {
    server.use(
      http.get('*/api/defaults', () => HttpResponse.json({ message: 'Nope' }, { status: 400 })),
    );
    await expect(getDefaults()).rejects.toThrow('Nope');
  });

  it('rejects a successful response of the wrong shape', async () => {
    server.use(http.get('*/api/defaults', () => HttpResponse.json({ left: 42 })));
    await expect(getDefaults()).rejects.toThrow(/unexpected response/i);
  });
});
