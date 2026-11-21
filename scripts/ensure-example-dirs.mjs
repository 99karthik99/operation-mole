// Git does not store empty folders, but the examples need two of them
// (see examples/README.md). Recreate them after install.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

for (const dir of ['left/empty-both', 'right/empty-both', 'left/empty-in-base']) {
  mkdirSync(fileURLToPath(new URL(`../examples/${dir}`, import.meta.url)), { recursive: true });
}
