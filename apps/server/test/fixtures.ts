import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** A directory spec: string/Buffer = file contents, object = subdirectory, { symlink } = symbolic link. */
export type TreeSpec = {
  [name: string]: string | Buffer | TreeSpec | { symlink: string };
};

function isSymlink(v: unknown): v is { symlink: string } {
  return typeof v === 'object' && v !== null && !Buffer.isBuffer(v) && 'symlink' in v;
}

export async function writeTree(root: string, spec: TreeSpec): Promise<void> {
  await mkdir(root, { recursive: true });
  for (const [name, value] of Object.entries(spec)) {
    const target = path.join(root, name);
    if (typeof value === 'string' || Buffer.isBuffer(value)) {
      await writeFile(target, value);
    } else if (isSymlink(value)) {
      await symlink(value.symlink, target);
    } else {
      await writeTree(target, value);
    }
  }
}

/** A temp folder for one test file, with helpers to build left/right trees in it. */
export type Workspace = {
  readonly base: string;
  /** Writes `left` and `right` into a fresh subfolder and returns their paths. */
  pair(left: TreeSpec, right: TreeSpec): Promise<{ left: string; right: string }>;
  cleanup(): Promise<void>;
};

/** Creates a temp workspace; returns helpers to build left/right trees and clean up. */
export async function createWorkspace(): Promise<Workspace> {
  const base = await mkdtemp(path.join(tmpdir(), 'om-test-'));
  return {
    base,
    async pair(left: TreeSpec, right: TreeSpec) {
      const id = Math.random().toString(36).slice(2);
      const l = path.join(base, id, 'left');
      const r = path.join(base, id, 'right');
      await writeTree(l, left);
      await writeTree(r, right);
      return { left: l, right: r };
    },
    async cleanup() {
      await rm(base, { recursive: true, force: true });
    },
  };
}
