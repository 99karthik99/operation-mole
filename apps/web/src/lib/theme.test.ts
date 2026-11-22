import { describe, expect, it } from 'vitest';
import { stubMatchMedia } from '../test/setup.ts';
import { getTheme, setTheme } from './theme.ts';

describe('theme', () => {
  it('follows the system preference when nothing is saved', () => {
    expect(getTheme()).toBe('light');
    stubMatchMedia(true);
    expect(getTheme()).toBe('dark');
  });

  it('applies and saves an explicit choice', () => {
    stubMatchMedia(true);
    setTheme('light');
    expect(getTheme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(localStorage.getItem('om-theme')).toBe('light');
  });

  it('reads a saved choice', () => {
    localStorage.setItem('om-theme', 'dark');
    expect(getTheme()).toBe('dark');
  });
});
