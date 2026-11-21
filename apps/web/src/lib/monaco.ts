import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';

// Bundle Monaco locally instead of loading it from a CDN (works offline).
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
