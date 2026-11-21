import type { FileCompareResult, FileContent } from '@om/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { USER, sessionDetailHandler } from '../test/handlers.ts';
import { renderApp } from '../test/render.tsx';
import { server } from '../test/server.ts';

// Monaco needs a real browser; replace it with a stub that exposes its inputs.
vi.mock('../components/DiffView.tsx', () => ({
  DiffView: (props: { original: string; modified: string; language: string }) => (
    <div data-testid="diff-view" data-language={props.language}>
      <pre data-testid="original">{props.original}</pre>
      <pre data-testid="modified">{props.modified}</pre>
    </div>
  ),
}));

const text = (path: string, content: string, sha = 'a'.repeat(64)): FileContent => ({
  path,
  size: content.length,
  sha256: sha,
  binary: false,
  content,
});

const files: Record<string, FileContent> = {
  '/l/a.ts': text('/l/a.ts', 'const a = 1;\n'),
  '/r/a.ts': text('/r/a.ts', 'const a = 2;\n', 'b'.repeat(64)),
  '/l/same.txt': text('/l/same.txt', 'same'),
  '/r/same.txt': text('/r/same.txt', 'same'),
  '/l/img.png': { path: '/l/img.png', size: 2048, sha256: 'c'.repeat(64), binary: true },
  '/r/img.png': { path: '/r/img.png', size: 4096, sha256: 'd'.repeat(64), binary: true },
  '/l/big.log': {
    path: '/l/big.log',
    size: 9e7,
    sha256: 'e'.repeat(64),
    binary: false,
    tooLarge: true,
  },
};

const FILES = `/u/${USER}/s/s1/files`;

beforeEach(() => {
  server.use(
    sessionDetailHandler(),
    http.get('*/api/compare/files', ({ request }) => {
      const url = new URL(request.url);
      const left = url.searchParams.get('left') ?? undefined;
      const right = url.searchParams.get('right') ?? undefined;
      for (const p of [left, right]) {
        if (p !== undefined && !(p in files)) {
          return HttpResponse.json({ message: `File does not exist: ${p}` }, { status: 404 });
        }
      }
      const l = left === undefined ? undefined : files[left];
      const r = right === undefined ? undefined : files[right];
      const body: FileCompareResult = {
        identical: l !== undefined && r !== undefined && l.sha256 === r.sha256,
        ...(l ? { left: l } : {}),
        ...(r ? { right: r } : {}),
      };
      return HttpResponse.json(body);
    }),
  );
});

describe('FileComparePage', () => {
  it('shows a diff of two text files', async () => {
    renderApp(`${FILES}?left=%2Fl%2Fa.ts&right=%2Fr%2Fa.ts`);
    expect(await screen.findByTestId('original')).toHaveTextContent('const a = 1;');
    expect(screen.getByTestId('modified')).toHaveTextContent('const a = 2;');
    expect(screen.getByTestId('diff-view')).toHaveAttribute('data-language', 'typescript');
    expect(screen.getByText(/files differ/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/base file/i)).toHaveValue('/l/a.ts');
  });

  it('says when files are identical', async () => {
    renderApp(`${FILES}?left=%2Fl%2Fsame.txt&right=%2Fr%2Fsame.txt`);
    expect(await screen.findByText(/files are identical/i)).toBeInTheDocument();
  });

  it('shows a summary instead of a diff for binary files', async () => {
    renderApp(`${FILES}?left=%2Fl%2Fimg.png&right=%2Fr%2Fimg.png`);
    expect(await screen.findByText(/binary files differ/i)).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
    expect(screen.getByText('4 KB')).toBeInTheDocument();
    expect(screen.queryByTestId('diff-view')).not.toBeInTheDocument();
  });

  it('shows a summary for files too large to display', async () => {
    renderApp(`${FILES}?left=%2Fl%2Fbig.log`);
    expect(await screen.findByText(/too large to display/i)).toBeInTheDocument();
    expect(screen.queryByTestId('diff-view')).not.toBeInTheDocument();
  });

  it('shows a one-sided file against an empty side', async () => {
    renderApp(`${FILES}?right=%2Fr%2Fa.ts`);
    expect(await screen.findByTestId('modified')).toHaveTextContent('const a = 2;');
    expect(screen.getByTestId('original')).toBeEmptyDOMElement();
    expect(screen.getByText(/only exists in the target/i)).toBeInTheDocument();
  });

  it('shows API errors', async () => {
    renderApp(`${FILES}?left=%2Fnope.txt&right=%2Fr%2Fa.ts`);
    expect(await screen.findByRole('alert')).toHaveTextContent('File does not exist: /nope.txt');
  });

  it('puts typed paths in the URL', async () => {
    const user = userEvent.setup();
    const app = renderApp(FILES);
    await user.type(screen.getByLabelText(/base file/i), '/l/a.ts');
    await user.type(screen.getByLabelText(/target file/i), '/r/a.ts');
    await user.click(screen.getByRole('button', { name: /^compare$/i }));
    expect(await screen.findByTestId('diff-view')).toBeInTheDocument();
    expect(app.search().get('left')).toBe('/l/a.ts');
    expect(app.search().get('right')).toBe('/r/a.ts');
  });

  it('links back to the folder comparison it came from', async () => {
    const from = `/u/${USER}/s/s1/folders?left=%2Fl&right=%2Fr&path=src`;
    renderApp(`${FILES}?left=%2Fl%2Fa.ts&right=%2Fr%2Fa.ts&from=${encodeURIComponent(from)}`);
    expect(await screen.findByRole('link', { name: /back to folder comparison/i })).toHaveAttribute(
      'href',
      from,
    );
  });

  it('ignores a back link that points outside the app', async () => {
    renderApp(`${FILES}?left=%2Fl%2Fa.ts&from=${encodeURIComponent('https://evil.example')}`);
    await screen.findByTestId('diff-view');
    expect(
      screen.queryByRole('link', { name: /back to folder comparison/i }),
    ).not.toBeInTheDocument();
  });
});
