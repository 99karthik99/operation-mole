import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { RecentComparison, RepoInfo, SessionSummary, Source } from '@om/shared';
import { ConflictError } from '../errors.ts';

const MAX_RECENT = 20;

const SCHEMA = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    username   TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    username   TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (username, name COLLATE NOCASE)
  );
  CREATE TABLE IF NOT EXISTS repos (
    id             TEXT PRIMARY KEY,
    session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    url            TEXT NOT NULL,
    name           TEXT NOT NULL,
    default_branch TEXT NOT NULL,
    branches       TEXT NOT NULL,
    fetched_at     TEXT NOT NULL,
    UNIQUE (session_id, url)
  );
  CREATE TABLE IF NOT EXISTS comparisons (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    left_src    TEXT NOT NULL,
    right_src   TEXT NOT NULL,
    left_label  TEXT NOT NULL,
    right_label TEXT NOT NULL,
    compared_at TEXT NOT NULL,
    UNIQUE (session_id, key)
  );
`;

export interface RepoRecord extends RepoInfo {
  sessionId: string;
}

export type RepoInput = Omit<RepoRecord, 'id' | 'fetchedAt'> & { id?: string };

export interface ComparisonInput {
  left: Source;
  right: Source;
  leftLabel: string;
  rightLabel: string;
}

interface SessionRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  repo_count: number;
}

interface RepoRow {
  id: string;
  session_id: string;
  url: string;
  name: string;
  default_branch: string;
  branches: string;
  fetched_at: string;
}

interface ComparisonRow {
  id: string;
  left_src: string;
  right_src: string;
  left_label: string;
  right_label: string;
  compared_at: string;
}

const toSession = (r: SessionRow): SessionSummary => ({
  id: r.id,
  name: r.name,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  repoCount: r.repo_count,
});

const toRepo = (r: RepoRow): RepoRecord => ({
  id: r.id,
  sessionId: r.session_id,
  url: r.url,
  name: r.name,
  defaultBranch: r.default_branch,
  branches: JSON.parse(r.branches) as string[],
  fetchedAt: r.fetched_at,
});

const toComparison = (r: ComparisonRow): RecentComparison => ({
  id: r.id,
  left: JSON.parse(r.left_src) as Source,
  right: JSON.parse(r.right_src) as Source,
  leftLabel: r.left_label,
  rightLabel: r.right_label,
  comparedAt: r.compared_at,
});

const SESSION_SELECT = `
  SELECT s.id, s.name, s.created_at, s.updated_at,
         (SELECT COUNT(*) FROM repos r WHERE r.session_id = s.id) AS repo_count
  FROM sessions s`;

/** Users, sessions, cloned repos and recent comparisons, in SQLite. */
export class Store {
  readonly #db: DatabaseSync;
  readonly #now: () => Date;

  constructor(path: string, options: { now?: () => Date } = {}) {
    this.#db = new DatabaseSync(path);
    this.#db.exec(SCHEMA);
    this.#now = options.now ?? (() => new Date());
  }

  #timestamp(): string {
    return this.#now().toISOString();
  }

  close(): void {
    this.#db.close();
  }

  listSessions(user: string): SessionSummary[] {
    const rows = this.#db
      .prepare(
        `${SESSION_SELECT} WHERE s.username = ? ORDER BY s.updated_at DESC, s.created_at DESC`,
      )
      .all(user) as unknown as SessionRow[];
    return rows.map(toSession);
  }

  getSession(user: string, id: string): SessionSummary | undefined {
    const row = this.#db
      .prepare(`${SESSION_SELECT} WHERE s.username = ? AND s.id = ?`)
      .get(user, id) as unknown as SessionRow | undefined;
    return row && toSession(row);
  }

  createSession(user: string, name: string): SessionSummary {
    const now = this.#timestamp();
    this.#db
      .prepare('INSERT INTO users (username, created_at) VALUES (?, ?) ON CONFLICT DO NOTHING')
      .run(user, now);
    const id = randomUUID();
    try {
      this.#db
        .prepare(
          'INSERT INTO sessions (id, username, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        )
        .run(id, user, name, now, now);
    } catch (err) {
      if (err instanceof Error && /UNIQUE/.test(err.message)) {
        throw new ConflictError(`You already have a session named "${name}"`);
      }
      throw err;
    }
    const created = this.getSession(user, id);
    if (!created) throw new Error('Session was not created');
    return created;
  }

  touchSession(user: string, id: string): void {
    this.#db
      .prepare('UPDATE sessions SET updated_at = ? WHERE username = ? AND id = ?')
      .run(this.#timestamp(), user, id);
  }

  deleteSession(user: string, id: string): boolean {
    const result = this.#db
      .prepare('DELETE FROM sessions WHERE username = ? AND id = ?')
      .run(user, id);
    return result.changes > 0;
  }

  listRepos(sessionId: string): RepoRecord[] {
    const rows = this.#db
      .prepare('SELECT * FROM repos WHERE session_id = ? ORDER BY name, url')
      .all(sessionId) as unknown as RepoRow[];
    return rows.map(toRepo);
  }

  getRepo(sessionId: string, repoId: string): RepoRecord | undefined {
    const row = this.#db
      .prepare('SELECT * FROM repos WHERE session_id = ? AND id = ?')
      .get(sessionId, repoId) as unknown as RepoRow | undefined;
    return row && toRepo(row);
  }

  findRepoByUrl(sessionId: string, url: string): RepoRecord | undefined {
    const row = this.#db
      .prepare('SELECT * FROM repos WHERE session_id = ? AND url = ?')
      .get(sessionId, url) as unknown as RepoRow | undefined;
    return row && toRepo(row);
  }

  /** Inserts a repo, or updates it when `id` is given; `fetchedAt` is set to now. */
  saveRepo(input: RepoInput): RepoRecord {
    const id = input.id ?? randomUUID();
    this.#db
      .prepare(
        `INSERT INTO repos (id, session_id, url, name, default_branch, branches, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           name = excluded.name, default_branch = excluded.default_branch,
           branches = excluded.branches, fetched_at = excluded.fetched_at`,
      )
      .run(
        id,
        input.sessionId,
        input.url,
        input.name,
        input.defaultBranch,
        JSON.stringify(input.branches),
        this.#timestamp(),
      );
    const saved = this.getRepo(input.sessionId, id);
    if (!saved) throw new Error('Repo was not saved');
    return saved;
  }

  /** Records a comparison; repeating one moves it to the top. Keeps the newest 20. */
  recordComparison(sessionId: string, input: ComparisonInput): void {
    const now = this.#timestamp();
    const key = JSON.stringify([input.left, input.right]);
    this.#db
      .prepare(
        `INSERT INTO comparisons (id, session_id, key, left_src, right_src, left_label, right_label, compared_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (session_id, key) DO UPDATE SET
           compared_at = excluded.compared_at,
           left_label = excluded.left_label, right_label = excluded.right_label`,
      )
      .run(
        randomUUID(),
        sessionId,
        key,
        JSON.stringify(input.left),
        JSON.stringify(input.right),
        input.leftLabel,
        input.rightLabel,
        now,
      );
    this.#db
      .prepare(
        `DELETE FROM comparisons WHERE session_id = ? AND id NOT IN (
           SELECT id FROM comparisons WHERE session_id = ? ORDER BY compared_at DESC LIMIT ?)`,
      )
      .run(sessionId, sessionId, MAX_RECENT);
    this.#db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);
  }

  listComparisons(sessionId: string): RecentComparison[] {
    const rows = this.#db
      .prepare('SELECT * FROM comparisons WHERE session_id = ? ORDER BY compared_at DESC LIMIT ?')
      .all(sessionId, MAX_RECENT) as unknown as ComparisonRow[];
    return rows.map(toComparison);
  }
}
