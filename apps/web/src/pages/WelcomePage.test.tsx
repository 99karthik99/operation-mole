import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderApp } from '../test/render.tsx';
import { server } from '../test/server.ts';

beforeEach(() => {
  server.use(http.get('*/api/users/:user/sessions', () => HttpResponse.json([])));
});

describe('WelcomePage', () => {
  it('asks for a username and opens that user’s sessions', async () => {
    const user = userEvent.setup();
    const app = renderApp('/');
    expect(screen.getByRole('heading', { name: /operation mole/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/username/i), '  Karthik ');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(app.location().pathname).toBe('/u/karthik');
    });
    expect(localStorage.getItem('om-user')).toBe('karthik');
  });

  it('explains invalid usernames', async () => {
    const user = userEvent.setup();
    const app = renderApp('/');
    await user.type(screen.getByLabelText(/username/i), 'not valid!');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/letters, digits/i);
    expect(app.location().pathname).toBe('/');
  });

  it('goes straight to the remembered user', async () => {
    localStorage.setItem('om-user', 'karthik');
    const app = renderApp('/');
    await waitFor(() => {
      expect(app.location().pathname).toBe('/u/karthik');
    });
  });
});
