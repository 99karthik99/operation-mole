import { describe, expect, it } from 'vitest';
import {
  addRepoRequestSchema,
  createSessionRequestSchema,
  directoryCompareRequestSchema,
  fileCompareQuerySchema,
  sourceSchema,
  usernameSchema,
} from './schemas.ts';

describe('directoryCompareRequestSchema', () => {
  it('accepts two absolute paths (shorthand) and normalizes them to path sources', () => {
    expect(directoryCompareRequestSchema.parse({ left: ' /a ', right: '/b' })).toEqual({
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
    expect(directoryCompareRequestSchema.parse(body)).toEqual(body);
  });

  it('rejects relative or empty paths', () => {
    expect(directoryCompareRequestSchema.safeParse({ left: 'a', right: '/b' }).success).toBe(false);
    expect(directoryCompareRequestSchema.safeParse({ left: '', right: '/b' }).success).toBe(false);
  });
});

describe('sourceSchema', () => {
  it('requires a repo and branch for git sources', () => {
    expect(sourceSchema.safeParse({ type: 'git', repoId: 'r1' }).success).toBe(false);
    expect(sourceSchema.safeParse({ type: 'git', repoId: 'r1', branch: '' }).success).toBe(false);
  });
});

describe('usernameSchema', () => {
  it('lowercases and trims', () => {
    expect(usernameSchema.parse('  Karthik ')).toBe('karthik');
  });

  it('allows letters, digits, dot, dash and underscore', () => {
    expect(usernameSchema.safeParse('k.m_3-x').success).toBe(true);
  });

  it('rejects empty, too long and unsafe names', () => {
    for (const bad of ['', 'a'.repeat(33), '../etc', 'a b', '.hidden', 'x/y']) {
      expect(usernameSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe('createSessionRequestSchema', () => {
  it('trims the name and allows spaces', () => {
    expect(createSessionRequestSchema.parse({ name: '  Release review ' })).toEqual({
      name: 'Release review',
    });
  });

  it('rejects empty and overly long names', () => {
    expect(createSessionRequestSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(createSessionRequestSchema.safeParse({ name: 'x'.repeat(61) }).success).toBe(false);
  });
});

describe('addRepoRequestSchema', () => {
  it('requires a URL', () => {
    expect(addRepoRequestSchema.safeParse({ url: ' ' }).success).toBe(false);
    expect(addRepoRequestSchema.parse({ url: ' https://github.com/a/b.git ' })).toEqual({
      url: 'https://github.com/a/b.git',
    });
  });
});

describe('fileCompareQuerySchema', () => {
  it('requires at least one side', () => {
    expect(fileCompareQuerySchema.safeParse({}).success).toBe(false);
    expect(fileCompareQuerySchema.safeParse({ left: '/a' }).success).toBe(true);
  });
});
