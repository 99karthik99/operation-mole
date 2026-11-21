import type { CompareNode, CompareSummary, Source } from '@om/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronRight, Home, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { CompareTree } from '../components/CompareTree.tsx';
import { CompareForm } from '../components/CompareForm.tsx';
import { compareDirectories, getDefaults } from '../lib/api.ts';
import { sessionKey, useSessionDetail, useSessionParams } from '../lib/session.ts';
import { sourceFromParams, sourcesSearch } from '../lib/sources.ts';
import { sessionPath } from '../lib/urls.ts';
import {
  breadcrumbs,
  collectDirectoryPaths,
  findNode,
  flattenTree,
  isDirectory,
  joinPath,
  type TreeFilter,
} from '../lib/tree.ts';

const chips: { key: keyof CompareSummary; filter: TreeFilter; label: string; dot: string }[] = [
  { key: 'identical', filter: 'identical', label: 'Identical', dot: 'bg-muted' },
  { key: 'modified', filter: 'modified', label: 'Different', dot: 'bg-modified-dot' },
  { key: 'onlyLeft', filter: 'only-left', label: 'Only in base', dot: 'bg-left-dot' },
  { key: 'onlyRight', filter: 'only-right', label: 'Only in target', dot: 'bg-right-dot' },
  { key: 'errors', filter: 'error', label: 'Errors', dot: 'bg-error-dot' },
];

/** Search string with `changes` applied (undefined/empty deletes the key). */
function withParams(params: URLSearchParams, changes: Record<string, string | undefined>): string {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  return `?${next}`;
}

export function DirectoryComparePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, sessionId } = useSessionParams();
  const session = useSessionDetail(user, sessionId);
  const left = sourceFromParams(params, 'left');
  const right = sourceFromParams(params, 'right');
  const key = JSON.stringify([left, right]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line bg-surface px-4 py-3">
        <CompareForm
          key={key}
          initialLeft={left}
          initialRight={right}
          repos={session.data?.repos ?? []}
          user={user}
          sessionId={sessionId}
          onSubmit={(l, r) => {
            void navigate({ search: sourcesSearch(l, r) });
          }}
        />
      </div>
      {left && right ? (
        <Comparison key={key} left={left} right={right} user={user} sessionId={sessionId} />
      ) : !left && !right ? (
        <DefaultFolders />
      ) : (
        <EmptyHint />
      )}
    </div>
  );
}

function EmptyHint() {
  return (
    <p className="m-auto p-8 text-center text-muted">
      Enter two folder paths to compare their contents byte by byte.
    </p>
  );
}

/** With no folders in the URL, open the server's default folders (the repo examples). */
function DefaultFolders() {
  const query = useQuery({ queryKey: ['defaults'], queryFn: getDefaults, staleTime: Infinity });
  if (query.isPending) return null;
  const { left, right } = query.data ?? {};
  if (left && right) {
    return <Navigate replace to={{ search: `?${new URLSearchParams({ left, right })}` }} />;
  }
  return <EmptyHint />;
}

interface ComparisonProps {
  left: Source;
  right: Source;
  user: string;
  sessionId: string;
}

