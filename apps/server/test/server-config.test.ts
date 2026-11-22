import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadServerConfig } from '../src/config/server-config.ts';

const repoRoot = path.join(path.parse(process.cwd()).root, 'repo');

describe('loadServerConfig', () => {
  it('defaults to loopback, port 5181, the example folders and .data', () => {
    expect(loadServerConfig({}, [], repoRoot)).toEqual({
      ok: true,
      value: {
        port: 5181,
        host: '127.0.0.1',
        isProduction: false,
        defaultLeft: path.join(repoRoot, 'examples', 'left'),
        defaultRight: path.join(repoRoot, 'examples', 'right'),
        dataDir: path.join(repoRoot, '.data'),
      },
    });
  });

  it('reads overrides from the environment', () => {
    const result = loadServerConfig(
      {
        API_PORT: '6000',
        HOST: '0.0.0.0',
        OM_LEFT: '/l',
        OM_RIGHT: 'C:\\r',
        OM_DATA_DIR: '/d',
      },
      [],
      repoRoot,
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        port: 6000,
        host: '0.0.0.0',
        defaultLeft: '/l',
        defaultRight: 'C:\\r',
        dataDir: '/d',
      },
    });
  });

  it('is in production mode with --production or NODE_ENV=production', () => {
    expect(loadServerConfig({}, ['--production'], repoRoot)).toMatchObject({
      value: { isProduction: true },
    });
    expect(loadServerConfig({ NODE_ENV: 'production' }, [], repoRoot)).toMatchObject({
      value: { isProduction: true },
    });
  });

  it('ignores PORT, which the preview runner sets for the web app', () => {
    expect(loadServerConfig({ PORT: '5180' }, [], repoRoot)).toMatchObject({
      value: { port: 5181 },
    });
  });

  it.each(['abc', '0', '70000', '1.5'])('returns an error for API_PORT=%s', (port) => {
    const result = loadServerConfig({ API_PORT: port }, [], repoRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/API_PORT/);
  });
});
