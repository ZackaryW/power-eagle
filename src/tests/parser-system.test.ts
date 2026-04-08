import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodePluginFileSystem } from '../core/filesystem/node-plugin-fs';
import { parsePluginPackage } from '../core/parser/package-parser';
import { activatePluginPackage } from '../core/runtime/activation';
import type { HostEagleRuntime } from '../core/types/plugin';

const fixtureRoot = path.resolve(__dirname, '../fixtures/recent-libraries/recent-libraries');
const recentLibrariesPayload = JSON.stringify({
  libraryHistory: [
    'C:/Users/Zackary/Documents/Eagle/Main.library',
    'D:/Eagle/Projects.library',
    'C:/Users/Zackary/Documents/Eagle/Archive2023.library',
  ],
});

/**
 * Create a host Eagle runtime double for parser and activation tests.
 */
function createHostEagleStub(): HostEagleRuntime {
  return {
    notification: {
      show: async () => undefined,
    },
    library: {
      info: async () => ({ path: 'C:/Example.library' }),
    },
    item: {
      getSelected: async () => [],
    },
    app: {
      getPath: async () => 'C:/Users/Zackary/AppData/Roaming',
    },
  };
}

/**
 * Install a window.require test double that serves a stable Eagle settings payload.
 */
function installRecentLibrariesRuntimeStub(): void {
  Object.defineProperty(globalThis, 'window', {
    value: {
      require: (moduleName: string) => {
        if (moduleName === 'fs') {
          return {
            promises: {
              readFile: vi.fn().mockResolvedValue(recentLibrariesPayload),
            },
          };
        }

        throw new Error(`Unexpected module request: ${moduleName}`);
      },
    },
    configurable: true,
  });
}

/**
 * Restore the global window object after each parser test.
 */
function restoreWindow(originalWindow: Window | typeof globalThis | undefined): void {
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
  });
}

describe('v2 parser-first runtime', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    installRecentLibrariesRuntimeStub();
  });

  afterEach(() => {
    restoreWindow(originalWindow);
  });

  it('parses the recent-libraries v2 package from plugin.json without executing local modules', async () => {
    const fileSystem = new NodePluginFileSystem();
    const parsed = await parsePluginPackage(fixtureRoot, fileSystem);

    expect(parsed.declaredType).toBe('button');
    expect(parsed.manifest.id).toBe('recent-libraries');
    expect(parsed.manifest.stateVersion).toBe(2);
    expect(parsed.ui.children).toHaveLength(3);
    expect(parsed.lifecycle.onMount).toHaveLength(1);
    expect(parsed.stateSlots.filtered).toBe('results');
    expect(parsed.templates['render/libraryCard']).toBeTruthy();
    expect(parsed.modulePaths.some((modulePath) => modulePath.endsWith('actions\\refresh.js') || modulePath.endsWith('actions/refresh.js'))).toBe(true);
  });

  it('activates the recent-libraries package and renders the results slot from reactive state', async () => {
    const fileSystem = new NodePluginFileSystem();
    const activated = await activatePluginPackage(fixtureRoot, fileSystem, createHostEagleStub());

    expect(activated.slots.results.rendered).toBeInstanceOf(Array);
    const renderedResults = activated.slots.results.rendered as Array<Record<string, unknown>>;
    expect(renderedResults).toHaveLength(3);
    expect(renderedResults[0].title).toBe('Main');
    expect(activated.slots.search.onInput).toBeTypeOf('function');
  });

  it('supports filtering through the runtime-wired local action reference', async () => {
    const fileSystem = new NodePluginFileSystem();
    const activated = await activatePluginPackage(fixtureRoot, fileSystem, createHostEagleStub());

    await activated.peagle.slot('search').onInput?.('archive');
    await new Promise((resolve) => setTimeout(resolve, 350));

    const renderedResults = activated.slots.results.rendered as Array<Record<string, unknown>>;
    expect(renderedResults).toHaveLength(1);
    expect(renderedResults[0].title).toBe('Archive2023');
  });
});