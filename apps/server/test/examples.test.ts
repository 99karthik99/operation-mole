import { fileURLToPath } from 'node:url';
import type { CompareNode, CompareStatus, EntryKind } from '@om/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { compareDirectories } from '../src/compare/compare-directories.ts';
import { hasExampleSymlinks } from './capabilities.ts';

/**
 * The repo's examples/ folders double as a demo of every case the app handles.
 * This test keeps them honest: if a case disappears, it fails.
 */
const examples = (side: string) =>
  fileURLToPath(new URL(`../../../examples/${side}`, import.meta.url));

let root: CompareNode;
beforeAll(async () => {
  ({ root } = await compareDirectories(examples('left'), examples('right')));
});

const kindOf = (n: CompareNode): EntryKind | undefined => (n.left ?? n.right)?.kind;

/** Find a node; `kind` picks between a file and a folder that share a name. */
function find(path: string, kind?: EntryKind): CompareNode {
  let node = root;
  const parts = path.split('/');
  for (const [i, part] of parts.entries()) {
    const isLast = i === parts.length - 1;
    const matches = node.children?.filter((c) => c.name === part) ?? [];
    const next =
      isLast && kind !== undefined
        ? matches.find((c) => kindOf(c) === kind)
        : (matches.find((c) => c.children) ?? matches[0]);
    if (!next) throw new Error(`examples are missing ${path}`);
    node = next;
  }
  return node;
}

const names = (path: string) => (path === '' ? root : find(path)).children?.map((c) => c.name);

describe('examples cover every case', () => {
  it.each<[string, CompareStatus, EntryKind?]>([
    // identical
    ['README.md', 'identical'],
    ['src/index.ts', 'identical'],
    ['assets/logo.png', 'identical'],
    ['whitespace/empty.txt', 'identical'],
    ['vendor', 'identical'],
    ['vendor/lib/core.js', 'identical'],
    ['empty-both', 'identical'],
    ['2024', 'identical'],
    ['numbered/1', 'identical'],
    ['numbered/007', 'identical'],
    ['numbered/2', 'modified'],
    ['numbered/3', 'only-left'],
    ['numbered/100', 'only-left'],
    ['numbered/7', 'only-right'],
    ['numbered/20', 'only-right'],
    ['2025', 'only-right'],
    ['404.html', 'identical'],
    ['numbered/01.txt', 'identical'],
    ['numbered/1.txt', 'identical'],
    ['numbered/10.txt', 'identical'],
    ['numbered/1000.log', 'identical'],
    ['numbered/2.txt', 'modified'],
    ['numbered/50', 'modified'],
    ['numbered/1.5.txt', 'only-left'],
    ['numbered/20.md', 'only-left'],
    ['numbered/3.csv', 'only-right'],
    ['numbered/5', 'only-right'],
    ['numbered/100.txt', 'only-right'],
    ['links/same-target', 'identical'],
    // different
    ['config.json', 'modified'],
    ['src/utils/strings.ts', 'modified'],
    ['assets/banner.bin', 'modified'],
    ['whitespace/trailing-space.txt', 'modified'],
    ['whitespace/line-endings.txt', 'modified'],
    ['links/changed-target', 'modified'],
    ['links/link-or-file', 'modified'],
    ['src', 'modified'],
    // only in base
    ['notes.txt', 'only-left'],
    ['docs/legacy', 'only-left'],
    ['docs/legacy/migration.txt', 'only-left'],
    ['empty-in-base', 'only-left'],
    ['output', 'only-left', 'file'],
    // only in target
    ['LICENSE', 'only-right'],
    ['tests', 'only-right'],
    ['tests/strings.test.ts', 'only-right'],
    ['links/only-in-target', 'only-right'],
    ['output', 'only-right', 'directory'],
  ])('%s is %s', (path, status, kind) => {
    expect(find(path, kind).status).toBe(status);
  });

  // Git checks symlinks out as plain files when core.symlinks is false (the Windows default).
  it.runIf(hasExampleSymlinks)('has symlinks on both sides', () => {
    expect(find('links/same-target').left?.kind).toBe('symlink');
    expect(find('links/link-or-file').left?.kind).toBe('symlink');
    expect(find('links/link-or-file').right?.kind).toBe('file');
  });

  it('has empty folders', () => {
    expect(find('empty-both').children).toEqual([]);
    expect(find('empty-in-base').children).toEqual([]);
  });
});

describe('examples show the sort order', () => {
  it('lists folders first, then files, at the root', () => {
    expect(names('')).toEqual([
      '2024',
      '2025',
      'assets',
      'docs',
      'empty-both',
      'empty-in-base',
      'links',
      'numbered',
      'output',
      'sorting',
      'src',
      'tests',
      'vendor',
      'whitespace',
      '404.html',
      'config.json',
      'entry',
      'LICENSE',
      'notes.txt',
      'output',
      'README.md',
    ]);
  });

  it('sorts symbols, numbers by value, case-insensitive letters and accents in sorting/', () => {
    expect(names('sorting')).toEqual([
      // folders
      '_private',
      '.config',
      '2024-archive',
      'Alpha',
      'beta',
      'v2',
      'v10',
      'Zulu',
      // files
      '_notes.txt',
      '.env',
      '9-nine.txt',
      '10-ten.txt',
      'a.txt',
      'B.txt',
      'c.txt',
      'file1.txt',
      'file2.txt',
      'File3.txt',
      'file10.txt',
      'my notes.txt',
      'report.txt',
      'résumé.txt',
      'Z.txt',
    ]);
  });

  it('sorts folders, then files, with numeric names by value in numbered/', () => {
    expect(names('numbered')).toEqual([
      // folders
      '1',
      '2',
      '3',
      '007',
      '7',
      '10',
      '20',
      '100',
      '1000',
      // files
      '1.5.txt',
      '01.txt',
      '1.txt',
      '2.txt',
      '3.csv',
      '5',
      '10.txt',
      '20.md',
      '50',
      '100.txt',
      '1000.log',
    ]);
  });

  it('interleaves entries from both sides in one order', () => {
    const sides = (path: string) => {
      const n = find(path);
      return n.left && n.right ? 'both' : n.left ? 'base' : 'target';
    };
    expect(
      ['sorting/v2', 'sorting/v10', 'sorting/file2.txt', 'sorting/file10.txt'].map(sides),
    ).toEqual(['base', 'target', 'base', 'target']);
  });
});
