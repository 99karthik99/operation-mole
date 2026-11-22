import type { RepoInfo, Source } from '@om/shared';
import { ArrowLeftRight } from 'lucide-react';
import { useState, type JSX, type SubmitEvent } from 'react';
import { emptyDraft, isComplete, toSource, type SourceDraft } from '../lib/source-draft.ts';
import { SourcePicker } from './source-picker.tsx';

type CompareFormProps = {
  initialLeft: Source | undefined;
  initialRight: Source | undefined;
  repos: RepoInfo[];
  user: string;
  sessionId: string;
  onSubmit: (left: Source, right: Source) => void;
};

/** Base and target pickers with swap and compare. Remount (via `key`) to reset from props. */
export function CompareForm({
  initialLeft,
  initialRight,
  repos,
  user,
  sessionId,
  onSubmit,
}: CompareFormProps): JSX.Element {
  const [left, setLeft] = useState<SourceDraft>(initialLeft ?? emptyDraft);
  const [right, setRight] = useState<SourceDraft>(initialRight ?? emptyDraft);
  const isReady = isComplete(left) && isComplete(right);

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isReady) onSubmit(toSource(left), toSource(right));
  };

  const common = { repos, user, sessionId };
  return (
    <form onSubmit={submit} className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
      <SourcePicker side="Base" value={left} onChange={setLeft} {...common} />
      <button
        type="button"
        title="Swap sides"
        aria-label="Swap sides"
        className="justify-self-center rounded-md border border-line p-2 text-muted hover:bg-hover"
        onClick={() => {
          setLeft(right);
          setRight(left);
        }}
      >
        <ArrowLeftRight className="size-4" aria-hidden />
      </button>
      <SourcePicker side="Target" value={right} onChange={setRight} {...common} />
      <button
        type="submit"
        disabled={!isReady}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
      >
        Compare
      </button>
    </form>
  );
}
