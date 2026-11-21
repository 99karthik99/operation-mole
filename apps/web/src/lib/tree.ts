import type { CompareNode, CompareStatus } from '@om/shared';

/** Which entries the tree shows. A status shows entries with that status (and folders containing them). */
export type TreeFilter = 'all' | 'differences' | CompareStatus;

export interface TreeRow {
  node: CompareNode;
  depth: number;
  isDirectory: boolean;
  expanded: boolean;
}

export const isDirectory = (node: CompareNode): boolean => node.children !== undefined;

export function findNode(root: CompareNode, path: string): CompareNode | undefined {
  if (path === '') return root;
  let node: CompareNode | undefined = root;
  for (const part of path.split('/')) {
    const matches: CompareNode[] = node.children?.filter((c) => c.name === part) ?? [];
    // A file and a folder may share a name (one per side); paths address the folder.
    node = matches.find(isDirectory) ?? matches[0];
    if (!node) return undefined;
  }
  return node;
}

/** Stable unique key for a row: a file and a folder can share a path. */
export function rowKey(node: CompareNode): string {
  return `${node.path}\u0000${isDirectory(node) ? 'dir' : 'entry'}`;
}

function matches(node: CompareNode, filter: TreeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'differences') return node.status !== 'identical';
  return node.status === filter;
}

/** True if the node or any descendant matches the filter. */
function visible(node: CompareNode, filter: TreeFilter): boolean {
  return matches(node, filter) || (node.children?.some((c) => visible(c, filter)) ?? false);
}

/** Flattens the children of `dir` into display rows, descending into expanded directories. */
export function flattenTree(
  dir: CompareNode,
  expanded: ReadonlySet<string>,
  filter: TreeFilter,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (node: CompareNode, depth: number) => {
    for (const child of node.children ?? []) {
      if (!visible(child, filter)) continue;
      const dirChild = isDirectory(child);
      const isExpanded = dirChild && expanded.has(child.path);
      rows.push({ node: child, depth, isDirectory: dirChild, expanded: isExpanded });
      if (isExpanded) walk(child, depth + 1);
    }
  };
  walk(dir, 0);
  return rows;
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbs(path: string): Crumb[] {
  const crumbs: Crumb[] = [{ name: '', path: '' }];
  if (path === '') return crumbs;
  const parts = path.split('/');
  parts.forEach((name, i) => crumbs.push({ name, path: parts.slice(0, i + 1).join('/') }));
  return crumbs;
}

export function collectDirectoryPaths(node: CompareNode): string[] {
  const paths: string[] = [];
  const walk = (n: CompareNode) => {
    for (const child of n.children ?? []) {
      if (isDirectory(child)) {
        paths.push(child.path);
        walk(child);
      }
    }
  };
  walk(node);
  return paths;
}

/** Joins an absolute root and a POSIX relative path. */
export function joinPath(root: string, rel: string): string {
  if (rel === '') return root;
  return `${root.replace(/\/+$/, '')}/${rel}`;
}
