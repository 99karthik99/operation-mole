import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CompareInputError } from '../src/errors.ts';
import { GitService } from '../src/git/git-service.ts';
import { commit, createOrigin, git } from './git-fixtures.ts';

let base: string;
let origin: { dir: string; url: string };
const service = new GitService({ allowedProtocols: ['https', 'ssh', 'file'] });

beforeAll(async () => {
  base = await mkdtemp(path.join(tmpdir(), 'om-git-'));
  origin = createOrigin(path.join(base, 'origin'));
});
afterAll(() => rm(base, { recursive: true, force: true }));

const read = (...parts: string[]) => readFileSync(path.join(...parts), 'utf8');

describe('validateUrl', () => {
  const strict = new GitService();

  it.each([
    'https://github.com/acme/app.git',
    'https://gitlab.example.com/group/sub/app',
    'ssh://git@github.com/acme/app.git',
    'git@github.com:acme/app.git',
  ])('accepts %s', (url) => {
    expect(() => {
      strict.validateUrl(url);
    }).not.toThrow();
  });

  it.each([
    'file:///etc',
    '/local/path',
    'http://insecure.example.com/a.git',
    'ext::sh -c touch% /tmp/pwned',
    '--upload-pack=touch /tmp/x',
    'https://github.com/a b.git',
    '',
  ])('rejects %s', (url) => {
    expect(() => {
      strict.validateUrl(url);
    }).toThrow(CompareInputError);
  });

  it('allows file:// only when configured', () => {
    expect(() => {
      service.validateUrl(origin.url);
    }).not.toThrow();
  });
});

describe('repoName', () => {
  it.each([
    ['https://github.com/acme/app.git', 'app'],
    ['git@github.com:acme/my-lib.git', 'my-lib'],
    ['https://example.com/group/tool/', 'tool'],
  ])('%s -> %s', (url, name) => {
    expect(GitService.repoName(url)).toBe(name);
  });
});

describe('clone, checkout and fetch', () => {
  let repoDir: string;
  const wt = (branch: string) => path.join(base, 'worktrees', encodeURIComponent(branch));

  beforeAll(async () => {
    repoDir = path.join(base, 'clone');
    await service.clone(origin.url, repoDir);
  });

  it('lists branches and the default branch', async () => {
    expect(await service.branches(repoDir)).toEqual({
      defaultBranch: 'main',
      branches: ['dev', 'feature/x', 'main'],
    });
  });

  it('checks out a branch into its own folder', async () => {
    const main = await service.checkout(repoDir, 'main', wt('main'));
    expect(read(main, 'src', 'app.ts')).toBe('export const v = 1;\n');
    expect(existsSync(path.join(main, 'src', 'new.ts'))).toBe(false);
    // A worktree's .git is a file pointing back at the clone.
    expect(lstatSync(path.join(main, '.git')).isFile()).toBe(true);

    const dev = await service.checkout(repoDir, 'dev', wt('dev'));
    expect(read(dev, 'src', 'app.ts')).toBe('export const v = 2;\n');

    const feature = await service.checkout(repoDir, 'feature/x', wt('feature/x'));
    expect(read(feature, 'docs', 'x.md')).toBe('x\n');
  });

  it('reuses an existing checkout that is up to date', async () => {
    const first = await service.checkout(repoDir, 'main', wt('main'));
    const second = await service.checkout(repoDir, 'main', wt('main'));
    expect(second).toBe(first);
  });

  it('rejects an unknown branch', async () => {
    await expect(service.checkout(repoDir, 'nope', wt('nope'))).rejects.toThrow(/branch "nope"/i);
  });

  it('picks up new commits and branches only after fetching', async () => {
    commit(origin.dir, { 'src/app.ts': 'export const v = 3;\n' }, 'main moves');
    git(origin.dir, 'checkout', '-q', '-b', 'hotfix');
    commit(origin.dir, { 'fix.txt': 'fix\n' }, 'hotfix');
    git(origin.dir, 'checkout', '-q', 'main');

    // Not fetched yet: the old commit is still checked out.
    expect(read(await service.checkout(repoDir, 'main', wt('main')), 'src', 'app.ts')).toBe(
      'export const v = 1;\n',
    );

    expect((await service.fetch(repoDir)).branches).toEqual(['dev', 'feature/x', 'hotfix', 'main']);
    expect(read(await service.checkout(repoDir, 'main', wt('main')), 'src', 'app.ts')).toBe(
      'export const v = 3;\n',
    );
  });

  it('drops branches deleted on the remote when fetching', async () => {
    git(origin.dir, 'branch', '-q', '-D', 'hotfix');
    expect((await service.fetch(repoDir)).branches).not.toContain('hotfix');
  });
});

describe('clone errors', () => {
  it('reports a repo that cannot be cloned', async () => {
    const missing = new URL('file:///definitely/not/a/repo').href;
    await expect(service.clone(missing, path.join(base, 'bad'))).rejects.toThrow(CompareInputError);
    expect(existsSync(path.join(base, 'bad'))).toBe(false);
  });
});
