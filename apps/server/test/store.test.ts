import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError } from '../src/errors.ts';
import { Store } from '../src/store/store.ts';

let store: Store;
let tick: number;

beforeEach(() => {
  tick = 0;
  // Deterministic clock: each call is one second later.
  store = new Store(':memory:', { now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)) });
});

const repoInput = (sessionId: string, url = 'https://example.com/acme/app.git') => ({
  sessionId,
  url,
  name: 'app',
  defaultBranch: 'main',
  branches: ['main', 'dev'],
});

describe('sessions', () => {
  it('creates and lists sessions per user, newest activity first', () => {
    const a = store.createSession('karthik', 'First');
    store.createSession('karthik', 'Second');
    store.createSession('someone', 'Theirs');

    expect(a).toMatchObject({ name: 'First', repoCount: 0 });
    expect(a.id).toMatch(/^[a-z0-9-]+$/);
    expect(store.listSessions('karthik').map((s) => s.name)).toEqual(['Second', 'First']);

    store.touchSession('karthik', a.id);
    expect(store.listSessions('karthik').map((s) => s.name)).toEqual(['First', 'Second']);
    expect(store.listSessions('nobody')).toEqual([]);
  });

  it('rejects a duplicate session name for the same user, ignoring case', () => {
    store.createSession('karthik', 'Review');
    expect(() => store.createSession('karthik', 'review')).toThrow(ConflictError);
    expect(() => store.createSession('other', 'Review')).not.toThrow();
  });

  it('only returns a session to its owner', () => {
    const s = store.createSession('karthik', 'Mine');
    expect(store.getSession('karthik', s.id)?.name).toBe('Mine');
    expect(store.getSession('someone', s.id)).toBeUndefined();
  });

  it('deletes a session with its repos and comparisons', () => {
    const s = store.createSession('karthik', 'Temp');
    store.saveRepo(repoInput(s.id));
    store.recordComparison(s.id, {
      left: { type: 'path', path: '/a' },
      right: { type: 'path', path: '/b' },
      leftLabel: '/a',
      rightLabel: '/b',
    });
    expect(store.deleteSession('someone', s.id)).toBe(false);
    expect(store.deleteSession('karthik', s.id)).toBe(true);
    expect(store.getSession('karthik', s.id)).toBeUndefined();
    expect(store.listRepos(s.id)).toEqual([]);
    expect(store.listComparisons(s.id)).toEqual([]);
  });
});

describe('repos', () => {
  it('saves repos per session and counts them', () => {
    const s = store.createSession('karthik', 'Repos');
    const repo = store.saveRepo(repoInput(s.id));
    expect(repo).toMatchObject({
      url: 'https://example.com/acme/app.git',
      branches: ['main', 'dev'],
    });
    expect(store.getRepo(s.id, repo.id)).toEqual(repo);
    expect(store.findRepoByUrl(s.id, 'https://example.com/acme/app.git')?.id).toBe(repo.id);
    expect(store.listSessions('karthik')[0]?.repoCount).toBe(1);
  });

  it('updates an existing repo instead of duplicating it', () => {
    const s = store.createSession('karthik', 'Repos');
    const first = store.saveRepo(repoInput(s.id));
    const second = store.saveRepo({
      ...repoInput(s.id),
      id: first.id,
      branches: ['main', 'dev', 'new'],
    });
    expect(second.id).toBe(first.id);
    expect(store.listRepos(s.id)).toHaveLength(1);
    expect(store.getRepo(s.id, first.id)?.branches).toEqual(['main', 'dev', 'new']);
    expect(second.fetchedAt > first.fetchedAt).toBe(true);
  });

  it('keeps repos separate between sessions', () => {
    const a = store.createSession('karthik', 'A');
    const b = store.createSession('karthik', 'B');
    const repo = store.saveRepo(repoInput(a.id));
    expect(store.getRepo(b.id, repo.id)).toBeUndefined();
    expect(store.findRepoByUrl(b.id, repo.url)).toBeUndefined();
  });
});

describe('recent comparisons', () => {
  const cmp = (l: string, r: string) => ({
    left: { type: 'path' as const, path: l },
    right: { type: 'path' as const, path: r },
    leftLabel: l,
    rightLabel: r,
  });

  it('lists comparisons newest first and moves a repeated one to the top', () => {
    const s = store.createSession('karthik', 'Recents');
    store.recordComparison(s.id, cmp('/a', '/b'));
    store.recordComparison(s.id, cmp('/c', '/d'));
    store.recordComparison(s.id, cmp('/a', '/b'));
    expect(store.listComparisons(s.id).map((c) => c.leftLabel)).toEqual(['/a', '/c']);
  });

  it('keeps only the 20 most recent', () => {
    const s = store.createSession('karthik', 'Many');
    for (let i = 0; i < 25; i++) store.recordComparison(s.id, cmp(`/l${i}`, '/r'));
    const list = store.listComparisons(s.id);
    expect(list).toHaveLength(20);
    expect(list[0]?.leftLabel).toBe('/l24');
  });

  it('counts as session activity', () => {
    const a = store.createSession('karthik', 'A');
    store.createSession('karthik', 'B');
    store.recordComparison(a.id, cmp('/x', '/y'));
    expect(store.listSessions('karthik')[0]?.name).toBe('A');
  });
});
