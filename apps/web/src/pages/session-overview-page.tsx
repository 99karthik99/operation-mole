import type { RepoInfo } from '@om/shared';
import clsx from 'clsx';
import { ArrowLeftRight, GitBranch, History, LoaderCircle, Plus, RefreshCw } from 'lucide-react';
import { useId, useState, type JSX, type SubmitEvent } from 'react';
import { Link } from 'react-router';
import { formatRelative } from '../lib/format.ts';
import { useRepoActions, useSessionDetail, useSessionParams } from '../lib/session.ts';
import { sourcesSearch } from '../lib/sources.ts';
import { sessionPath } from '../lib/urls.ts';

const card = 'rounded-lg border border-line bg-surface';

/** A session's home: its repos (with Fetch latest) and recent comparisons. */
export function SessionOverviewPage(): JSX.Element {
  const { user, sessionId } = useSessionParams();
  const session = useSessionDetail(user, sessionId);
  const folders = sessionPath(user, sessionId, 'folders');

  if (session.isPending) return <p className="m-auto p-8 text-muted">Loading session…</p>;
  if (session.isError) {
    return (
      <div
        role="alert"
        className="m-4 rounded-md border border-error/40 bg-error-soft p-4 text-error"
      >
        {session.error.message}
      </div>
    );
  }

  const { session: info, repos, recent } = session.data;

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{info.name}</h1>
            <p className="text-sm text-muted">Created {formatRelative(info.createdAt)}</p>
          </div>
          <Link
            to={folders}
            className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
          >
            <ArrowLeftRight className="size-4" aria-hidden />
            Start a comparison
          </Link>
        </div>

        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <History className="size-4 text-muted" aria-hidden />
            Recent comparisons
          </h2>
          {recent.length === 0 ? (
            <p className={clsx(card, 'border-dashed p-6 text-center text-sm text-muted')}>
              No comparisons yet.
            </p>
          ) : (
            <ul
              aria-label="Recent comparisons"
              className={clsx(card, 'divide-y divide-line overflow-hidden')}
            >
              {recent.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`${folders}${sourcesSearch(c.left, c.right)}`}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-hover"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono">
                      <span className="text-left">{c.leftLabel}</span>
                      <span className="px-2 text-muted">↔</span>
                      <span className="text-right">{c.rightLabel}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {formatRelative(c.comparedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <RepoSection user={user} sessionId={sessionId} repos={repos} />
      </div>
    </div>
  );
}

function RepoSection({
  user,
  sessionId,
  repos,
}: {
  user: string;
  sessionId: string;
  repos: RepoInfo[];
}) {
  const { add, fetchLatest } = useRepoActions(user, sessionId);
  const [url, setUrl] = useState('');
  const id = useId();

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (url.trim()) {
      add.mutate(url.trim(), {
        onSuccess: () => {
          setUrl('');
        },
      });
    }
  };

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <GitBranch className="size-4 text-muted" aria-hidden />
        Repositories
      </h2>
      <form onSubmit={submit} className={clsx(card, 'flex flex-wrap items-end gap-2 p-3')}>
        <div className="min-w-56 flex-1">
          <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
            Repository URL
          </label>
          <input
            id={id}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              add.reset();
            }}
            placeholder="https://github.com/org/repo.git or git@github.com:org/repo.git"
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-md border border-line bg-canvas px-3 py-1.5 font-mono text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <button
          type="submit"
          disabled={!url.trim() || add.isPending}
          className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm hover:bg-hover disabled:opacity-50"
        >
          {add.isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          {add.isPending ? 'Cloning…' : 'Add repository'}
        </button>
        {add.isError && <p className="w-full text-sm text-error">{add.error.message}</p>}
      </form>

      {repos.length === 0 ? (
        <p className={clsx(card, 'border-dashed p-6 text-center text-sm text-muted')}>
          No repositories yet. Add one here, or choose “Git repo” when starting a comparison.
        </p>
      ) : (
        <ul
          aria-label="Repositories"
          className={clsx(card, 'divide-y divide-line overflow-hidden')}
        >
          {repos.map((repo) => {
            const isFetching = fetchLatest.isPending && fetchLatest.variables === repo.id;
            return (
              <li key={repo.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{repo.name}</p>
                  <p className="truncate font-mono text-xs text-muted">{repo.url}</p>
                  <p className="text-xs text-muted">
                    {repo.branches.length} {repo.branches.length === 1 ? 'branch' : 'branches'} ·
                    default {repo.defaultBranch} · fetched {formatRelative(repo.fetchedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Fetch latest for ${repo.name}`}
                  disabled={isFetching}
                  className="flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:bg-hover hover:text-ink disabled:opacity-50"
                  onClick={() => {
                    fetchLatest.mutate(repo.id);
                  }}
                >
                  <RefreshCw className={clsx('size-4', isFetching && 'animate-spin')} aria-hidden />
                  Fetch latest
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
