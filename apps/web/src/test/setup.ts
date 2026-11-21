import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { server } from './server.ts';

/** jsdom has no matchMedia; default to a light-mode system preference. */
export function stubMatchMedia(prefersDark = false) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: prefersDark && query.includes('dark'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

beforeEach(() => {
  stubMatchMedia();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
