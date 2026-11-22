const KEY = 'om-user';

/** The username remembered in this browser, if any (storage errors count as none). */
export function getStoredUser(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Remembers the username so the welcome page can skip straight to it next time. */
export function storeUser(user: string): void {
  try {
    localStorage.setItem(KEY, user);
  } catch {
    // Storage unavailable: the user just types their name again next time.
  }
}

/** Forgets the remembered username ("switch user"). */
export function clearStoredUser(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}
