import type { SessionSummary } from '@om/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { USER, sessionDetailHandler, sessionSummary } from '../test/handlers.ts';
import { renderApp } from '../test/render.tsx';
import { server } from '../test/server.ts';

let sessions: SessionSummary[];

beforeEach(() => {
  sessions = [
    sessionSummary({ id: 's1', name: 'Release review', repoCount: 2 }),
    sessionSummary({ id: 's2', name: 'Hotfix check', repoCount: 0 }),
  ];
  server.use(
    http.get('*/api/users/:user/sessions', () => HttpResponse.json(sessions)),
    http.post('*/api/users/:user/sessions', async ({ request }) => {
      const { name } = (await request.json()) as { name: string };
      if (sessions.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
        return HttpResponse.json(
          { message: `You already have a session named "${name}"` },
          { status: 409 },
        );
      }
      const created = sessionSummary({ id: 's3', name });
      sessions = [created, ...sessions];
      return HttpResponse.json(created, { status: 201 });
    }),
    http.delete('*/api/users/:user/sessions/:id', ({ params }) => {
      sessions = sessions.filter((s) => s.id !== params['id']);
      return new HttpResponse(null, { status: 204 });
    }),
    sessionDetailHandler(),
  );
});

describe('SessionsPage', () => {
  it('lists the user’s sessions with links into them', async () => {
    renderApp(`/u/${USER}`);
    expect(await screen.findByRole('heading', { name: /karthik’s sessions/i })).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: /sessions/i });
    const link = within(list).getByRole('link', { name: /release review/i });
    expect(link).toHaveAttribute('href', `/u/${USER}/s/s1`);
    expect(within(list).getByText(/2 repos/i)).toBeInTheDocument();
  });

  it('creates a session and opens it', async () => {
    const user = userEvent.setup();
    const app = renderApp(`/u/${USER}`);
    await user.type(await screen.findByLabelText(/new session name/i), 'Sprint 42');
    await user.click(screen.getByRole('button', { name: /create session/i }));
    await waitFor(() => {
      expect(app.location().pathname).toBe(`/u/${USER}/s/s3`);
    });
  });

  it('shows why a session could not be created', async () => {
    const user = userEvent.setup();
    renderApp(`/u/${USER}`);
    await user.type(await screen.findByLabelText(/new session name/i), 'release review');
    await user.click(screen.getByRole('button', { name: /create session/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already have a session/i);
  });

  it('deletes a session after confirming', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp(`/u/${USER}`);
    await user.click(await screen.findByRole('button', { name: /delete hotfix check/i }));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/hotfix check/i));
    await waitFor(() => {
      expect(screen.queryByText('Hotfix check')).not.toBeInTheDocument();
    });
    confirm.mockRestore();
  });

  it('shows an empty state', async () => {
    sessions = [];
    renderApp(`/u/${USER}`);
    expect(await screen.findByText(/no sessions yet/i)).toBeInTheDocument();
  });

  it('switches user', async () => {
    const user = userEvent.setup();
    localStorage.setItem('om-user', USER);
    const app = renderApp(`/u/${USER}`);
    await user.click(await screen.findByRole('button', { name: /switch user/i }));
    await waitFor(() => {
      expect(app.location().pathname).toBe('/');
    });
    expect(localStorage.getItem('om-user')).toBeNull();
  });
});
