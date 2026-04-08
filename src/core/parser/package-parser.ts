import { parseManifestRecord } from './manifest-parser';
import { parseRenderTemplate } from './template-parser';
import { parseUiDefinition } from './ui-parser';
import type { ParsedPluginPackage, PluginFileSystem, PluginLifecycleDefinition, PluginPackageDefinition, UiNode } from '../types/plugin';

/**
 * Parse a v2 plugin package directory according to the new folder contract.
 */
export async function parsePluginPackage(rootDir: string, fileSystem: PluginFileSystem): Promise<ParsedPluginPackage> {
  const folderName = getBaseName(rootDir);
  const pluginJsonPath = joinPath(rootDir, 'plugin.json');
  const allFiles = await fileSystem.listFiles(rootDir);
  const modulePaths = allFiles.filter((filePath) => filePath.endsWith('.js'));
  const templatePaths = allFiles.filter((filePath) => hasRenderSegment(filePath) && filePath.endsWith('.json'));
  const templates = await loadTemplates(rootDir, templatePaths, fileSystem);

  if (await fileSystem.exists(pluginJsonPath)) {
    const pluginJson = JSON.parse(await fileSystem.readText(pluginJsonPath)) as PluginPackageDefinition;
    if (isRecord(pluginJson.ui)) {
      const manifest = parseManifestRecord(pluginJson);

      return {
        rootDir,
        folderName,
        declaredType: manifest.type,
        manifest,
        ui: parseUiDefinition(pluginJson.ui as UiNode),
        templates,
        modulePaths: normalizePluginJsonModulePaths(rootDir, modulePaths),
        initialState: isRecord(pluginJson.state?.initial) ? { ...(pluginJson.state?.initial as Record<string, unknown>) } : {},
        stateSlots: isRecord(pluginJson.state?.slots) ? mapStringRecord(pluginJson.state?.slots as Record<string, unknown>) : {},
        lifecycle: normalizeLifecycle(pluginJson.lifecycle),
      };
    }

    throw new Error(`plugin.json in ${folderName} must contain a full package definition with a ui object.`);
  }

  throw new Error(`Missing plugin.json in ${folderName}.`);
}

/**
 * Load and parse all render templates for a plugin package.
 */
async function loadTemplates(rootDir: string, templatePaths: string[], fileSystem: PluginFileSystem): Promise<Record<string, Record<string, unknown>>> {
  const templates: Record<string, Record<string, unknown>> = {};
  for (const templatePath of templatePaths) {
    const relativePath = normalizeRelativePath(rootDir, templatePath).replace(/\.json$/u, '');
    templates[relativePath] = parseRenderTemplate(JSON.parse(await fileSystem.readText(templatePath)));
  }

  return templates;
}

/**
 * Normalize one file path relative to a plugin root using slash separators.
 */
export function normalizeRelativePath(rootDir: string, filePath: string): string {
  const normalizedRoot = trimTrailingSeparators(rootDir).replace(/\\/gu, '/');
  const normalizedFilePath = filePath.replace(/\\/gu, '/');
  if (!normalizedFilePath.startsWith(normalizedRoot)) {
    return normalizedFilePath;
  }

  return normalizedFilePath.slice(normalizedRoot.length).replace(/^\//u, '');
}

/**
 * Join path segments with forward slashes.
 */
function joinPath(basePath: string, childPath: string): string {
  return `${trimTrailingSeparators(basePath)}/${childPath}`;
}

/**
 * Read the final path segment from one absolute or virtual path.
 */
function getBaseName(targetPath: string): string {
  const normalizedPath = trimTrailingSeparators(targetPath).replace(/\\/gu, '/');
  const segments = normalizedPath.split('/');
  return segments[segments.length - 1] ?? normalizedPath;
}

/**
 * Check whether a file path lives under a render directory.
 */
function hasRenderSegment(filePath: string): boolean {
  return filePath.includes('/render/') || filePath.includes('\\render\\');
}

/**
 * Remove trailing path separators from a path string.
 */
function trimTrailingSeparators(targetPath: string): string {
  return targetPath.replace(/[\\/]+$/u, '');
}

/**
 * Normalize plugin lifecycle metadata from one parsed package object.
 */
function normalizeLifecycle(lifecycle: PluginLifecycleDefinition | undefined): PluginLifecycleDefinition {
  return {
    onMount: Array.isArray(lifecycle?.onMount) ? lifecycle.onMount : [],
  };
}

/**
 * Check whether an unknown value is a plain record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Keep only string values from one record-shaped mapping.
 */
function mapStringRecord(record: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

/**
 * Exclude legacy runtime-owner modules when plugin.json is the active package contract.
 */
function normalizePluginJsonModulePaths(rootDir: string, modulePaths: string[]): string[] {
  return modulePaths.filter((filePath) => {
    const relativePath = normalizeRelativePath(rootDir, filePath);
    return relativePath !== 'plugin.js' && relativePath !== 'state.js';
  });
}