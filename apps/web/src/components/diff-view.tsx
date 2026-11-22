import '../lib/monaco.ts';
import { DiffEditor } from '@monaco-editor/react';
import type { JSX } from 'react';
import { useTheme } from '../lib/theme.ts';

type DiffViewProps = {
  original: string;
  modified: string;
  language: string;
  sideBySide?: boolean;
};

/** Read-only Monaco diff editor (the VS Code diff engine). */
export function DiffView({
  original,
  modified,
  language,
  sideBySide = true,
}: DiffViewProps): JSX.Element {
  const isDark = useTheme() === 'dark';
  return (
    <DiffEditor
      height="100%"
      original={original}
      modified={modified}
      language={language}
      theme={isDark ? 'vs-dark' : 'light'}
      options={{
        readOnly: true,
        originalEditable: false,
        renderSideBySide: sideBySide,
        // Monaco otherwise silently switches to inline below ~900px; the toggle decides instead.
        useInlineViewWhenSpaceIsLimited: false,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        minimap: { enabled: false },
        renderOverviewRuler: true,
        ignoreTrimWhitespace: false,
        fontSize: 13,
      }}
    />
  );
}
