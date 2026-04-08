import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { removeLocalPluginFromHost } from '../app/install-store';

/**
 * Restore globals and temporary directories after each install-store test.
 */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('install-store local bucket removal', () => {
  it('deletes the local bucket plugin directory from ~/.powereagle', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'peagle-install-store-'));
    const localPluginDir = path.join(tempRoot, '.powereagle', 'buckets', 'local', 'plugins', 'sample-plugin');
    fs.mkdirSync(localPluginDir, { recursive: true });
    fs.writeFileSync(path.join(localPluginDir, 'plugin.json'), JSON.stringify({ id: 'sample-plugin', ui: {} }), 'utf8');

    Object.defineProperty(globalThis, 'window', {
      value: {
        require: (moduleName: string) => {
          if (moduleName === 'fs') {
            return fs;
          }

          if (moduleName === 'path') {
            return path;
          }

          if (moduleName === 'os') {
            return {
              ...os,
              homedir: () => tempRoot,
            };
          }

          throw new Error(`Unexpected module request: ${moduleName}`);
        },
      },
      configurable: true,
    });

    try {
      expect(removeLocalPluginFromHost('sample-plugin')).toBe(true);
      expect(fs.existsSync(localPluginDir)).toBe(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});