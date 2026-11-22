import type { RepoInfo, Source } from '@om/shared';

/** One side of a comparison: `left` is Base, `right` is Target in the UI. */
export type Side = 'left' | 'right';

/**
 * A side lives in the URL as either `left=/abs/path` or `leftRepo=<id>&leftBranch=<name>`
 * (same for `right`), so reloads and bookmarks restore the comparison.
 */
export function sourceFromParams(params: URLSearchParams, side: Side): Source | undefined {
  const path = params.get(side);
  if (path !== null && path !== '') return { type: 'path', path };
  const repoId = params.get(`${side}Repo`);
  const branch = params.get(`${side}Branch`);
  if (repoId !== null && repoId !== '' && branch !== null && branch !== '') {
    return { type: 'git', repoId, branch };
  }
  return undefined;
}

function writeSource(params: URLSearchParams, side: Side, source: Source): void {
  if (source.type === 'path') {
    params.set(side, source.path);
  } else {
    params.set(`${side}Repo`, source.repoId);
    params.set(`${side}Branch`, source.branch);
  }
}

/** The `?left…&right…` query string for two sources, in the format {@link sourceFromParams} reads. */
export function sourcesSearch(left: Source, right: Source): string {
  const params = new URLSearchParams();
  writeSource(params, 'left', left);
  writeSource(params, 'right', right);
  return `?${params}`;
}

/** Display name for a source: its path, or `repo @ branch` (`unknown repo` if the repo is gone). */
export function sourceLabel(source: Source, repos: Array<Pick<RepoInfo, 'id' | 'name'>>): string {
  if (source.type === 'path') return source.path;
  const repo = repos.find((r) => r.id === source.repoId);
  return `${repo?.name ?? 'unknown repo'} @ ${source.branch}`;
}
