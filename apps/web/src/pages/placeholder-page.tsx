import type { JSX } from 'react';
import { Link } from 'react-router';

/** Lab: reserved for the next experience. */
export function PlaceholderPage(): JSX.Element {
  return (
    <div className="m-auto max-w-md p-8 text-center text-muted">
      <h1 className="mb-2 text-lg font-semibold text-ink">Lab</h1>
      <p>Something new is on the way.</p>
    </div>
  );
}

/** Shown for any URL that matches no route. */
export function NotFoundPage(): JSX.Element {
  return (
    <div className="m-auto max-w-md p-8 text-center text-muted">
      <h1 className="mb-2 text-lg font-semibold text-ink">Page not found</h1>
      <Link to="/" className="text-accent underline">
        Go to start
      </Link>
    </div>
  );
}
