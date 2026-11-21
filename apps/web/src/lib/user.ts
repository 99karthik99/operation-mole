const KEY = 'om-user';

export function getStoredUser(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function storeUser(user: string): void {
  try {
    localStorage.setItem(KEY, user);
  } catch {
    // Storage unavailable: the user just types their name again next time.
  }
}

export function clearStoredUser(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}
