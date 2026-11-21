import type { RepoInfo, SessionDetail, SessionSummary } from '@om/shared';
import { HttpResponse, http } from 'msw';

export const USER = 'karthik';

export const sessionSummary = (overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: 's1',
  name: 'Release review',
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-21T10:00:00.000Z',
  repoCount: 0,
  ...overrides,
});

export const repoInfo = (overrides: Partial<RepoInfo> = {}): RepoInfo => ({
  id: 'r1',
  url: 'https://github.com/acme/app.git',
  name: 'app',
  defaultBranch: 'main',
  branches: ['dev', 'main'],
  fetchedAt: '2026-11-21T10:00:00.000Z',
  ...overrides,
});

/** GET handler for one session's detail (header, overview, repo pickers). */
export function sessionDetailHandler(detail: Partial<SessionDetail> = {}) {
  return http.get('*/api/users/:user/sessions/:sessionId', ({ params }) =>
    HttpResponse.json<SessionDetail>({
      user: String(params.user),
      session: sessionSummary({ id: String(params.sessionId) }),
      repos: [],
      recent: [],
      ...detail,
    }),
  );
}
