import { ArrowLeftRight } from 'lucide-react';
import { useId, useState, type SubmitEvent } from 'react';

interface PathFormProps {
  leftLabel: string;
  rightLabel: string;
  initialLeft: string;
  initialRight: string;
  /** Allow submitting with only one side filled in. */
  allowOneSided?: boolean;
  onSubmit: (left: string, right: string) => void;
}

/** Two absolute-path inputs with swap and compare buttons. Remount (via `key`) to reset from props. */
export function PathForm({
  leftLabel,
  rightLabel,
  initialLeft,
  initialRight,
  allowOneSided = false,
  onSubmit,
}: PathFormProps) {
  const [left, setLeft] = useState(initialLeft);
  const [right, setRight] = useState(initialRight);
  const id = useId();
  const canSubmit = allowOneSided
    ? Boolean(left.trim() || right.trim())
    : Boolean(left.trim() && right.trim());

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (canSubmit) onSubmit(left.trim(), right.trim());
  };

  const input =
    'w-full rounded-md border border-line bg-surface px-3 py-1.5 font-mono text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30';

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="min-w-64 flex-1">
        <label htmlFor={`${id}-l`} className="mb-1 block text-xs font-medium text-muted">
          {leftLabel}
        </label>
        <input
          id={`${id}-l`}
          className={input}
          value={left}
          onChange={(e) => {
            setLeft(e.target.value);
          }}
          placeholder="/absolute/path"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <button
        type="button"
        title="Swap sides"
        aria-label="Swap sides"
        className="rounded-md border border-line p-2 text-muted hover:bg-hover"
        onClick={() => {
          setLeft(right);
          setRight(left);
        }}
      >
        <ArrowLeftRight className="size-4" aria-hidden />
      </button>
      <div className="min-w-64 flex-1">
        <label htmlFor={`${id}-r`} className="mb-1 block text-xs font-medium text-muted">
          {rightLabel}
        </label>
        <input
          id={`${id}-r`}
          className={input}
          value={right}
          onChange={(e) => {
            setRight(e.target.value);
          }}
          placeholder="/absolute/path"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
      >
        Compare
      </button>
    </form>
  );
}
