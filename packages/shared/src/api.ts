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

/** One side of a compared entry, as seen by `lstat` (symlinks are not followed). */
export type EntryInfo = {
  kind: EntryKind;
  /** Size in bytes (0 for directories). */
  size: number;
  mtimeMs: number;
  /** Link target, for symlinks only. */
  linkTarget?: string;
};

/** One entry of a folder comparison; folders carry their children. */
export type CompareNode = {
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
};

/** Counts of non-directory entries (files and symlinks) by status. */
export type CompareSummary = {
  identical: number;
  modified: number;
  onlyLeft: number;
  onlyRight: number;
  errors: number;
};

/** Response of `POST /api/compare/directories`. */
export type DirectoryCompareResult = {
  /** Absolute root folders that were compared (a checkout folder for git sources). */
  left: string;
  right: string;
  /** Human-readable names for each side, e.g. a path or "repo @ branch". */
  leftLabel: string;
  rightLabel: string;
  root: CompareNode;
  summary: CompareSummary;
};

/** One side of a file diff. Binary or too-large files carry no `content`. */
export type FileContent = {
  path: string;
  size: number;
  sha256: string;
  binary: boolean;
  /** Present for text files under the size limit. */
  content?: string;
  /** True when the file is text but too large to show. */
  tooLarge?: boolean;
};

/** Response of `GET /api/compare/files`. A missing side means only one file was given. */
export type FileCompareResult = {
  left?: FileContent;
  right?: FileContent;
  /** True when both files are present and byte-for-byte equal. */
  identical: boolean;
};

/** Body of every 4xx/5xx API response. */
export type ApiError = {
  message: string;
};

/** Default folders the app compares when none are given (the repo's examples by default). */
export type DefaultsResponse = {
  left?: string;
  right?: string;
};

/** A session as listed on the Sessions page. Timestamps are ISO-8601. */
export type SessionSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  repoCount: number;
};

/** A repo cloned into a session. */
export type RepoInfo = {
  id: string;
  url: string;
  /** Short display name, e.g. "delta" for https://github.com/acme/delta.git. */
  name: string;
  defaultBranch: string;
  branches: string[];
  /** When the repo was cloned or last fetched. */
  fetchedAt: string;
};

/** A comparison remembered in a session, newest first. Repeating one moves it to the top. */
export type RecentComparison = {
  id: string;
  left: Source;
  right: Source;
  leftLabel: string;
  rightLabel: string;
  comparedAt: string;
};

/** Response of `GET /api/users/:user/sessions/:sessionId`. */
export type SessionDetail = {
  user: string;
  session: SessionSummary;
  repos: RepoInfo[];
  recent: RecentComparison[];
};
