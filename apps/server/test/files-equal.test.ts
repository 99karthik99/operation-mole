import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { filesEqual } from '../src/compare/files-equal.ts';
import { createWorkspace, writeTree } from './fixtures.ts';

let ws: Awaited<ReturnType<typeof createWorkspace>>;
const p = (name: string) => path.join(ws.base, name);

beforeAll(async () => {
  ws = await createWorkspace();
  const big = Buffer.alloc(1024 * 1024 + 17, 7);
  const bigDiffLast = Buffer.from(big);
  bigDiffLast[bigDiffLast.length - 1] = 8;
  await writeTree(ws.base, {
    a: 'hello world',
    b: 'hello world',
    c: 'hello World',
    d: 'hello world!',
    empty1: '',
    empty2: '',
    big1: big,
    big2: Buffer.from(big),
    big3: bigDiffLast,
  });
});
afterAll(() => ws.cleanup());

describe('filesEqual', () => {
  it('returns true for byte-identical files', async () => {
    expect(await filesEqual(p('a'), p('b'))).toBe(true);
  });

  it('returns false for same-size files with different bytes', async () => {
    expect(await filesEqual(p('a'), p('c'))).toBe(false);
  });

  it('returns false for files of different size', async () => {
    expect(await filesEqual(p('a'), p('d'))).toBe(false);
  });

  it('treats two empty files as equal', async () => {
    expect(await filesEqual(p('empty1'), p('empty2'))).toBe(true);
  });

  it('compares files larger than the read buffer', async () => {
    expect(await filesEqual(p('big1'), p('big2'))).toBe(true);
    expect(await filesEqual(p('big1'), p('big3'))).toBe(false);
  });
});
