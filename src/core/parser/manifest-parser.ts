import type { V2PluginManifest } from '../types/plugin';

/**
 * Normalize one plugin.json manifest-like object into the supported package manifest shape.
 */
export function parseManifestRecord(rawManifest: Partial<V2PluginManifest>): V2PluginManifest {
  return {
    id: requireString(rawManifest.id, 'manifest.id'),
    name: requireString(rawManifest.name, 'manifest.name'),
    version: requireString(rawManifest.version, 'manifest.version'),
    stateVersion: typeof rawManifest.stateVersion === 'number' ? rawManifest.stateVersion : 1,
    type: requireString(rawManifest.type, 'manifest.type'),
    keywords: Array.isArray(rawManifest.keywords) ? rawManifest.keywords.map((value) => String(value)) : undefined,
    description: typeof rawManifest.description === 'string' ? rawManifest.description : undefined,
  };
}

/**
 * Require one manifest field to be a string.
 */
function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value;
}