import { Link } from 'react-router';

export function PlaceholderPage() {
  return (
    <div className="m-auto max-w-md p-8 text-center text-muted">
      <h1 className="mb-2 text-lg font-semibold text-ink">Lab</h1>
      <p>Something new is on the way.</p>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="m-auto max-w-md p-8 text-center text-muted">
      <h1 className="mb-2 text-lg font-semibold text-ink">Page not found</h1>
      <Link to="/" className="text-accent underline">
        Go to start
      </Link>
    </div>
  );
}
