import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { RepoInfo, Source } from '@om/shared';
import { CompareInputError, NotFoundError } from '../errors.ts';
import type { RepoRecord, Store } from '../store/store.ts';
import { GitService } from './git-service.ts';

/** A comparison side turned into a folder on disk (see {@link RepoManager.resolve}). */
export type ResolvedSource = {
  /** Folder to compare. */
  root: string;
  label: string;
  /** Names to skip at the top level (a checkout's `.git`). */
  ignore: string[];
};

/** The API view of a stored repo (drops the owning session id). */
export const toInfo = (r: RepoRecord): RepoInfo => ({
  id: r.id,
  url: r.url,
  name: r.name,
  defaultBranch: r.defaultBranch,
  branches: r.branches,
  fetchedAt: r.fetchedAt,
});

/** Normalizes a repo URL so the same repo typed slightly differently is reused. */
const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, '');

/**
 * Per-session git workspaces on disk:
 *   <dataDir>/users/<user>/sessions/<session>/repos/<repo>          bare clone
 *   <dataDir>/users/<user>/sessions/<session>/worktrees/<repo>/<branch>  checkout
 */
export class RepoManager {
  readonly #store: Store;
  readonly #git: GitService;
  readonly #dataDir: string;
  readonly #locks = new Map<string, Promise<unknown>>();

  constructor(store: Store, git: GitService, dataDir: string) {
    this.#store = store;
    this.#git = git;
    this.#dataDir = dataDir;
  }

  sessionDir(user: string, sessionId: string): string {
    return path.join(this.#dataDir, 'users', user, 'sessions', sessionId);
  }

  #repoDir(user: string, sessionId: string, repoId: string) {
    return path.join(this.sessionDir(user, sessionId), 'repos', repoId);
  }

  #worktreeDir(user: string, sessionId: string, repoId: string, branch: string) {
    return path.join(
      this.sessionDir(user, sessionId),
      'worktrees',
      repoId,
      encodeURIComponent(branch),
    );
  }

  /** Runs `task` after any earlier task with the same key (one git operation per repo at a time). */
  async #exclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.#locks.get(key) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(task);
    this.#locks.set(key, run);
    try {
      return await run;
    } finally {
      if (this.#locks.get(key) === run) this.#locks.delete(key);
    }
  }

  #requireSession(user: string, sessionId: string): void {
    if (!this.#store.getSession(user, sessionId)) {
      throw new NotFoundError(`Session not found: ${sessionId}`);
    }
  }

  #requireRepo(sessionId: string, repoId: string): RepoRecord {
    const repo = this.#store.getRepo(sessionId, repoId);
    if (!repo) throw new NotFoundError(`Repository not found in this session: ${repoId}`);
    return repo;
  }

  /** Clones a repo into the session, or returns the existing clone. */
  async addRepo(
    user: string,
    sessionId: string,
    rawUrl: string,
  ): Promise<{ repo: RepoInfo; created: boolean }> {
    this.#requireSession(user, sessionId);
    const url = normalizeUrl(rawUrl);
    this.#git.validateUrl(url);

    return await this.#exclusive(`${sessionId}:${url}`, async () => {
      const existing = this.#store.findRepoByUrl(sessionId, url);
      if (existing && existsSync(this.#repoDir(user, sessionId, existing.id))) {
        return { repo: toInfo(existing), created: false };
      }
      const id = existing?.id ?? crypto.randomUUID();
      const { defaultBranch, branches } = await this.#git.clone(
        url,
        this.#repoDir(user, sessionId, id),
      );
      const saved = this.#store.saveRepo({
        id,
        sessionId,
        url,
        name: GitService.repoName(url),
        defaultBranch,
        branches,
      });
      this.#store.touchSession(user, sessionId);
      return { repo: toInfo(saved), created: true };
    });
  }

  async fetchRepo(user: string, sessionId: string, repoId: string): Promise<RepoInfo> {
    this.#requireSession(user, sessionId);
    const repo = this.#requireRepo(sessionId, repoId);
    return await this.#exclusive(`${sessionId}:${repo.url}`, async () => {
      const { defaultBranch, branches } = await this.#git.fetch(
        this.#repoDir(user, sessionId, repoId),
      );
      return toInfo(this.#store.saveRepo({ ...repo, defaultBranch, branches }));
    });
  }

  /** Turns a source into a folder to compare, checking out the branch if needed. */
  async resolve(source: Source, user?: string, sessionId?: string): Promise<ResolvedSource> {
    if (source.type === 'path') return { root: source.path, label: source.path, ignore: [] };
    if (user === undefined || user === '' || sessionId === undefined || sessionId === '') {
      throw new CompareInputError('Comparing a git branch needs a session');
    }
    this.#requireSession(user, sessionId);
    const repo = this.#requireRepo(sessionId, source.repoId);
    const root = await this.#exclusive(`${sessionId}:${repo.url}`, () =>
      this.#git.checkout(
        this.#repoDir(user, sessionId, repo.id),
        source.branch,
        this.#worktreeDir(user, sessionId, repo.id, source.branch),
      ),
    );
    return { root, label: `${repo.name} @ ${source.branch}`, ignore: ['.git'] };
  }

  async deleteSession(user: string, sessionId: string): Promise<boolean> {
    const isDeleted = this.#store.deleteSession(user, sessionId);
    if (isDeleted) await rm(this.sessionDir(user, sessionId), { recursive: true, force: true });
    return isDeleted;
  }
}
