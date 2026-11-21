import { describe, expect, it } from 'vitest';
import { sourceFromParams, sourceLabel, sourcesSearch } from './sources.ts';

describe('sourceFromParams', () => {
  it('reads a folder path', () => {
    expect(sourceFromParams(new URLSearchParams('left=%2Fa'), 'left')).toEqual({
      type: 'path',
      path: '/a',
    });
  });

  it('reads a git repo and branch', () => {
    const params = new URLSearchParams('rightRepo=r1&rightBranch=feature%2Fx');
    expect(sourceFromParams(params, 'right')).toEqual({
      type: 'git',
      repoId: 'r1',
      branch: 'feature/x',
    });
  });

  it('returns undefined when the side is missing or incomplete', () => {
    expect(sourceFromParams(new URLSearchParams(''), 'left')).toBeUndefined();
    expect(sourceFromParams(new URLSearchParams('leftRepo=r1'), 'left')).toBeUndefined();
  });
});

describe('sourcesSearch', () => {
  it('writes both sides and round-trips', () => {
    const left = { type: 'git' as const, repoId: 'r1', branch: 'main' };
    const right = { type: 'path' as const, path: '/tmp/x' };
    const search = sourcesSearch(left, right);
    expect(search).toBe('?leftRepo=r1&leftBranch=main&right=%2Ftmp%2Fx');
    const params = new URLSearchParams(search);
    expect(sourceFromParams(params, 'left')).toEqual(left);
    expect(sourceFromParams(params, 'right')).toEqual(right);
  });
});

describe('sourceLabel', () => {
  const repos = [{ id: 'r1', name: 'app' }];
  it('names git sources by repo and branch, folders by path', () => {
    expect(sourceLabel({ type: 'git', repoId: 'r1', branch: 'dev' }, repos)).toBe('app @ dev');
    expect(sourceLabel({ type: 'path', path: '/a/b' }, repos)).toBe('/a/b');
    expect(sourceLabel({ type: 'git', repoId: 'gone', branch: 'dev' }, repos)).toBe(
      'unknown repo @ dev',
    );
  });
});
