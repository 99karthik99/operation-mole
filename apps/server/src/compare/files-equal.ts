import { open, stat } from 'node:fs/promises';

const CHUNK_SIZE = 64 * 1024;

/** Byte-for-byte comparison of two regular files. Stops at the first differing chunk. */
export async function filesEqual(a: string, b: string): Promise<boolean> {
  const [statA, statB] = await Promise.all([stat(a), stat(b)]);
  if (statA.size !== statB.size) return false;
  if (statA.size === 0) return true;

  const fa = await open(a, 'r');
  let fb;
  try {
    fb = await open(b, 'r');
  } catch (err) {
    await fa.close();
    throw err;
  }
  try {
    const bufA = Buffer.allocUnsafe(CHUNK_SIZE);
    const bufB = Buffer.allocUnsafe(CHUNK_SIZE);
    for (;;) {
      const [ra, rb] = await Promise.all([
        fa.read(bufA, 0, CHUNK_SIZE, null),
        fb.read(bufB, 0, CHUNK_SIZE, null),
      ]);
      if (ra.bytesRead !== rb.bytesRead) return false;
      if (ra.bytesRead === 0) return true;
      if (!bufA.subarray(0, ra.bytesRead).equals(bufB.subarray(0, rb.bytesRead))) return false;
    }
  } finally {
    await Promise.all([fa.close(), fb.close()]);
  }
}
