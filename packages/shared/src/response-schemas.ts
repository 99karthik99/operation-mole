import { z } from 'zod';
import type {
  CompareNode,
  DefaultsResponse,
  DirectoryCompareResult,
  EntryInfo,
  FileCompareResult,
  FileContent,
  RecentComparison,
  RepoInfo,
  SessionDetail,
  SessionSummary,
} from './api.ts';
import { SourceSchema } from './schemas.ts';

/*
 * Schemas for API responses, so the web client validates what the network returns instead of
 * trusting it (CONTRIBUTING.md §7.6). Each one is pinned to its type in api.ts with
 * `satisfies` (or an annotation, for the recursive tree), so the two cannot drift apart.
 */

const EntryInfoSchema = z.object({
  kind: z.enum(['file', 'directory', 'symlink']),
  size: z.number(),
  mtimeMs: z.number(),
  linkTarget: z.string().exactOptional(),
}) satisfies z.ZodType<EntryInfo>;

/** One node of a folder comparison, with its children. */
export const CompareNodeSchema: z.ZodType<CompareNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    status: z.enum(['identical', 'modified', 'only-left', 'only-right', 'error']),
    left: EntryInfoSchema.exactOptional(),
    right: EntryInfoSchema.exactOptional(),
    children: z.array(CompareNodeSchema).exactOptional(),
    error: z.string().exactOptional(),
  }),
);

/** `POST /api/compare/directories`. */
export const DirectoryCompareResultSchema = z.object({
  left: z.string(),
  right: z.string(),
  leftLabel: z.string(),
  rightLabel: z.string(),
  root: CompareNodeSchema,
  summary: z.object({
    identical: z.number(),
    modified: z.number(),
    onlyLeft: z.number(),
    onlyRight: z.number(),
    errors: z.number(),
  }),
}) satisfies z.ZodType<DirectoryCompareResult>;

const FileContentSchema = z.object({
  path: z.string(),
  size: z.number(),
  sha256: z.string(),
  binary: z.boolean(),
  content: z.string().exactOptional(),
  tooLarge: z.boolean().exactOptional(),
}) satisfies z.ZodType<FileContent>;

/** `GET /api/compare/files`. */
export const FileCompareResultSchema = z.object({
  left: FileContentSchema.exactOptional(),
  right: FileContentSchema.exactOptional(),
  identical: z.boolean(),
}) satisfies z.ZodType<FileCompareResult>;

/** `GET /api/defaults`. */
export const DefaultsResponseSchema = z.object({
  left: z.string().exactOptional(),
  right: z.string().exactOptional(),
}) satisfies z.ZodType<DefaultsResponse>;

/** One session, as listed or created. */
export const SessionSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  repoCount: z.number(),
}) satisfies z.ZodType<SessionSummary>;

/** `GET /api/users/:user/sessions`. */
export const SessionSummaryListSchema = z.array(SessionSummarySchema);

/** A cloned repo (add, fetch, and inside session details). */
export const RepoInfoSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string(),
  defaultBranch: z.string(),
  branches: z.array(z.string()),
  fetchedAt: z.string(),
}) satisfies z.ZodType<RepoInfo>;

const RecentComparisonSchema = z.object({
  id: z.string(),
  left: SourceSchema,
  right: SourceSchema,
  leftLabel: z.string(),
  rightLabel: z.string(),
  comparedAt: z.string(),
}) satisfies z.ZodType<RecentComparison>;

/** `GET /api/users/:user/sessions/:sessionId`. */
export const SessionDetailSchema = z.object({
  user: z.string(),
  session: SessionSummarySchema,
  repos: z.array(RepoInfoSchema),
  recent: z.array(RecentComparisonSchema),
}) satisfies z.ZodType<SessionDetail>;
