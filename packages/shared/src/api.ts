import type { Source } from './schemas.ts';

/** Kind of filesystem entry, as seen without following symlinks. */
export type EntryKind = 'file' | 'directory' | 'symlink';

/**
 * Result of comparing one relative path across the two directories.
 * - `identical`: present in both and byte-for-byte equal (for directories: every descendant identical)
 * - `modified`: present in both but different (for directories: contains differences)
 * - `only-left` / `only-right`: present in one directory only
 * - `error`: could not be read
 */
export type CompareStatus = 'identical' | 'modified' | 'only-left' | 'only-right' | 'error';

export interface EntryInfo {
  kind: EntryKind;
  /** Size in bytes (0 for directories). */
  size: number;
  mtimeMs: number;
  /** Link target, for symlinks only. */
  linkTarget?: string;
}

export interface CompareNode {
  /** Entry name ('' for the root). */
  name: string;
  /** Path relative to the compared roots, POSIX separators ('' for the root). */
  path: string;
  status: CompareStatus;
  left?: EntryInfo;
  right?: EntryInfo;
  /** Present when the entry is a directory on at least one side. Sorted: directories first, then by name. */
  children?: CompareNode[];
  error?: string;
}

/** Counts of non-directory entries (files and symlinks) by status. */
export interface CompareSummary {
  identical: number;
  modified: number;
  onlyLeft: number;
  onlyRight: number;
  errors: number;
}

export interface DirectoryCompareResult {
  /** Absolute root folders that were compared (a checkout folder for git sources). */
  left: string;
  right: string;
  /** Human-readable names for each side, e.g. a path or "repo @ branch". */
  leftLabel: string;
  rightLabel: string;
  root: CompareNode;
  summary: CompareSummary;
}

export interface FileContent {
  path: string;
  size: number;
  sha256: string;
  binary: boolean;
  /** Present for text files under the size limit. */
  content?: string;
  /** True when the file is text but too large to show. */
  tooLarge?: boolean;
}

export interface FileCompareResult {
  left?: FileContent;
  right?: FileContent;
  /** True when both files are present and byte-for-byte equal. */
  identical: boolean;
}

export interface ApiError {
  message: string;
}

/** Default folders the app compares when none are given (the repo's examples by default). */
export interface DefaultsResponse {
  left?: string;
  right?: string;
}

export interface SessionSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  repoCount: number;
}

export interface RepoInfo {
  id: string;
  url: string;
  /** Short display name, e.g. "delta" for https://github.com/acme/delta.git. */
  name: string;
  defaultBranch: string;
  branches: string[];
  /** When the repo was cloned or last fetched. */
  fetchedAt: string;
}

export interface RecentComparison {
  id: string;
  left: Source;
  right: Source;
  leftLabel: string;
  rightLabel: string;
  comparedAt: string;
}

export interface SessionDetail {
  user: string;
  session: SessionSummary;
  repos: RepoInfo[];
  recent: RecentComparison[];
}
