import { z } from 'zod';

const absolutePath = z
  .string()
  .trim()
  .min(1, 'Path is required')
  .refine((p) => p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p), 'Path must be absolute');

/** Usernames double as folder names on disk, so keep them to a safe character set. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9._-]{0,31}$/,
    'Use 1–32 letters, digits, dots, dashes or underscores, starting with a letter or digit',
  );

export const sessionIdSchema = z.string().regex(/^[a-z0-9-]{1,64}$/, 'Invalid session id');

export const createSessionRequestSchema = z.object({
  name: z.string().trim().min(1, 'Session name is required').max(60, 'Use at most 60 characters'),
});
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

export const addRepoRequestSchema = z.object({
  url: z.string().trim().min(1, 'Repository URL is required').max(500),
});
export type AddRepoRequest = z.infer<typeof addRepoRequestSchema>;

const pathSourceSchema = z.object({ type: z.literal('path'), path: absolutePath });
const gitSourceSchema = z.object({
  type: z.literal('git'),
  repoId: z.string().min(1, 'Choose a repository'),
  branch: z.string().trim().min(1, 'Choose a branch'),
});

/** One side of a folder comparison: a local folder or a branch of a cloned repo. */
export const sourceSchema = z.discriminatedUnion('type', [pathSourceSchema, gitSourceSchema]);
export type Source = z.infer<typeof sourceSchema>;

/** A bare absolute path is accepted as shorthand for a path source. */
const sourceInputSchema = z.union([
  absolutePath.transform((path): Source => ({ type: 'path', path })),
  sourceSchema,
]);

export const directoryCompareRequestSchema = z.object({
  left: sourceInputSchema,
  right: sourceInputSchema,
  /** When given, the comparison is recorded in that session's recent list. */
  user: usernameSchema.optional(),
  sessionId: sessionIdSchema.optional(),
});
export type DirectoryCompareRequest = z.input<typeof directoryCompareRequestSchema>;

export const fileCompareQuerySchema = z
  .object({
    left: absolutePath.optional(),
    right: absolutePath.optional(),
  })
  .refine((q) => q.left !== undefined || q.right !== undefined, 'Provide at least one file path');
export type FileCompareQuery = z.infer<typeof fileCompareQuerySchema>;
