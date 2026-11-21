import type { FileCompareResult, FileContent } from '@om/shared';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, CheckCircle2, Columns2, Rows2 } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PathForm } from '../components/PathForm.tsx';
import { compareFiles } from '../lib/api.ts';
import { formatBytes } from '../lib/format.ts';
import { languageForPath } from '../lib/language.ts';

const DiffView = lazy(() =>
  import('../components/DiffView.tsx').then((m) => ({ default: m.DiffView })),
);

/** Only allow in-app back links, never arbitrary URLs from the query string. */
function safeFrom(from: string | null): string | undefined {
  return from?.startsWith('/u/') ? from : undefined;
}

export function FileComparePage() {
  const [params, setParams] = useSearchParams();
  const left = params.get('left') ?? '';
  const right = params.get('right') ?? '';
  const from = safeFrom(params.get('from'));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-line bg-surface px-4 py-3">
        {from && (
          <Link
            to={from}
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to folder comparison
          </Link>
        )}
        <PathForm
          key={`${left}\n${right}`}
          leftLabel="Base file"
          rightLabel="Target file"
          initialLeft={left}
          initialRight={right}
          allowOneSided
          onSubmit={(l, r) => {
            const next = new URLSearchParams();
            if (l) next.set('left', l);
            if (r) next.set('right', r);
            if (from) next.set('from', from);
            setParams(next);
          }}
        />
      </div>
      {left || right ? (
        <FileComparison left={left || undefined} right={right || undefined} />
      ) : (
        <p className="m-auto p-8 text-center text-muted">
          Enter two file paths, or open a file from Folders.
        </p>
      )}
    </div>
  );
}

function statusText(result: FileCompareResult): string {
  const binary = Boolean(result.left?.binary || result.right?.binary);
  if (!result.left) return 'This file only exists in the target';
  if (!result.right) return 'This file only exists in the base';
  if (result.identical) return binary ? 'Binary files are identical' : 'Files are identical';
  return binary ? 'Binary files differ' : 'Files differ';
}

function FileComparison({ left, right }: { left: string | undefined; right: string | undefined }) {
  const [sideBySide, setSideBySide] = useState(true);
  const query = useQuery({
    queryKey: ['compare-files', left, right],
    queryFn: () => compareFiles(left, right),
    staleTime: Infinity,
  });

  if (query.isPending) return <p className="m-auto p-8 text-muted">Loading…</p>;
  if (query.isError) {
    return (
      <div
        role="alert"
        className="m-4 rounded-md border border-error/40 bg-error-soft p-4 text-error"
      >
        {query.error.message}
      </div>
    );
  }

  const result = query.data;
  const sides = [result.left, result.right].filter((s) => s !== undefined);
  const showText = sides.every((s) => !s.binary && !s.tooLarge);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-1.5 text-sm">
        <span
          className={clsx(
            'flex items-center gap-1.5 font-medium',
            result.identical
              ? 'text-ok'
              : result.left && result.right
                ? 'text-modified'
                : result.left
                  ? 'text-left'
                  : 'text-right',
          )}
        >
          {result.identical && <CheckCircle2 className="size-4" aria-hidden />}
          {statusText(result)}
        </span>
        {showText && (
          <div className="ml-auto flex overflow-hidden rounded-md border border-line">
            <button
              type="button"
              aria-pressed={sideBySide}
              className={clsx(
                'flex items-center gap-1 px-2 py-0.5',
                sideBySide ? 'bg-accent-soft text-accent' : 'hover:bg-hover',
              )}
              onClick={() => {
                setSideBySide(true);
              }}
            >
              <Columns2 className="size-3.5" aria-hidden /> Side by side
            </button>
            <button
              type="button"
              aria-pressed={!sideBySide}
              className={clsx(
                'flex items-center gap-1 px-2 py-0.5',
                !sideBySide ? 'bg-accent-soft text-accent' : 'hover:bg-hover',
              )}
              onClick={() => {
                setSideBySide(false);
              }}
            >
              <Rows2 className="size-3.5" aria-hidden /> Inline
            </button>
          </div>
        )}
      </div>
      {showText ? (
        <div className="min-h-0 flex-1">
          <Suspense fallback={<p className="p-8 text-muted">Loading editor…</p>}>
            <DiffView
              original={result.left?.content ?? ''}
              modified={result.right?.content ?? ''}
              language={languageForPath((result.right ?? result.left)?.path ?? '')}
              sideBySide={sideBySide}
            />
          </Suspense>
        </div>
      ) : (
        <FileSummary left={result.left} right={result.right} />
      )}
    </div>
  );
}

function FileSummary({
  left,
  right,
}: {
  left: FileContent | undefined;
  right: FileContent | undefined;
}) {
  const tooLarge = Boolean(left?.tooLarge || right?.tooLarge);
  return (
    <div className="p-4">
      {tooLarge && (
        <p className="mb-3 text-sm text-muted">
          One or both files are too large to display as text.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ['Base', left],
            ['Target', right],
          ] as const
        ).map(([label, file]) => (
          <section key={label} className="rounded-md border border-line bg-surface p-3 text-sm">
            <h2 className="mb-2 text-xs font-medium uppercase text-muted">{label}</h2>
            {file ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted">Path</dt>
                <dd className="break-all font-mono">{file.path}</dd>
                <dt className="text-muted">Size</dt>
                <dd>{formatBytes(file.size)}</dd>
                <dt className="text-muted">SHA-256</dt>
                <dd className="break-all font-mono text-xs">{file.sha256}</dd>
                <dt className="text-muted">Type</dt>
                <dd>{file.binary ? 'Binary' : 'Text'}</dd>
              </dl>
            ) : (
              <p className="text-muted">No file</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
