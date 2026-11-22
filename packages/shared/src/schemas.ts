import { z } from 'zod';

/** Absolute on any OS: `/…` (Linux, macOS), `C:\…` or `C:/…`, or a Windows share `\\server\share…`. */
const ABSOLUTE_PATH = /^(?:\/|[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/;

const absolutePath = z
  .string()
  .trim()
  .min(1, 'Path is required')
  .refine((p) => ABSOLUTE_PATH.test(p), 'Path must be absolute');

/** Usernames double as folder names on disk, so keep them to a safe character set. */
export const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9._-]{0,31}$/,
    'Use 1–32 letters, digits, dots, dashes or underscores, starting with a letter or digit',
  );

/** Session ids are generated UUIDs; they also name folders on disk. */
export const SessionIdSchema = z.string().regex(/^[a-z0-9-]{1,64}$/, 'Invalid session id');

/** Body of `POST /api/users/:user/sessions`. */
export const CreateSessionRequestSchema = z.object({
  name: z.string().trim().min(1, 'Session name is required').max(60, 'Use at most 60 characters'),
});
/** See {@link CreateSessionRequestSchema}. */
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

/** Body of `POST …/repos`. The URL itself is checked by the server (allowed protocols). */
export const AddRepoRequestSchema = z.object({
  url: z.string().trim().min(1, 'Repository URL is required').max(500),
});
/** See {@link AddRepoRequestSchema}. */
export type AddRepoRequest = z.infer<typeof AddRepoRequestSchema>;

const PathSourceSchema = z.object({ type: z.literal('path'), path: absolutePath });
const GitSourceSchema = z.object({
  type: z.literal('git'),
  repoId: z.string().min(1, 'Choose a repository'),
  branch: z.string().trim().min(1, 'Choose a branch'),
});

/** One side of a folder comparison: a local folder or a branch of a cloned repo. */
export const SourceSchema = z.discriminatedUnion('type', [PathSourceSchema, GitSourceSchema]);
/** See {@link SourceSchema}. */
export type Source = z.infer<typeof SourceSchema>;

/** A bare absolute path is accepted as shorthand for a path source. */
const SourceInputSchema = z.union([
  absolutePath.transform((path): Source => ({ type: 'path', path })),
  SourceSchema,
]);

/** Body of `POST /api/compare/directories`. Each side is a source or a bare absolute path. */
export const DirectoryCompareRequestSchema = z.object({
  left: SourceInputSchema,
  right: SourceInputSchema,
  /** When given, the comparison is recorded in that session's recent list. */
  user: UsernameSchema.optional(),
  sessionId: SessionIdSchema.optional(),
});
/** What clients send (input type: bare paths allowed). See {@link DirectoryCompareRequestSchema}. */
export type DirectoryCompareRequest = z.input<typeof DirectoryCompareRequestSchema>;

/** Query of `GET /api/compare/files`: one or two absolute file paths. */
export const FileCompareQuerySchema = z
  .object({
    left: absolutePath.optional(),
    right: absolutePath.optional(),
  })
  .refine((q) => q.left !== undefined || q.right !== undefined, 'Provide at least one file path');
/** See {@link FileCompareQuerySchema}. */
export type FileCompareQuery = z.infer<typeof FileCompareQuerySchema>;
