import { describe, expect, it } from 'vitest';
import { languageForPath } from './language.ts';

describe('languageForPath', () => {
  it.each([
    ['/repo/src/app.ts', 'typescript'],
    ['/repo/Dockerfile', 'dockerfile'],
    ['C:\\repo\\src\\app.ts', 'typescript'],
    ['C:\\repo\\Dockerfile', 'dockerfile'],
    ['C:\\repo.v2\\README', 'plaintext'],
    ['/repo.v2/README', 'plaintext'],
  ])('%s is %s', (path, language) => {
    expect(languageForPath(path)).toBe(language);
  });
});
