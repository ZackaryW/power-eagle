import type { PluginFileSystem, RegistryEntry } from '../types/plugin';
import { normalizeRelativePath } from '../parser/package-parser';

/**
 * Load all native ESM modules in a plugin package into the flat local registry.
 */
export async function loadLocalRegistry(rootDir: string, modulePaths: string[], fileSystem: PluginFileSystem): Promise<Map<string, RegistryEntry>> {
  const registry = new Map<string, RegistryEntry>();

  for (const modulePath of modulePaths) {
    const importedModule = await fileSystem.importModule(modulePath);
    const key = normalizeRelativePath(rootDir, modulePath).replace(/\.js$/u, '');
    registry.set(key, {
      key,
      modulePath,
      exportedDefault: importedModule.default,
    });
  }

  return registry;
}