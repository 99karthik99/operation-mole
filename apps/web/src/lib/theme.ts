import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'om-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();

function saved(): Theme | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The explicit choice if one was made, otherwise the system preference. */
export function getTheme(): Theme {
  return saved() ?? (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light');
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (e.g. private mode): the choice lasts for this page only.
  }
  listeners.forEach((notify) => {
    notify();
  });
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const mql = window.matchMedia(DARK_QUERY);
  mql.addEventListener('change', onChange);
  return () => {
    listeners.delete(onChange);
    mql.removeEventListener('change', onChange);
  };
}

/** Current theme; re-renders on toggle and on system preference changes. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme);
}
