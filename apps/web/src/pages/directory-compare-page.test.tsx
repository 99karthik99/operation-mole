import type { RepoInfo, Source } from '@om/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { dirResult } from '../test/fixtures.ts';
import { USER, repoInfo } from '../test/handlers.ts';
import { renderApp } from '../test/render.tsx';
import { server } from '../test/server.ts';

type CompareBody = {
  left: Source;
  right: Source;
  user?: string;
  sessionId?: string;
};

let requests: CompareBody[];
let repos: RepoInfo[];
let fetchCalls: string[];

const label = (s: Source) => (s.type === 'path' ? s.path : `app @ ${s.branch}`);
const root = (s: Source) => (s.type === 'path' ? s.path : `/data/wt/${s.repoId}/${s.branch}`);

beforeEach(() => {
  requests = [];
  fetchCalls = [];
  repos = [repoInfo()];
  server.use(
    http.get('*/api/users/:user/sessions/:sessionId', ({ params }) =>
      HttpResponse.json({
        user: params['user'],
        session: {
          id: params['sessionId'],
          name: 'Release review',
          createdAt: '',
          updatedAt: '',
          repoCount: repos.length,
        },
        repos,
        recent: [],
      }),
    ),
    http.post('*/api/users/:user/sessions/:sessionId/repos', async ({ request }) => {
      const { url } = (await request.json()) as { url: string };
      if (url.includes('broken')) {
        return HttpResponse.json(
          { message: `Could not clone ${url}: repository not found` },
          { status: 400 },
        );
      }
      const repo = repoInfo({ id: 'r2', url, name: 'lib', branches: ['main', 'next'] });
      repos = [...repos, repo];
      return HttpResponse.json(repo, { status: 201 });
    }),
    http.post('*/api/users/:user/sessions/:sessionId/repos/:repoId/fetch', ({ params }) => {
      fetchCalls.push(String(params['repoId']));
      repos = repos.map((r) =>
        r.id === params['repoId'] ? { ...r, branches: [...r.branches, 'hotfix'] } : r,
      );
      return HttpResponse.json(repos.find((r) => r.id === params['repoId']));
    }),
    http.post('*/api/compare/directories', async ({ request }) => {
      const body = (await request.json()) as CompareBody;
      requests.push(body);
      if (body.left.type === 'path' && body.left.path === '/missing') {
        return HttpResponse.json(
          { message: 'Directory does not exist: /missing' },
          { status: 400 },
        );
      }
      return HttpResponse.json({
        ...dirResult,
        left: root(body.left),
        right: root(body.right),
        leftLabel: label(body.left),
        rightLabel: label(body.right),
      });
    }),
  );
});

const BASE = `/u/${USER}/s/s1`;
const FOLDERS = `${BASE}/folders`;
const row = (name: string) => screen.findByRole('treeitem', { name });
const loaded = `${FOLDERS}?left=%2FL&right=%2FR`;

