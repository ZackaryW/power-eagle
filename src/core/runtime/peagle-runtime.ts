import { createExtRegistry } from '../ext/presets';
import { bindRenderTemplate } from '../parser/template-parser';
import { attachReactiveState, reactive, runReactiveBatch } from './state-module';
import { invokeRuntimeTuple } from './invoke-runtime-tuple';
import { createPluginEagleInvocationRegistry, createUtilityEagleInvocationRegistry, createWebEagleInvocationRegistry, invokeEaglePath } from '../../sdk';
import type {
  HostEagleRuntime,
  PeagleRuntime,
  RegistryEntry,
  RenderTemplate,
  SlotSnapshot,
  UiNode,
} from '../types/plugin';

interface CreatePeagleRuntimeOptions {
  hostEagle: HostEagleRuntime;
  registry: Map<string, RegistryEntry>;
  slots: Record<string, SlotSnapshot & { onInput?: ((value: string) => Promise<unknown>) | null }>;
  slotNodes: Map<string, UiNode>;
  templates: Record<string, RenderTemplate>;
  initialState: Record<string, unknown>;
  stateSlots: Record<string, string>;
}

/**
 * Create the peagle runtime facade used by host lifecycle hooks and local action files.
 */
export function createPeagleRuntime(options: CreatePeagleRuntimeOptions) {
  const pluginEagleRegistry = createPluginEagleInvocationRegistry(options.hostEagle);
  const webEagleRegistry = createWebEagleInvocationRegistry(options.hostEagle);
  const utilityEagleRegistry = createUtilityEagleInvocationRegistry(options.hostEagle);
  const reactiveState = reactive(options.initialState, options.stateSlots);
  const extRegistry = createExtRegistry(options.slots, options.slotNodes, options.templates, reactiveState);
  const slotToStateKey = invertSlotMapping(options.stateSlots);

  attachReactiveState(reactiveState, (slotName) => {
    const stateKey = slotToStateKey[slotName];
    if (!stateKey) {
      return;
    }

    renderSlot(options.slots, options.slotNodes, options.templates, slotName, reactiveState[stateKey]);
  });

  const peagle: PeagleRuntime = {
    local: {
      func: (key: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => async (...callArgs: unknown[]) => {
        return invokeRegistryFunction(options.registry, key, peagle, callArgs.length > 0 ? callArgs : args, kwargs);
      },
      invokeFunc: (key: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
        return invokeRegistryFunction(options.registry, key, peagle, args, kwargs);
      },
    },
    ext: {
      func: (key: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
        const configured = extRegistry.get(key)?.(peagle, args, kwargs);
        if (typeof configured === 'function') {
          return async (...callArgs: unknown[]) => configured(...callArgs);
        }

        return async (...callArgs: unknown[]) => invokeExtFunction(extRegistry, key, peagle, callArgs.length > 0 ? callArgs : args, kwargs);
      },
      invokeFunc: (key: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
        return invokeExtFunction(extRegistry, key, peagle, args, kwargs);
      },
    },
    eagle: {
      plugin: {
        func: (key: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => async (...callArgs: unknown[]) => {
          return invokeEaglePath(pluginEagleRegistry, key, callArgs.length > 0 ? callArgs : args, kwargs);
        },
        invokeFunc: (key: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
          return invokeEaglePath(pluginEagleRegistry, key, args, kwargs);
        },
      },
      web: {
        func: (key: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => async (...callArgs: unknown[]) => {
          return invokeEaglePath(webEagleRegistry, key, callArgs.length > 0 ? callArgs : args, kwargs);
        },
        invokeFunc: (key: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
          return invokeEaglePath(webEagleRegistry, key, args, kwargs);
        },
      },
      util: {
        func: (key: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => async (...callArgs: unknown[]) => {
          return invokeEaglePath(utilityEagleRegistry, key, callArgs.length > 0 ? callArgs : args, kwargs);
        },
        invokeFunc: (key: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
          return invokeEaglePath(utilityEagleRegistry, key, args, kwargs);
        },
      },
    },
    slot: (name: string) => {
      const slot = options.slots[name];
      if (!slot) {
        throw new Error(`Unknown slot: ${name}`);
      }
      return slot;
    },
    state: {
      values: reactiveState,
      batch: <T>(callback: () => T): T => {
        return runReactiveBatch(reactiveState, callback);
      },
    },
  };

  attachConfiguredInputBindings(options.slots, options.slotNodes, peagle);
  attachDefaultInputStateBindings(options.slots, options.slotNodes, reactiveState);

  return peagle;
}

/**
 * Invoke one local registry function by key.
 */
async function invokeRegistryFunction(
  registry: Map<string, RegistryEntry>,
  key: string,
  peagle: unknown,
  args: unknown[],
  kwargs: Record<string, unknown>,
): Promise<unknown> {
  const entry = registry.get(key);
  if (!entry || typeof entry.exportedDefault !== 'function') {
    throw new Error(`Local registry entry is not invokable: ${key}`);
  }

  return entry.exportedDefault(peagle, args, kwargs);
}

/**
 * Invoke one ext preset by key.
 */
async function invokeExtFunction(
  extRegistry: Map<string, (peagle: unknown, args?: unknown[], kwargs?: Record<string, unknown>) => Promise<unknown> | unknown>,
  key: string,
  peagle: unknown,
  args: unknown[],
  kwargs: Record<string, unknown>,
): Promise<unknown> {
  const preset = extRegistry.get(key);
  if (!preset) {
    throw new Error(`Unknown ext preset: ${key}`);
  }

  return preset(peagle, args, kwargs);
}

/**
 * Render one slot from a mapped reactive state value.
 */
function renderSlot(
  slots: Record<string, SlotSnapshot>,
  slotNodes: Map<string, UiNode>,
  templates: Record<string, RenderTemplate>,
  slotName: string,
  slotData: unknown,
): void {
  const slotNode = slotNodes.get(slotName);
  if (!slotNode) {
    return;
  }

  if (!Array.isArray(slotData)) {
    slots[slotName].rendered = slotData;
    return;
  }

  if (!slotNode.template || !templates[slotNode.template]) {
    slots[slotName].rendered = slotData;
    return;
  }

  slots[slotName].rendered = slotData.map((item) => bindRenderTemplate(templates[slotNode.template as string], item as Record<string, unknown>));
}

/**
 * Invert a state slot mapping so slot names can look up the source state key.
 */
function invertSlotMapping(mapping: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(mapping).map(([key, value]) => [value, key]));
}

/**
 * Attach declared onInput tuples to the slot facade for programmatic callers.
 */
function attachConfiguredInputBindings(
  slots: Record<string, SlotSnapshot & { onInput?: ((value: string) => Promise<unknown>) | null }>,
  slotNodes: Map<string, UiNode>,
  peagle: PeagleRuntime,
): void {
  for (const [slotName, slot] of Object.entries(slots)) {
    const slotNode = slotNodes.get(slotName);
    if (!slotNode?.onInput) {
      continue;
    }

    slot.onInput = async (value: string) => {
      return invokeConfiguredInput(peagle, slotNode.onInput as NonNullable<UiNode['onInput']>, value);
    };
  }
}

/**
 * Attach default onInput handlers for input slots that map directly to same-named state keys.
 */
function attachDefaultInputStateBindings(
  slots: Record<string, SlotSnapshot & { onInput?: ((value: string) => Promise<unknown>) | null }>,
  slotNodes: Map<string, UiNode>,
  reactiveState: Record<string, unknown>,
): void {
  for (const [slotName, slot] of Object.entries(slots)) {
    if (slot.onInput) {
      continue;
    }

    const slotNode = slotNodes.get(slotName);
    if (!slotNode || slotNode.type !== 'input') {
      continue;
    }

    slot.onInput = async (value: string) => {
      reactiveState[slotName] = value;
      return value;
    };
  }
}

/**
 * Invoke one declared input tuple with the next input value.
 */
async function invokeConfiguredInput(peagle: PeagleRuntime, tuple: NonNullable<UiNode['onInput']>, value: string): Promise<unknown> {
  return invokeRuntimeTuple(peagle, [tuple[0], tuple[1], [value], tuple[3] ?? {}]);
}

