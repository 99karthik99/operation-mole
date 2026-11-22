import type { Source } from '@om/shared';

/** A side being edited: like Source, but fields may still be empty. */
export type SourceDraft =
  { type: 'path'; path: string } | { type: 'git'; repoId: string; branch: string };

/** A blank folder side: the starting point of a new comparison form. */
export const emptyDraft: SourceDraft = { type: 'path', path: '' };

/** Whether a draft has everything needed to compare (a non-blank path, or a repo and branch). */
export const isComplete = (d: SourceDraft): boolean =>
  d.type === 'path' ? d.path.trim() !== '' : d.repoId !== '' && d.branch !== '';

/** The API source for a complete draft (paths are trimmed). */
export const toSource = (d: SourceDraft): Source =>
  d.type === 'path' ? { type: 'path', path: d.path.trim() } : d;
