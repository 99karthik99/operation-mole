import '../lib/monaco.ts';
import { DiffEditor } from '@monaco-editor/react';
import { useTheme } from '../lib/theme.ts';

interface DiffViewProps {
  original: string;
  modified: string;
  language: string;
  sideBySide?: boolean;
}

/** Read-only Monaco diff editor (the VS Code diff engine). */
export function DiffView({ original, modified, language, sideBySide = true }: DiffViewProps) {
  const dark = useTheme() === 'dark';
  return (
    <DiffEditor
      height="100%"
      original={original}
      modified={modified}
      language={language}
      theme={dark ? 'vs-dark' : 'light'}
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
