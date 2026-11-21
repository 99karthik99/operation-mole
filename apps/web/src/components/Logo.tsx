import faviconUrl from '/favicon.svg';

/** The OM mark: a mole peeking out of its hill. */
export function Logo({ className = 'size-7' }: { className?: string }) {
  return <img src={faviconUrl} alt="Operation Mole" className={className} />;
}
