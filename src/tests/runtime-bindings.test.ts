import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPeagleRuntime } from '../core/runtime/peagle-runtime';
import { invokeRuntimeTuple } from '../core/runtime/invoke-runtime-tuple';
import { createSlotNodeMap, createSlotRegistry } from '../core/runtime/slot-registry';
import type { HostEagleRuntime, RegistryEntry, UiNode } from '../core/types/plugin';

/**
 * Create a minimal host Eagle runtime double for runtime binding tests.
 */
function createHostEagleStub(overrides: Partial<HostEagleRuntime> = {}): HostEagleRuntime {
  return {
    notification: {
      show: async () => undefined,
    },
    library: {
      info: async () => ({ path: 'C:/Example.library' }),
      switch: async () => undefined,
    },
    item: {
      getSelected: async () => [],
      addTags: async () => undefined,
    },
    app: {
      getPath: async () => 'C:/Users/Zackary/AppData/Roaming',
    },
    dialog: {
      showSaveDialog: async () => ({ canceled: true }),
    },
    ...overrides,
  };
}

/**
 * Create a runtime around one minimal UI tree and local registry.
 */
function createRuntime(ui: UiNode, registry: Map<string, RegistryEntry> = new Map(), hostEagle: HostEagleRuntime = createHostEagleStub()) {
  const slots = createSlotRegistry(ui);
  const slotNodes = createSlotNodeMap(ui);

  return createPeagleRuntime({
    hostEagle,
    registry,
    slots,
    slotNodes,
    templates: {},
    initialState: {},
    stateSlots: {},
  });
}

/**
 * Restore runtime globals after each runtime binding test.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

describe('runtime bindings', () => {
  it('auto-binds plain input slots to same-named state keys', async () => {
    const runtime = createRuntime({
      layout: 'container',
      children: [
        {
          type: 'input',
          slot: 'documentName',
        },
      ],
    });

    await runtime.slot('documentName').onInput?.('release-notes');

    expect(runtime.state.values.documentName).toBe('release-notes');
  });

  it('resolves state and runtime args inside invocation tuples', async () => {
    const capture = vi.fn(async (_peagle: unknown, args: unknown[], kwargs: Record<string, unknown>) => ({ args, kwargs }));
    const registry = new Map<string, RegistryEntry>([
      ['actions/capture', { key: 'actions/capture', modulePath: 'actions/capture.js', exportedDefault: capture }],
    ]);
    const runtime = createRuntime({ layout: 'container', children: [] }, registry);
    runtime.state.values.documentName = 'roadmap';

    const result = await invokeRuntimeTuple(
      runtime,
      ['local', 'actions/capture', ['{{state.documentName}}', 'prefix-{{input}}'], { mirrored: '{{input}}', list: '{{args}}' }],
      ['draft'],
    ) as { args: unknown[]; kwargs: Record<string, unknown> };

    expect(capture).toHaveBeenCalledOnce();
    expect(result.args).toEqual(['roadmap', 'prefix-draft']);
    expect(result.kwargs).toEqual({ mirrored: 'draft', list: ['draft'] });
  });

  it('creates text files through the shared file.createWithContent ext preset', async () => {
    const mkdirMock = vi.fn().mockResolvedValue(undefined);
    const writeFileMock = vi.fn().mockResolvedValue(undefined);
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, 'window', {
      value: {
        require: (moduleName: string) => {
          if (moduleName === 'fs') {
            return {
              promises: {
                mkdir: mkdirMock,
                writeFile: writeFileMock,
              },
            };
          }

          if (moduleName === 'path') {
            return {
              dirname: (filePath: string) => filePath.split('/').slice(0, -1).join('/'),
            };
          }

          throw new Error(`Unexpected module request: ${moduleName}`);
        },
      },
      configurable: true,
    });

    try {
      const runtime = createRuntime(
        { layout: 'container', children: [] },
        new Map(),
        createHostEagleStub({
          dialog: {
            showSaveDialog: async () => ({ canceled: false, filePath: 'C:/Temp/notes.md' }),
          },
        }),
      );
      runtime.state.values.documentName = 'notes';

      await invokeRuntimeTuple(runtime, ['ext', 'file.createWithContent', [], {
        fileName: '{{state.documentName}}',
        extension: 'md',
        title: 'Create File',
        successBody: 'Created {{state.documentName}}.md',
        content: '# {{state.documentName}}\n',
      }]);

      expect(mkdirMock).toHaveBeenCalledWith('C:/Temp', { recursive: true });
      expect(writeFileMock).toHaveBeenCalledWith('C:/Temp/notes.md', '# notes\n', 'utf8');
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
      });
    }
  });
});