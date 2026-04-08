import { createPeagleRuntime } from './peagle-runtime';
import { invokeRuntimeTuple } from './invoke-runtime-tuple';
import { createSlotNodeMap, createSlotRegistry } from './slot-registry';
import type { ActivatedPlugin, HostEagleRuntime, ParsedPluginPackage, RegistryEntry } from '../types/plugin';

/**
 * Activate an already parsed plugin package with a prepared local registry.
 */
export async function activateLoadedPlugin(
  parsed: ParsedPluginPackage,
  registry: Map<string, RegistryEntry>,
  hostEagle: HostEagleRuntime,
): Promise<ActivatedPlugin> {
  const slots = createSlotRegistry(parsed.ui);
  const slotNodes = createSlotNodeMap(parsed.ui);
  const peagle = createPeagleRuntime({
    hostEagle,
    registry,
    slots,
    slotNodes,
    templates: parsed.templates,
    initialState: parsed.initialState,
    stateSlots: parsed.stateSlots,
  });

  for (const onMountTuple of parsed.lifecycle.onMount ?? []) {
    await invokeRuntimeTuple(peagle, onMountTuple);
  }

  return {
    parsed,
    slots,
    registry,
    peagle,
  };
}