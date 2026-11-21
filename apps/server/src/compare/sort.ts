import type { CompareNode } from '@om/shared';

// Fixed locale so the order is the same on every machine.
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Natural, case-insensitive ascending order; names differing only in case fall back to code-point order. */
export function compareNames(a: string, b: string): number {
  return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}

const isDirectory = (n: CompareNode) => n.children !== undefined;

/** All folders first, then all other entries (files, symlinks), each group by `compareNames`. */
export function sortNodes(nodes: CompareNode[]): CompareNode[] {
  return nodes.sort(
    (a, b) => Number(isDirectory(b)) - Number(isDirectory(a)) || compareNames(a.name, b.name),
  );
}
