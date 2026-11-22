import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { RecentComparison, RepoInfo, SessionSummary, Source } from '@om/shared';
import { SourceSchema } from '@om/shared';
import { z } from 'zod';
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

/** A cloned repo as stored: the API fields plus the session that owns it. */
export type RepoRecord = {
  sessionId: string;
} & RepoInfo;

/** What {@link Store.saveRepo} takes: a new repo, or an existing one when `id` is set. */
export type RepoInput = Omit<RepoRecord, 'id' | 'fetchedAt'> & { id?: string };

/** A comparison to record in a session's recent list. */
export type ComparisonInput = {
  left: Source;
  right: Source;
  leftLabel: string;
  rightLabel: string;
};

/** A TEXT column holding JSON, validated against `schema`. */
const jsonColumn = <T extends z.ZodType>(schema: T) =>
  z
    .string()
    .transform((text): unknown => JSON.parse(text))
    .pipe(schema);

/*
 * Rows are parsed, not cast: SQL aliases give them the API's camelCase names, and these
 * schemas check every column, so a schema change that breaks a row fails loudly.
 */
const SessionRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  repoCount: z.number(),
}) satisfies z.ZodType<SessionSummary>;

const RepoRowSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  url: z.string(),
  name: z.string(),
  defaultBranch: z.string(),
  branches: jsonColumn(z.array(z.string())),
  fetchedAt: z.string(),
}) satisfies z.ZodType<RepoRecord>;

const ComparisonRowSchema = z.object({
  id: z.string(),
  left: jsonColumn(SourceSchema),
  right: jsonColumn(SourceSchema),
  leftLabel: z.string(),
  rightLabel: z.string(),
  comparedAt: z.string(),
}) satisfies z.ZodType<RecentComparison>;

const SESSION_SELECT = `
  SELECT s.id, s.name, s.created_at AS createdAt, s.updated_at AS updatedAt,
         (SELECT COUNT(*) FROM repos r WHERE r.session_id = s.id) AS repoCount
  FROM sessions s`;

const REPO_SELECT = `
  SELECT id, session_id AS sessionId, url, name, default_branch AS defaultBranch, branches,
         fetched_at AS fetchedAt
  FROM repos`;

const COMPARISON_SELECT = `
  SELECT id, left_src AS "left", right_src AS "right", left_label AS leftLabel,
         right_label AS rightLabel, compared_at AS comparedAt
  FROM comparisons`;

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
      .all(user);
    return rows.map((row) => SessionRowSchema.parse(row));
  }

  getSession(user: string, id: string): SessionSummary | undefined {
    const row = this.#db
      .prepare(`${SESSION_SELECT} WHERE s.username = ? AND s.id = ?`)
      .get(user, id);
    return row === undefined ? undefined : SessionRowSchema.parse(row);
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
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        throw new ConflictError(`You already have a session named "${name}"`);
      }
      throw err;
    }
    const session = this.getSession(user, id);
    if (session === undefined) throw new Error('Session was not created');
    return session;
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
      .prepare(`${REPO_SELECT} WHERE session_id = ? ORDER BY name, url`)
      .all(sessionId);
    return rows.map((row) => RepoRowSchema.parse(row));
  }

  getRepo(sessionId: string, repoId: string): RepoRecord | undefined {
    const row = this.#db
      .prepare(`${REPO_SELECT} WHERE session_id = ? AND id = ?`)
      .get(sessionId, repoId);
    return row === undefined ? undefined : RepoRowSchema.parse(row);
  }

  findRepoByUrl(sessionId: string, url: string): RepoRecord | undefined {
    const row = this.#db
      .prepare(`${REPO_SELECT} WHERE session_id = ? AND url = ?`)
      .get(sessionId, url);
    return row === undefined ? undefined : RepoRowSchema.parse(row);
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
    if (saved === undefined) throw new Error('Repo was not saved');
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
      .prepare(`${COMPARISON_SELECT} WHERE session_id = ? ORDER BY compared_at DESC LIMIT ?`)
      .all(sessionId, MAX_RECENT);
    return rows.map((row) => ComparisonRowSchema.parse(row));
  }
}
