import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim();
}

/** Writes files (relative path -> contents) and commits them on the current branch. */
export function commit(repo: string, files: Record<string, string>, message = 'update'): void {
  for (const [rel, contents] of Object.entries(files)) {
    const file = path.join(repo, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
  }
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', message);
}

/**
 * Creates an "origin" repo with branches:
 * - main:        README.md, src/app.ts (v1)
 * - dev:         main + src/app.ts (v2) + src/new.ts
 * - feature/x:   main + docs/x.md
 */
export function createOrigin(dir: string): { dir: string; url: string } {
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  commit(dir, { 'README.md': '# Origin\n', 'src/app.ts': 'export const v = 1;\n' }, 'initial');
  git(dir, 'checkout', '-q', '-b', 'dev');
  commit(dir, { 'src/app.ts': 'export const v = 2;\n', 'src/new.ts': 'new\n' }, 'dev work');
  git(dir, 'checkout', '-q', 'main');
  git(dir, 'checkout', '-q', '-b', 'feature/x');
  commit(dir, { 'docs/x.md': 'x\n' }, 'feature');
  git(dir, 'checkout', '-q', 'main');
  return { dir, url: pathToFileURL(dir).href };
}
