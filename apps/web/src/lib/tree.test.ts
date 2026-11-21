import { describe, expect, it } from 'vitest';
import { root } from '../test/fixtures.ts';
import {
  breadcrumbs,
  collectDirectoryPaths,
  findNode,
  flattenTree,
  joinPath,
  rowKey,
} from './tree.ts';

describe('findNode', () => {
  it('returns the root for an empty path', () => {
    expect(findNode(root, '')).toBe(root);
  });
  it('finds nested nodes', () => {
    expect(findNode(root, 'docs/old/a.txt')?.status).toBe('only-left');
  });
  it('prefers the folder when a file and a folder share a name', () => {
    expect(findNode(root, 'output')?.right?.kind).toBe('directory');
    expect(findNode(root, 'output/report.txt')?.status).toBe('only-right');
  });
  it('returns undefined for unknown paths', () => {
    expect(findNode(root, 'docs/nope')).toBeUndefined();
    expect(findNode(root, 'same.txt/child')).toBeUndefined();
  });
});

describe('flattenTree', () => {
  it('lists only direct children when nothing is expanded', () => {
    const rows = flattenTree(root, new Set(), 'all');
    expect(rows.map((r) => r.node.name)).toEqual([
      'docs',
      'src',
      'output',
      'new.txt',
      'output',
      'same.txt',
    ]);
    expect(rows.every((r) => r.depth === 0)).toBe(true);
    expect(rows[0]).toMatchObject({ isDirectory: true, expanded: false });
    expect(rows[3]).toMatchObject({ isDirectory: false, expanded: false });
  });

  it('includes children of expanded directories with increasing depth', () => {
    const rows = flattenTree(root, new Set(['docs', 'docs/old']), 'all');
    expect(rows.map((r) => [r.node.path, r.depth])).toEqual([
      ['docs', 0],
      ['docs/old', 1],
      ['docs/old/a.txt', 2],
      ['docs/guide.md', 1],
      ['docs/readme.md', 1],
      ['src', 0],
      ['output', 0],
      ['new.txt', 0],
      ['output', 0],
      ['same.txt', 0],
    ]);
    expect(rows[0]?.expanded).toBe(true);
  });

  it('starts from a subdirectory', () => {
    const docs = findNode(root, 'docs');
    if (!docs) throw new Error('fixture');
    expect(flattenTree(docs, new Set(), 'all').map((r) => r.node.name)).toEqual([
      'old',
      'guide.md',
      'readme.md',
    ]);
  });

  it('hides identical entries when filtering to differences', () => {
    const rows = flattenTree(root, new Set(['docs', 'src']), 'differences');
    expect(rows.map((r) => r.node.path)).toEqual([
      'docs',
      'docs/old',
      'docs/readme.md',
      'output',
      'new.txt',
      'output',
    ]);
  });
});

describe('breadcrumbs', () => {
  it('returns just the root for an empty path', () => {
    expect(breadcrumbs('')).toEqual([{ name: '', path: '' }]);
  });
  it('returns one crumb per segment', () => {
    expect(breadcrumbs('a/b/c')).toEqual([
      { name: '', path: '' },
      { name: 'a', path: 'a' },
      { name: 'b', path: 'a/b' },
      { name: 'c', path: 'a/b/c' },
    ]);
  });
});

describe('collectDirectoryPaths', () => {
  it('returns every descendant directory path', () => {
    expect(collectDirectoryPaths(root).sort()).toEqual(['docs', 'docs/old', 'output', 'src']);
  });
});

describe('joinPath', () => {
  it('joins a root and a relative path', () => {
    expect(joinPath('/a/b', 'c/d.txt')).toBe('/a/b/c/d.txt');
    expect(joinPath('/a/b/', 'c')).toBe('/a/b/c');
    expect(joinPath('/a', '')).toBe('/a');
    expect(joinPath('/', 'x')).toBe('/x');
  });
});

describe('rowKey', () => {
  it('is unique even when a file and a folder share a path', () => {
    const keys = flattenTree(root, new Set(), 'all').map((r) => rowKey(r.node));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