describe('DirectoryComparePage', () => {
  it('opens the default folders from the server when none are given', async () => {
    server.use(http.get('*/api/defaults', () => HttpResponse.json({ left: '/L', right: '/R' })));
    const app = renderApp(FOLDERS);
    expect(await row('docs')).toBeInTheDocument();
    expect(app.search().get('left')).toBe('/L');
    expect(app.search().get('right')).toBe('/R');
    expect(screen.getByLabelText(/base folder/i)).toHaveValue('/L');
  });

  it('shows an empty form when there are no defaults', async () => {
    server.use(http.get('*/api/defaults', () => HttpResponse.json({})));
    renderApp(FOLDERS);
    expect(await screen.findByText(/enter two folder paths/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/base folder/i)).toHaveValue('');
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
  });

  it('puts the paths in the URL and shows the colored comparison', async () => {
    const user = userEvent.setup();
    server.use(http.get('*/api/defaults', () => HttpResponse.json({})));
    const app = renderApp(FOLDERS);
    await screen.findByText(/enter two folder paths/i);
    await user.type(screen.getByLabelText(/base folder/i), '/L');
    await user.type(screen.getByLabelText(/target folder/i), '/R');
    await user.click(screen.getByRole('button', { name: /^compare$/i }));

    expect(await row('docs')).toHaveAttribute('data-status', 'modified');
    expect(app.search().get('left')).toBe('/L');
    expect(app.search().get('right')).toBe('/R');
    expect(requests).toEqual([
      {
        left: { type: 'path', path: '/L' },
        right: { type: 'path', path: '/R' },
        user: USER,
        sessionId: 's1',
      },
    ]);

    expect(await row('new.txt')).toHaveAttribute('data-status', 'only-right');
    expect(await row('same.txt')).toHaveAttribute('data-status', 'identical');

    const summary = screen.getByRole('group', { name: /summary/i });
    expect(within(summary).getByRole('button', { name: /identical.*3/i })).toBeInTheDocument();
    expect(within(summary).getByRole('button', { name: /only in base.*2/i })).toBeInTheDocument();
    expect(within(summary).getByRole('button', { name: /only in target.*2/i })).toBeInTheDocument();
    expect(within(summary).getByRole('button', { name: /different.*1/i })).toBeInTheDocument();
  });

  it('shows the entry only on its own side for one-sided entries', async () => {
    renderApp(loaded);
    const newTxt = await row('new.txt');
    expect(within(newTxt).getByTestId('cell-left')).toHaveAttribute('data-present', 'false');
    expect(within(newTxt).getByTestId('cell-right')).toHaveAttribute('data-present', 'true');
  });

  it('shows a file and a folder with the same name as separate one-sided rows', async () => {
    const user = userEvent.setup();
    const app = renderApp(loaded);
    const outputs = await screen.findAllByRole('treeitem', { name: 'output' });
    const [outputDir, outputFile] = outputs;
    if (!outputDir || !outputFile) throw new Error('expected two output rows');
    expect(outputs.map((r) => r.getAttribute('data-status'))).toEqual(['only-right', 'only-left']);
    expect(within(outputFile).getByTestId('cell-left')).toHaveAttribute('data-present', 'true');
    expect(within(outputFile).getByTestId('cell-right')).toHaveAttribute('data-present', 'false');

    await user.dblClick(outputDir);
    expect(await row('report.txt')).toBeInTheDocument();
    expect(app.search().get('path')).toBe('output');
  });

  it('opens the left-only file of a file/folder name clash on its own', async () => {
    const user = userEvent.setup();
    const app = renderApp(loaded);
    const [, outputFile] = await screen.findAllByRole('treeitem', { name: 'output' });
    if (!outputFile) throw new Error('expected two output rows');
    await user.dblClick(outputFile);
    await waitFor(() => {
      expect(app.location().pathname).toBe(`${BASE}/files`);
    });
    expect(app.search().get('left')).toBe('/L/output');
    expect(app.search().has('right')).toBe(false);
  });

  it('restores the current folder from the URL (e.g. after reload)', async () => {
    renderApp(`${loaded}&path=docs`);
    expect(await row('readme.md')).toBeInTheDocument();
    expect(screen.queryByRole('treeitem', { name: 'same.txt' })).not.toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(within(crumbs).getByText('docs')).toHaveAttribute('aria-current', 'page');
  });

  it('navigates into a folder on double-click and records it in the URL', async () => {
    const user = userEvent.setup();
    const app = renderApp(loaded);
    await user.dblClick(await row('docs'));
    expect(await row('readme.md')).toBeInTheDocument();
    expect(app.search().get('path')).toBe('docs');
    expect(app.search().get('left')).toBe('/L');
  });

  it('navigates into a folder with Enter', async () => {
    const user = userEvent.setup();
    const app = renderApp(loaded);
    (await row('src')).focus();
    await user.keyboard('{Enter}');
    expect(await row('index.ts')).toBeInTheDocument();
    expect(app.search().get('path')).toBe('src');
  });

  it('navigates up via breadcrumbs', async () => {
    const user = userEvent.setup();
    const app = renderApp(`${loaded}&path=docs%2Fold`);
    expect(await row('a.txt')).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: /breadcrumb/i });
    await user.click(within(crumbs).getByRole('link', { name: 'docs' }));
    expect(await row('readme.md')).toBeInTheDocument();
    expect(app.search().get('path')).toBe('docs');
    await user.click(within(crumbs).getByRole('link', { name: /root/i }));
    expect(await row('same.txt')).toBeInTheDocument();
    expect(app.search().has('path')).toBe(false);
  });

  it('expands a folder in place with its chevron', async () => {
    const user = userEvent.setup();
    const app = renderApp(loaded);
    const docs = await row('docs');
    expect(docs).toHaveAttribute('aria-expanded', 'false');
    await user.click(within(docs).getByRole('button', { name: /expand/i }));
    expect(docs).toHaveAttribute('aria-expanded', 'true');
    expect(await row('readme.md')).toHaveAttribute('aria-level', '2');
    expect(screen.getByRole('treeitem', { name: 'same.txt' })).toBeInTheDocument();
    expect(app.search().has('path')).toBe(false);
  });

  it('can show differences only', async () => {
    const user = userEvent.setup();
    renderApp(loaded);
    await row('same.txt');
    await user.click(screen.getByRole('radio', { name: /differences only/i }));
    expect(screen.queryByRole('treeitem', { name: 'same.txt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('treeitem', { name: 'src' })).not.toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'new.txt' })).toBeInTheDocument();
  });

  it('explains when the folder in the URL no longer exists', async () => {
    renderApp(`${loaded}&path=gone`);
    expect(await screen.findByText(/not found in this comparison/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to root/i })).toBeInTheDocument();
  });

  it('shows API errors', async () => {
    renderApp(`${FOLDERS}?left=%2Fmissing&right=%2FR`);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Directory does not exist: /missing',
    );
  });

  it('opens the file diff for a modified file on double-click', async () => {
    const user = userEvent.setup();
    const app = renderApp(`${loaded}&path=docs`);
    await user.dblClick(await row('readme.md'));
    await waitFor(() => {
      expect(app.location().pathname).toBe(`${BASE}/files`);
    });
    expect(app.search().get('left')).toBe('/L/docs/readme.md');
    expect(app.search().get('right')).toBe('/R/docs/readme.md');
    expect(app.search().get('from')).toBe(`${loaded}&path=docs`);
  });

  it('opens a one-sided view for a file that exists on one side only', async () => {
    const user = userEvent.setup();
    const app = renderApp(loaded);
    await user.dblClick(await row('new.txt'));
    await waitFor(() => {
      expect(app.location().pathname).toBe(`${BASE}/files`);
    });
    expect(app.search().has('left')).toBe(false);
    expect(app.search().get('right')).toBe('/R/new.txt');
  });

  it('compares any two files by selecting one and comparing with another', async () => {
    const user = userEvent.setup();
    const app = renderApp(loaded);
    await user.click(
      within(await row('same.txt')).getByRole('button', { name: /select for compare/i }),
    );
    expect(screen.getByText(/selected: same\.txt/i)).toBeInTheDocument();
    await user.click(
      within(await row('new.txt')).getByRole('button', { name: /compare with selected/i }),
    );
    await waitFor(() => {
      expect(app.location().pathname).toBe(`${BASE}/files`);
    });
    expect(app.search().get('left')).toBe('/L/same.txt');
    expect(app.search().get('right')).toBe('/R/new.txt');
  });

  it('compares two branches of a repo already in the session', async () => {
    const user = userEvent.setup();
    server.use(http.get('*/api/defaults', () => HttpResponse.json({})));
    const app = renderApp(FOLDERS);
    await screen.findByText(/enter two folder paths/i);

    for (const side of ['Base', 'Target'] as const) {
      const group = screen.getByRole('radiogroup', { name: `${side} source` });
      await user.click(within(group).getByRole('radio', { name: 'Git repo' }));
      await user.selectOptions(await screen.findByLabelText(`${side} repository`), 'r1');
    }
    expect(screen.getByLabelText('Base branch')).toHaveValue('main');
    await user.selectOptions(screen.getByLabelText('Target branch'), 'dev');
    await user.click(screen.getByRole('button', { name: /^compare$/i }));

    expect(await row('docs')).toBeInTheDocument();
    expect(app.search().get('leftRepo')).toBe('r1');
    expect(app.search().get('leftBranch')).toBe('main');
    expect(app.search().get('rightBranch')).toBe('dev');
    expect(requests.at(-1)).toEqual({
      left: { type: 'git', repoId: 'r1', branch: 'main' },
      right: { type: 'git', repoId: 'r1', branch: 'dev' },
      user: USER,
      sessionId: 's1',
    });
    const columns = screen.getByTestId('column-labels');
    expect(within(columns).getByText('app @ main')).toBeInTheDocument();
    expect(within(columns).getByText('app @ dev')).toBeInTheDocument();
  });

  it('restores git sources from the URL', async () => {
    renderApp(`${FOLDERS}?leftRepo=r1&leftBranch=main&right=%2FR`);
    expect(await row('docs')).toBeInTheDocument();
    const base = screen.getByRole('radiogroup', { name: 'Base source' });
    expect(within(base).getByRole('radio', { name: 'Git repo' })).toBeChecked();
    expect(await screen.findByLabelText('Base repository')).toHaveValue('r1');
    expect(screen.getByLabelText('Base branch')).toHaveValue('main');
    expect(screen.getByLabelText(/target folder/i)).toHaveValue('/R');
  });

  it('clones a new repo by URL and selects its default branch', async () => {
    const user = userEvent.setup();
    renderApp(loaded);
    await row('docs');
    const group = screen.getByRole('radiogroup', { name: 'Target source' });
    await user.click(within(group).getByRole('radio', { name: 'Git repo' }));
    await user.selectOptions(await screen.findByLabelText('Target repository'), 'add');
    await user.type(
      screen.getByLabelText('Target repository URL'),
      'https://github.com/acme/lib.git',
    );
    await user.click(screen.getByRole('button', { name: 'Clone target repository' }));

    expect(await screen.findByLabelText('Target repository')).toHaveValue('r2');
    expect(screen.getByLabelText('Target branch')).toHaveValue('main');
    expect(
      within(screen.getByLabelText('Target branch')).getByRole('option', { name: 'next' }),
    ).toBeInTheDocument();
  });

  it('explains when a repo cannot be cloned', async () => {
    const user = userEvent.setup();
    repos = [];
    renderApp(loaded);
    await row('docs');
    const group = screen.getByRole('radiogroup', { name: 'Base source' });
    await user.click(within(group).getByRole('radio', { name: 'Git repo' }));
    await user.type(
      await screen.findByLabelText('Base repository URL'),
      'https://github.com/acme/broken.git',
    );
    await user.click(screen.getByRole('button', { name: 'Clone base repository' }));
    expect(await screen.findByText(/could not clone/i)).toBeInTheDocument();
  });

  it('fetches the latest branches for a repo on request', async () => {
    const user = userEvent.setup();
    renderApp(`${FOLDERS}?leftRepo=r1&leftBranch=main&right=%2FR`);
    await row('docs');
    await user.click(
      await screen.findByRole('button', { name: 'Fetch latest for base repository' }),
    );
    await waitFor(() => {
      expect(fetchCalls).toEqual(['r1']);
    });
    expect(
      await within(screen.getByLabelText('Base branch')).findByRole('option', { name: 'hotfix' }),
    ).toBeInTheDocument();
  });
});
