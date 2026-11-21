import type {
  DefaultsResponse,
  DirectoryCompareRequest,
  DirectoryCompareResult,
  FileCompareResult,
  RepoInfo,
  SessionDetail,
  SessionSummary,
} from '@om/shared';

export class ApiRequestError extends Error {
  override name = 'ApiRequestError';
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const UNREACHABLE =
  "Can't reach the OM API server. Make sure it is running (npm run dev), then try again.";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(new URL(path, window.location.origin), init);
  } catch {
    throw new ApiRequestError(UNREACHABLE, 0);
  }
  // The Vite dev proxy answers 502/503/504 when the API process is down.
  if ([502, 503, 504].includes(res.status)) throw new ApiRequestError(UNREACHABLE, res.status);
  const body: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : `Request failed (${res.status})`;
    throw new ApiRequestError(message, res.status);
  }
  return body as T;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined
    ? {}
    : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
});

const sessionsUrl = (user: string) => `/api/users/${encodeURIComponent(user)}/sessions`;
const sessionUrl = (user: string, sessionId: string) =>
  `${sessionsUrl(user)}/${encodeURIComponent(sessionId)}`;

export function compareDirectories(body: DirectoryCompareRequest) {
  return request<DirectoryCompareResult>('/api/compare/directories', json('POST', body));
}

export function listSessions(user: string) {
  return request<SessionSummary[]>(sessionsUrl(user));
}

export function createSession(user: string, name: string) {
  return request<SessionSummary>(sessionsUrl(user), json('POST', { name }));
}

export function getSession(user: string, sessionId: string) {
  return request<SessionDetail>(sessionUrl(user, sessionId));
}

export async function deleteSession(user: string, sessionId: string): Promise<void> {
  await request<unknown>(sessionUrl(user, sessionId), json('DELETE'));
}

export function addRepo(user: string, sessionId: string, url: string) {
  return request<RepoInfo>(`${sessionUrl(user, sessionId)}/repos`, json('POST', { url }));
}

export function fetchRepo(user: string, sessionId: string, repoId: string) {
  return request<RepoInfo>(
    `${sessionUrl(user, sessionId)}/repos/${encodeURIComponent(repoId)}/fetch`,
    json('POST'),
  );
}

export function compareFiles(left: string | undefined, right: string | undefined) {
  const params = new URLSearchParams();
  if (left) params.set('left', left);
  if (right) params.set('right', right);
  return request<FileCompareResult>(`/api/compare/files?${params}`);
}

export function getDefaults() {
  return request<DefaultsResponse>('/api/defaults');
}
