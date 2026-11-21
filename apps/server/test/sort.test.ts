import { describe, expect, it } from 'vitest';
import { compareNames } from '../src/compare/sort.ts';

const sorted = (names: string[]) => [...names].sort(compareNames);

describe('compareNames', () => {
  it('sorts ascending, ignoring case', () => {
    expect(sorted(['README.md', 'notes.txt', 'LICENSE', 'config.json'])).toEqual([
      'config.json',
      'LICENSE',
      'notes.txt',
      'README.md',
    ]);
  });

  it('orders numbers by value (natural order)', () => {
    expect(sorted(['file10.txt', 'file2.txt', 'file1.txt'])).toEqual([
      'file1.txt',
      'file2.txt',
      'file10.txt',
    ]);
  });

  it('breaks ties between names differing only in case deterministically', () => {
    expect(sorted(['a.txt', 'A.txt'])).toEqual(['A.txt', 'a.txt']);
    expect(sorted(['A.txt', 'a.txt'])).toEqual(['A.txt', 'a.txt']);
  });
});
