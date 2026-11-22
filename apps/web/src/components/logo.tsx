import type { JSX } from 'react';

// Served from `public/`; referenced by URL rather than imported (importing it breaks under Vitest).
const MARK_URL = '/favicon.svg';

/** The OM mark: a mole peeking out of its hill. */
export function Logo({ className = 'size-7' }: { className?: string }): JSX.Element {
  return <img src={MARK_URL} alt="Operation Mole" className={className} />;
}
