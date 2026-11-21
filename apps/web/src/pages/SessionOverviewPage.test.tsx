import type { RecentComparison, RepoInfo } from '@om/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { USER, repoInfo, sessionSummary } from '../test/handlers.ts';
import { renderApp } from '../test/render.tsx';
import { server } from '../test/server.ts';

let repos: RepoInfo[];
let recent: RecentComparison[];
let added: string[];

beforeEach(() => {
  added = [];
  repos = [repoInfo()];
  recent = [
    {
      id: 'c1',
      left: { type: 'git', repoId: 'r1', branch: 'main' },
      right: { type: 'git', repoId: 'r1', branch: 'dev' },
      leftLabel: 'app @ main',
      rightLabel: 'app @ dev',
      comparedAt: new Date().toISOString(),
    },
    {
      id: 'c2',
      left: { type: 'path', path: '/a' },
      right: { type: 'path', path: '/b' },
      leftLabel: '/a',
      rightLabel: '/b',
      comparedAt: new Date().toISOString(),
    },
  ];
  server.use(
    http.get('*/api/users/:user/sessions/:sessionId', () =>
      HttpResponse.json({ user: USER, session: sessionSummary(), repos, recent }),
    ),
    http.post('*/api/users/:user/sessions/:sessionId/repos', async ({ request }) => {
      const { url } = (await request.json()) as { url: string };
      added.push(url);
      const repo = repoInfo({ id: 'r2', url, name: 'lib' });
      repos = [...repos, repo];
      return HttpResponse.json(repo, { status: 201 });
    }),
    http.post('*/api/users/:user/sessions/:sessionId/repos/:repoId/fetch', () => {
      repos = repos.map((r) => ({ ...r, branches: [...r.branches, 'hotfix'] }));
      return HttpResponse.json(repos[0]);
    }),
  );
});

const OVERVIEW = `/u/${USER}/s/s1`;

describe('SessionOverviewPage', () => {
  it('lists recent comparisons as links that reopen them', async () => {
    renderApp(OVERVIEW);
    const list = await screen.findByRole('list', { name: /recent comparisons/i });
    const links = within(list).getAllByRole('link');
    expect(links[0]).toHaveAccessibleName(/app @ main.*app @ dev/);
    expect(links[0]).toHaveAttribute(
      'href',
      `${OVERVIEW}/folders?leftRepo=r1&leftBranch=main&rightRepo=r1&rightBranch=dev`,
    );
    expect(links[1]).toHaveAttribute('href', `${OVERVIEW}/folders?left=%2Fa&right=%2Fb`);
  });

  it('lists the session’s repos with their branches', async () => {
    renderApp(OVERVIEW);
    const list = await screen.findByRole('list', { name: /repositories/i });
    expect(within(list).getByText('app')).toBeInTheDocument();
    expect(within(list).getByText('https://github.com/acme/app.git')).toBeInTheDocument();
    expect(within(list).getByText(/2 branches/i)).toBeInTheDocument();
  });

  it('fetches the latest for a repo', async () => {
    const user = userEvent.setup();
    renderApp(OVERVIEW);
    await user.click(await screen.findByRole('button', { name: 'Fetch latest for app' }));
    expect(await screen.findByText(/3 branches/i)).toBeInTheDocument();
  });

  it('adds a repo by URL', async () => {
    const user = userEvent.setup();
    renderApp(OVERVIEW);
    await user.type(
      await screen.findByLabelText(/repository url/i),
      'https://github.com/acme/lib.git',
    );
    await user.click(screen.getByRole('button', { name: /add repository/i }));
    await waitFor(() => {
      expect(added).toEqual(['https://github.com/acme/lib.git']);
    });
    expect(await screen.findByText('lib')).toBeInTheDocument();
  });

  it('shows empty states with a way to start', async () => {
    repos = [];
    recent = [];
    renderApp(OVERVIEW);
    expect(await screen.findByText(/no comparisons yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no repositories yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start a comparison/i })).toHaveAttribute(
      'href',
      `${OVERVIEW}/folders`,
    );
  });
});
