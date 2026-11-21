import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setTheme } from '../lib/theme.ts';
import { DiffView } from './DiffView.tsx';

// Monaco needs a real browser; capture the props passed to it instead.
const diffEditorProps = vi.hoisted(() => ({
  current: undefined as Record<string, unknown> | undefined,
}));
vi.mock('../lib/monaco.ts', () => ({}));
vi.mock('@monaco-editor/react', () => ({
  DiffEditor: (props: Record<string, unknown>) => {
    diffEditorProps.current = props;
    return null;
  },
}));

const options = () => diffEditorProps.current?.options as Record<string, unknown>;

beforeEach(() => {
  diffEditorProps.current = undefined;
});

describe('DiffView', () => {
  it('keeps the side-by-side layout even when space is limited', () => {
    render(<DiffView original="a" modified="b" language="json" sideBySide />);
    expect(options()).toMatchObject({
      renderSideBySide: true,
      useInlineViewWhenSpaceIsLimited: false,
    });
  });

  it('switches to the inline layout when asked', () => {
    render(<DiffView original="a" modified="b" language="json" sideBySide={false} />);
    expect(options()).toMatchObject({ renderSideBySide: false });
  });

  it('follows the app theme', () => {
    setTheme('dark');
    render(<DiffView original="a" modified="b" language="json" />);
    expect(diffEditorProps.current).toMatchObject({ theme: 'vs-dark' });
  });

  it('is read-only on both sides', () => {
    render(<DiffView original="a" modified="b" language="json" />);
    expect(options()).toMatchObject({ readOnly: true, originalEditable: false });
    expect(diffEditorProps.current).toMatchObject({
      original: 'a',
      modified: 'b',
      language: 'json',
    });
  });
});
