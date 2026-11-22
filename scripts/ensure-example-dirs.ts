// Git does not store empty folders, but the examples need these (see examples/README.md).
// Recreate them after install. Runs on every OS: Node APIs only, no shell.
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const EMPTY_EXAMPLE_DIRS = ['left/empty-both', 'right/empty-both', 'left/empty-in-base'] as const;

for (const dir of EMPTY_EXAMPLE_DIRS) {
  mkdirSync(path.join(import.meta.dirname, '..', 'examples', ...dir.split('/')), {
    recursive: true,
  });
}
