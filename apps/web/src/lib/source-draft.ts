import type { Source } from '@om/shared';

/** A side being edited: like Source, but fields may still be empty. */
export type SourceDraft =
  { type: 'path'; path: string } | { type: 'git'; repoId: string; branch: string };

export const emptyDraft: SourceDraft = { type: 'path', path: '' };

export const isComplete = (d: SourceDraft): boolean =>
  d.type === 'path' ? d.path.trim() !== '' : d.repoId !== '' && d.branch !== '';

export const toSource = (d: SourceDraft): Source =>
  d.type === 'path' ? { type: 'path', path: d.path.trim() } : d;