function Comparison({ left, right, user, sessionId }: ComparisonProps) {
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const path = params.get('path') ?? '';

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [filter, setFilter] = useState<TreeFilter>('all');
  const [selected, setSelected] = useState<CompareNode>();

  const query = useQuery({
    queryKey: ['compare-directories', user, sessionId, left, right],
    queryFn: async () => {
      const result = await compareDirectories({ left, right, user, sessionId });
      // The comparison is now in the session's recent list.
      void queryClient.invalidateQueries({ queryKey: sessionKey(user, sessionId) });
      return result;
    },
    staleTime: Infinity,
  });

  const current = query.data ? findNode(query.data.root, path) : undefined;
  const rows = current && isDirectory(current) ? flattenTree(current, expanded, filter) : [];

  const goTo = (p: string) => {
    void navigate({ search: withParams(params, { path: p }) });
  };

  const openFiles = (l: string | undefined, r: string | undefined) => {
    const search = new URLSearchParams();
    if (l) search.set('left', l);
    if (r) search.set('right', r);
    search.set('from', location.pathname + location.search);
    void navigate(`${sessionPath(user, sessionId, 'files')}?${search}`);
  };

  const absolute = (node: CompareNode, side: 'left' | 'right') =>
    node[side] && query.data ? joinPath(query.data[side], node.path) : undefined;

  const open = (node: CompareNode) => {
    if (isDirectory(node)) goTo(node.path);
    else openFiles(absolute(node, 'left'), absolute(node, 'right'));
  };

  const toggle = (node: CompareNode) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.path)) next.delete(node.path);
      else next.add(node.path);
      return next;
    });
  };

  if (query.isPending) {
    return <p className="m-auto p-8 text-muted">Comparing…</p>;
  }
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

  const { summary } = query.data;
  const crumbs = breadcrumbs(path);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2 text-sm">
        <div role="group" aria-label="Summary" className="flex flex-wrap gap-1">
          {chips.map((chip) =>
            chip.key === 'errors' && summary.errors === 0 ? null : (
              <button
                key={chip.key}
                type="button"
                aria-pressed={filter === chip.filter}
                title={`Filter to: ${chip.label}`}
                onClick={() => {
                  setFilter(filter === chip.filter ? 'all' : chip.filter);
                }}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-0.5',
                  filter === chip.filter
                    ? 'border-accent bg-accent-soft'
                    : 'border-line hover:bg-hover',
                )}
              >
                <span className={clsx('size-2 rounded-full', chip.dot)} aria-hidden />
                {chip.label} <span className="font-semibold tabular-nums">{summary[chip.key]}</span>
              </button>
            ),
          )}
        </div>
        <div
          role="radiogroup"
          aria-label="Show"
          className="flex overflow-hidden rounded-md border border-line"
        >
          {(['all', 'differences'] as const).map((f) => (
            <label
              key={f}
              className={clsx(
                'cursor-pointer px-2.5 py-0.5',
                filter === f ? 'bg-accent-soft text-accent' : 'hover:bg-hover',
              )}
            >
              <input
                type="radio"
                name="filter"
                className="sr-only"
                checked={filter === f}
                onChange={() => {
                  setFilter(f);
                }}
              />
              {f === 'all' ? 'All' : 'Differences only'}
            </label>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {current && (
            <>
              <button
                type="button"
                className="rounded px-2 py-0.5 text-muted hover:bg-hover"
                onClick={() => {
                  setExpanded(new Set(collectDirectoryPaths(current)));
                }}
              >
                Expand all
              </button>
              <button
                type="button"
                className="rounded px-2 py-0.5 text-muted hover:bg-hover"
                onClick={() => {
                  setExpanded(new Set());
                }}
              >
                Collapse all
              </button>
            </>
          )}
          <button
            type="button"
            className="flex items-center gap-1 rounded px-2 py-0.5 text-muted hover:bg-hover disabled:opacity-50"
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch();
            }}
          >
            <RefreshCw
              className={clsx('size-3.5', query.isFetching && 'animate-spin')}
              aria-hidden
            />
            Rescan
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-1.5 text-sm">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1">
            {crumbs.map((crumb, i) => {
              const last = i === crumbs.length - 1;
              const label =
                crumb.path === '' ? (
                  <span className="flex items-center gap-1">
                    <Home className="size-3.5" aria-hidden />
                    root
                  </span>
                ) : (
                  crumb.name
                );
              return (
                <li key={crumb.path} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3.5 text-muted" aria-hidden />}
                  {last ? (
                    <span aria-current="page" className="font-medium">
                      {label}
                    </span>
                  ) : (
                    <Link
                      to={{ search: withParams(params, { path: crumb.path }) }}
                      className="text-accent hover:underline"
                    >
                      {label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <Legend />
      </div>

      {selected && (
        <div className="flex items-center gap-2 border-b border-line bg-accent-soft px-4 py-1 text-sm">
          <span className="font-mono">{`Selected: ${selected.path}`}</span>
          <span className="text-muted">
            — choose another file and click “Compare with selected”.
          </span>
          <button
            type="button"
            className="ml-auto text-accent hover:underline"
            onClick={() => {
              setSelected(undefined);
            }}
          >
            Clear
          </button>
        </div>
      )}

      <div
        data-testid="column-labels"
        className="grid grid-cols-2 border-b border-line bg-surface text-xs font-medium text-muted"
      >
        {(['left', 'right'] as const).map((side) => {
          const label = side === 'left' ? query.data.leftLabel : query.data.rightLabel;
          return (
            <div
              key={side}
              className={clsx(
                'flex min-w-0 gap-1 px-3 py-1 font-mono',
                side === 'right' && 'border-l border-line',
              )}
              title={joinPath(query.data[side], path)}
            >
              <span className="truncate">{label}</span>
              {path && <span className="shrink-0 text-muted/80">/ {path}</span>}
            </div>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {current && isDirectory(current) ? (
          <CompareTree
            rows={rows}
            selected={selected}
            onToggle={toggle}
            onOpen={open}
            onSelect={setSelected}
            onCompareWithSelected={(node) => {
              if (!selected) return;
              openFiles(
                absolute(selected, 'left') ?? absolute(selected, 'right'),
                absolute(node, 'right') ?? absolute(node, 'left'),
              );
            }}
          />
        ) : (
          <div className="p-8 text-center text-muted">
            <p className="mb-2">
              Folder <span className="font-mono">“{path}”</span> was not found in this comparison.
            </p>
            <Link
              to={{ search: withParams(params, { path: undefined }) }}
              className="text-accent underline"
            >
              Go to root
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    ['bg-left-dot', 'Only in base'],
    ['bg-right-dot', 'Only in target'],
    ['bg-modified-dot', 'Different'],
  ] as const;
  return (
    <ul className="flex gap-3 text-xs text-muted" aria-label="Legend">
      {items.map(([dot, label]) => (
        <li key={label} className="flex items-center gap-1">
          <span className={clsx('size-2.5 rounded-sm', dot)} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}
