import type { RegistryEntry } from '../types/plugin';

/**
 * Create a flat local registry from statically imported browser modules.
 */
export function createBrowserRegistry(modules: Record<string, Record<string, unknown>>): Map<string, RegistryEntry> {
  const registry = new Map<string, RegistryEntry>();

  for (const [key, moduleRecord] of Object.entries(modules)) {
    registry.set(key, {
      key,
      modulePath: `browser:${key}`,
      exportedDefault: moduleRecord.default,
    });
  }

  return registry;
}