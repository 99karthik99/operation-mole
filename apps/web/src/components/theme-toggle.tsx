import { Moon, Sun } from 'lucide-react';
import type { JSX } from 'react';
import { setTheme, useTheme } from '../lib/theme.ts';

/** Button that switches between light and dark mode. */
export function ThemeToggle(): JSX.Element {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = `Switch to ${next} mode`;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="rounded-md p-2 text-muted hover:bg-hover hover:text-ink"
      onClick={() => {
        setTheme(next);
      }}
    >
      {theme === 'dark' ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </button>
  );
}
