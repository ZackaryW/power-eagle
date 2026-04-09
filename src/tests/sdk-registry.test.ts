import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPluginEagleInvocationRegistry, createUtilityEagleInvocationRegistry, createWebEagleInvocationRegistry, invokeEaglePath } from '../sdk';
import type { HostEagleRuntime } from '../sdk';

/**
 * Restore all mocks after each registry test.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

describe('sdk eagle registry', () => {
  it('maps host eagle methods into the plugin registry', async () => {
    const showSpy = vi.fn().mockResolvedValue(undefined);
    const pluginRegistry = createPluginEagleInvocationRegistry({
      notification: {
        show: showSpy,
      },
    });

    await invokeEaglePath(pluginRegistry, 'notification.show', [{
      title: 'Hello',
      description: 'From plugin registry',
    }], {});

    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(showSpy).toHaveBeenCalledWith({
      title: 'Hello',
      description: 'From plugin registry',
    }, {});
  });

  it('binds host methods to their owning namespace object', async () => {
    const hostEagle: HostEagleRuntime = {
      item: {
        prefix: 'item:',
        async addFromPath(this: { prefix: string }, filePath: string) {
          return `${this.prefix}${filePath}`;
        },
      },
    };

    const pluginRegistry = createPluginEagleInvocationRegistry(hostEagle);
    const result = await invokeEaglePath(pluginRegistry, 'item.addFromPath', ['C:/Temp/note.md'], {});

    expect(result).toBe('item:C:/Temp/note.md');
  });

  it('falls back to the old webapi surface for library.switch in the web registry when the host runtime does not expose it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            preferences: {
              developer: {
                apiToken: 'token-123',
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ data: { ok: true } }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const hostEagle: HostEagleRuntime = {
      notification: {
        show: async () => undefined,
      },
      library: {
        info: async () => ({ path: 'C:/Example.library' }),
      },
    };

    const registry = createWebEagleInvocationRegistry(hostEagle);
    await invokeEaglePath(registry, 'library.switch', ['D:/Target.library'], {});

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('library/switch');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('D:/Target.library');
  });

  it('reads recent libraries through the utility registry from Eagle settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          preferences: {
            developer: {
              apiToken: 'unused-token',
            },
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const readFileMock = vi.fn().mockResolvedValue(JSON.stringify({
      libraryHistory: [
        'C:/Users/Zackary/Documents/Eagle/Main.library',
        'D:/Eagle/Projects.library',
      ],
    }));

    const hostEagle: HostEagleRuntime = {
      app: {
        getPath: async () => 'C:/Users/Zackary/AppData/Roaming',
      },
    };

    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: {
        require: (moduleName: string) => {
          if (moduleName === 'fs') {
            return {
              promises: {
                readFile: readFileMock,
              },
            };
          }

          throw new Error(`Unexpected module request: ${moduleName}`);
        },
      },
      configurable: true,
    });

    try {
      const registry = createUtilityEagleInvocationRegistry(hostEagle);
      const libraries = await invokeEaglePath(registry, 'getRecentLibraries', [], {});

      expect(libraries).toEqual([
        'C:/Users/Zackary/Documents/Eagle/Main.library',
        'D:/Eagle/Projects.library',
      ]);
      expect(readFileMock).toHaveBeenCalledWith('C:/Users/Zackary/AppData/Roaming/eagle/Settings', 'utf8');
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
      });
    }
  });
});