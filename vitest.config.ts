import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', '**/src/test/**', '**/*.d.ts'],
      // CONTRIBUTING.md §11. `pnpm test:coverage` fails below these.
      thresholds: { lines: 80, branches: 80 },
    },
  },
});
