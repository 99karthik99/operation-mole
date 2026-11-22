import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, readFile, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import type { FileContent } from '@om/shared';
import { CompareInputError, NotFoundError, isErrnoException } from '../errors.ts';

const BINARY_SNIFF_BYTES = 8000;

async function sha256(abs: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(abs), hash);
  return hash.digest('hex');
}

/** Heuristic used by git and diff: a NUL byte in the first few KB means binary. */
async function looksBinary(abs: string): Promise<boolean> {
  const fh = await open(abs, 'r');
  try {
    const buf = Buffer.alloc(BINARY_SNIFF_BYTES);
    const { bytesRead } = await fh.read(buf, 0, BINARY_SNIFF_BYTES, 0);
    return buf.subarray(0, bytesRead).includes(0);
  } finally {
    await fh.close();
  }
}

/** Reads a file for display in the diff view. */
export async function readFileForDiff(abs: string, maxTextBytes: number): Promise<FileContent> {
  let size: number;
  try {
    const s = await stat(abs);
    if (!s.isFile()) throw new CompareInputError(`Not a file: ${abs}`);
    size = s.size;
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') {
      throw new NotFoundError(`File does not exist: ${abs}`);
    }
    throw err;
  }

  const [hash, isBinary] = await Promise.all([sha256(abs), looksBinary(abs)]);
  const result: FileContent = { path: abs, size, sha256: hash, binary: isBinary };
  if (!isBinary) {
    if (size > maxTextBytes) result.tooLarge = true;
    else result.content = await readFile(abs, 'utf8');
  }
  return result;
}
