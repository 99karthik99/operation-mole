import { lstat, readdir, readlink } from 'node:fs/promises';
import path from 'node:path';
import type {
  CompareNode,
  CompareStatus,
  CompareSummary,
  DirectoryCompareResult,
  EntryInfo,
} from '@om/shared';
import { CompareInputError, errorMessage, isErrnoException } from '../errors.ts';
import { filesEqual } from './files-equal.ts';
import { createLimiter } from './limit.ts';
import { sortNodes } from './sort.ts';

export { CompareInputError };

/** Max concurrent filesystem operations, to avoid exhausting file descriptors. */
const limit = createLimiter(32);

async function entryInfo(abs: string): Promise<EntryInfo> {
  const s = await limit(() => lstat(abs));
  if (s.isSymbolicLink()) {
    return { kind: 'symlink', size: s.size, mtimeMs: s.mtimeMs, linkTarget: await readlink(abs) };
  }
  if (s.isDirectory()) return { kind: 'directory', size: 0, mtimeMs: s.mtimeMs };
  return { kind: 'file', size: s.size, mtimeMs: s.mtimeMs };
}

async function rootInfo(abs: string): Promise<EntryInfo> {
  try {
    const info = await entryInfo(abs);
    if (info.kind !== 'directory') throw new CompareInputError(`Not a directory: ${abs}`);
    return info;
  } catch (err) {
    if (err instanceof CompareInputError) throw err;
    if (isErrnoException(err) && err.code === 'ENOENT') {
      throw new CompareInputError(`Directory does not exist: ${abs}`);
    }
    throw new CompareInputError(`Cannot read ${abs}: ${errorMessage(err)}`);
  }
}

async function listDir(abs: string | undefined): Promise<string[]> {
  return abs === undefined ? [] : await limit(() => readdir(abs));
}

type Side = {
  abs: string;
  info: EntryInfo;
};

type RootIgnore = {
  left?: readonly string[];
  right?: readonly string[];
};

async function compareChildren(
  rel: string,
  left: string | undefined,
  right: string | undefined,
  ignore: RootIgnore = {},
): Promise<CompareNode[]> {
  const without = (names: string[], skip: readonly string[] = []) =>
    names.filter((n) => !skip.includes(n));
  const [leftNames, rightNames] = await Promise.all([
    listDir(left).then((n) => without(n, ignore.left)),
    listDir(right).then((n) => without(n, ignore.right)),
  ]);
  const names = [...new Set([...leftNames, ...rightNames])];
  const leftSet = new Set(leftNames);
  const rightSet = new Set(rightNames);

  const nodes = await Promise.all(
    names.map(async (name): Promise<CompareNode | CompareNode[]> => {
      const childRel = rel === '' ? name : `${rel}/${name}`;
      const lAbs = left !== undefined && leftSet.has(name) ? path.join(left, name) : undefined;
      const rAbs = right !== undefined && rightSet.has(name) ? path.join(right, name) : undefined;
      try {
        const [l, r] = await Promise.all([
          lAbs === undefined ? undefined : entryInfo(lAbs).then((info) => ({ abs: lAbs, info })),
          rAbs === undefined ? undefined : entryInfo(rAbs).then((info) => ({ abs: rAbs, info })),
        ]);
        // A folder and a non-folder can't be compared: list them as two one-sided entries.
        if (l && r && (l.info.kind === 'directory') !== (r.info.kind === 'directory')) {
          return await Promise.all([
            compareNode(name, childRel, l, undefined),
            compareNode(name, childRel, undefined, r),
          ]);
        }
        return await compareNode(name, childRel, l, r);
      } catch (err) {
        return { name, path: childRel, status: 'error', error: errorMessage(err) };
      }
    }),
  );
  return sortNodes(nodes.flat());
}

async function leafStatus(l: Side, r: Side): Promise<CompareStatus> {
  if (l.info.kind !== r.info.kind) return 'modified';
  if (l.info.kind === 'symlink') {
    return l.info.linkTarget === r.info.linkTarget ? 'identical' : 'modified';
  }
  if (l.info.size !== r.info.size) return 'modified';
  return (await limit(() => filesEqual(l.abs, r.abs))) ? 'identical' : 'modified';
}

async function compareNode(
  name: string,
  rel: string,
  l: Side | undefined,
  r: Side | undefined,
  ignore?: RootIgnore,
): Promise<CompareNode> {
  const node: CompareNode = { name, path: rel, status: 'identical' };
  if (l) node.left = l.info;
  if (r) node.right = r.info;

  const lDir = l?.info.kind === 'directory' ? l.abs : undefined;
  const rDir = r?.info.kind === 'directory' ? r.abs : undefined;

  try {
    if (lDir !== undefined || rDir !== undefined) {
      node.children = await compareChildren(rel, lDir, rDir, ignore);
    }
    if (!r) node.status = 'only-left';
    else if (!l) node.status = 'only-right';
    else if (lDir !== undefined && rDir !== undefined) {
      node.status = (node.children ?? []).every((c) => c.status === 'identical')
        ? 'identical'
        : 'modified';
    } else {
      node.status = await leafStatus(l, r);
    }
  } catch (err) {
    node.status = 'error';
    node.error = errorMessage(err);
  }
  return node;
}

function summarize(root: CompareNode): CompareSummary {
  const summary: CompareSummary = {
    identical: 0,
    modified: 0,
    onlyLeft: 0,
    onlyRight: 0,
    errors: 0,
  };
  const visit = (node: CompareNode) => {
    const sides = [node.left, node.right].filter((s) => s !== undefined);
    const isFolder = sides.length > 0 && sides.every((s) => s.kind === 'directory');
    if (node.status === 'error') summary.errors++;
    else if (!isFolder) {
      if (node.status === 'identical') summary.identical++;
      else if (node.status === 'modified') summary.modified++;
      else if (node.status === 'only-left') summary.onlyLeft++;
      else summary.onlyRight++;
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return summary;
}

/** Recursively compares two directory trees by relative path and byte content. */
export type CompareOptions = {
  /** Entry names to skip at the top level of each side (e.g. a git checkout's `.git`). */
  ignoreAtRoot?: RootIgnore;
  leftLabel?: string;
  rightLabel?: string;
};

/**
 * Recursively compares two folders by relative path and byte content. Symlinks are compared by
 * target, never followed; folders come first, then files (see sort.ts).
 *
 * @throws CompareInputError when a root does not exist or is not a folder.
 */
export async function compareDirectories(
  left: string,
  right: string,
  options: CompareOptions = {},
): Promise<DirectoryCompareResult> {
  const [leftInfo, rightInfo] = await Promise.all([rootInfo(left), rootInfo(right)]);
  const root = await compareNode(
    '',
    '',
    { abs: left, info: leftInfo },
    { abs: right, info: rightInfo },
    options.ignoreAtRoot,
  );
  return {
    left,
    right,
    leftLabel: options.leftLabel ?? left,
    rightLabel: options.rightLabel ?? right,
    root,
    summary: summarize(root),
  };
}
