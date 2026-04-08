import { parsePluginPackage } from '../parser/package-parser';
import { loadLocalRegistry } from './module-registry';
import { activateLoadedPlugin } from './activate-loaded-plugin';
import type { ActivatedPlugin, HostEagleRuntime, PluginFileSystem } from '../types/plugin';

/**
 * Activate a parsed v2 plugin package against the peagle runtime.
 */
export async function activatePluginPackage(rootDir: string, fileSystem: PluginFileSystem, hostEagle: HostEagleRuntime): Promise<ActivatedPlugin> {
  const parsed = await parsePluginPackage(rootDir, fileSystem);
  const registry = await loadLocalRegistry(rootDir, parsed.modulePaths, fileSystem);
  return activateLoadedPlugin(parsed, registry, hostEagle);
}
