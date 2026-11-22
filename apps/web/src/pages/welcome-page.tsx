import { UsernameSchema } from '@om/shared';
import { useId, useState, type JSX, type SubmitEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Logo } from '../components/logo.tsx';
import { getStoredUser, storeUser } from '../lib/user.ts';

/** Asks for a username; skips straight to the remembered user's sessions. */
export function WelcomePage(): JSX.Element {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const id = useId();
  const stored = getStoredUser();

  if (stored !== undefined && stored !== '')
    return <Navigate replace to={`/u/${encodeURIComponent(stored)}`} />;

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = UsernameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid username');
      return;
    }
    storeUser(parsed.data);
    void navigate(`/u/${encodeURIComponent(parsed.data)}`);
  };

  return (
    <div className="m-auto w-full max-w-sm p-6">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Logo className="size-16" />
        <h1 className="text-2xl font-semibold tracking-tight">OM · Operation Mole</h1>
        <p className="text-sm text-muted">
          Dig into two folders or git branches and see exactly what differs.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3 rounded-lg border border-line bg-surface p-4">
        <label htmlFor={id} className="block text-sm font-medium">
          Username
        </label>
        <input
          id={id}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
          autoFocus
          autoComplete="username"
          spellCheck={false}
          placeholder="e.g. alex"
          className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        {error !== undefined && error !== '' && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
