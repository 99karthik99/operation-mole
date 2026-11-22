import { describe, expect, it } from 'vitest';
import {
  AddRepoRequestSchema,
  CreateSessionRequestSchema,
  DirectoryCompareRequestSchema,
  FileCompareQuerySchema,
  SourceSchema,
  UsernameSchema,
} from './schemas.ts';

describe('DirectoryCompareRequestSchema', () => {
  it('accepts two absolute paths (shorthand) and normalizes them to path sources', () => {
    expect(DirectoryCompareRequestSchema.parse({ left: ' /a ', right: '/b' })).toEqual({
      left: { type: 'path', path: '/a' },
      right: { type: 'path', path: '/b' },
    });
  });

  it('accepts git sources and a session', () => {
    const body = {
      left: { type: 'git', repoId: 'r1', branch: 'main' },
      right: { type: 'path', path: '/b' },
      user: 'karthik',
      sessionId: 's1',
    };
    expect(DirectoryCompareRequestSchema.parse(body)).toEqual(body);
  });

  it('rejects relative or empty paths', () => {
    expect(DirectoryCompareRequestSchema.safeParse({ left: 'a', right: '/b' }).success).toBe(false);
    expect(DirectoryCompareRequestSchema.safeParse({ left: '', right: '/b' }).success).toBe(false);
  });

  it.each([
    '/home/me/repo',
    '/Users/me/repo',
    'C:\\Users\\me\\repo',
    'd:/work/repo',
    '\\\\server\\share\\repo',
    '//server/share/repo',
  ])('accepts the absolute path %s (Linux, macOS or Windows)', (p) => {
    expect(DirectoryCompareRequestSchema.safeParse({ left: p, right: '/b' }).success).toBe(true);
  });

  it.each(['C:', 'C:repo', 'repo\\sub', '.\\repo', '\\\\'])('rejects %s', (p) => {
    expect(DirectoryCompareRequestSchema.safeParse({ left: p, right: '/b' }).success).toBe(false);
  });
});

describe('SourceSchema', () => {
  it('requires a repo and branch for git sources', () => {
    expect(SourceSchema.safeParse({ type: 'git', repoId: 'r1' }).success).toBe(false);
    expect(SourceSchema.safeParse({ type: 'git', repoId: 'r1', branch: '' }).success).toBe(false);
  });
});

describe('UsernameSchema', () => {
  it('lowercases and trims', () => {
    expect(UsernameSchema.parse('  Karthik ')).toBe('karthik');
  });

  it('allows letters, digits, dot, dash and underscore', () => {
    expect(UsernameSchema.safeParse('k.m_3-x').success).toBe(true);
  });

  it('rejects empty, too long and unsafe names', () => {
    for (const bad of ['', 'a'.repeat(33), '../etc', 'a b', '.hidden', 'x/y']) {
      expect(UsernameSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe('CreateSessionRequestSchema', () => {
  it('trims the name and allows spaces', () => {
    expect(CreateSessionRequestSchema.parse({ name: '  Release review ' })).toEqual({
      name: 'Release review',
    });
  });

  it('rejects empty and overly long names', () => {
    expect(CreateSessionRequestSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(CreateSessionRequestSchema.safeParse({ name: 'x'.repeat(61) }).success).toBe(false);
  });
});

describe('AddRepoRequestSchema', () => {
  it('requires a URL', () => {
    expect(AddRepoRequestSchema.safeParse({ url: ' ' }).success).toBe(false);
    expect(AddRepoRequestSchema.parse({ url: ' https://github.com/a/b.git ' })).toEqual({
      url: 'https://github.com/a/b.git',
    });
  });
});

describe('FileCompareQuerySchema', () => {
  it('requires at least one side', () => {
    expect(FileCompareQuerySchema.safeParse({}).success).toBe(false);
    expect(FileCompareQuerySchema.safeParse({ left: '/a' }).success).toBe(true);
  });
});
