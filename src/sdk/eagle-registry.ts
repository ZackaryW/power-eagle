import EagleWebApi from './webapi';
import type { EagleCallable, EagleInvocationRegistry, HostEagleRuntime } from './types';

const HOST_NAMESPACES = [
  'app',
  'window',
  'os',
  'screen',
  'notification',
  'event',
  'item',
  'folder',
  'smartFolder',
  'contextMenu',
  'dialog',
  'clipboard',
  'drag',
  'shell',
  'log',
  'library',
  'tag',
  'tagGroup',
] as const;

/**
 * Create the plugin-facing Eagle invocation registry from host runtime methods.
 */
export function createPluginEagleInvocationRegistry(hostEagle: HostEagleRuntime): EagleInvocationRegistry {
  const registry: EagleInvocationRegistry = new Map();

  for (const namespace of HOST_NAMESPACES) {
    const source = hostEagle[namespace];
    if (isRecord(source)) {
      registerNestedMethods(registry, namespace, source);
    }
  }

  return registry;
}

/**
 * Create the web-facing Eagle invocation registry from SDK and synthetic wrappers.
 */
export function createWebEagleInvocationRegistry(hostEagle: HostEagleRuntime): EagleInvocationRegistry {
  const registry: EagleInvocationRegistry = new Map();
  registerWebApiFallbacks(registry);
  registerSdkAugments(registry, hostEagle);
  return registry;
}

/**
 * Create the utility-facing Eagle invocation registry for higher-level host helpers.
 */
export function createUtilityEagleInvocationRegistry(hostEagle: HostEagleRuntime): EagleInvocationRegistry {
  const registry: EagleInvocationRegistry = new Map();
  registry.set('getRecentLibraries', async () => readRecentLibraries(hostEagle));
  registry.set('writeTextFile', async (filePath: unknown, content: unknown) => writeTextFile(String(filePath), String(content ?? '')));
  return registry;
}

/**
 * Invoke one path against the registry.
 */
export async function invokeEaglePath(
  registry: EagleInvocationRegistry,
  key: string,
  args: unknown[],
  kwargs: Record<string, unknown>,
): Promise<unknown> {
  const callable = registry.get(key);
  if (!callable) {
    throw new Error(`Eagle path is not registered: ${key}`);
  }

  return callable(...args, kwargs);
}

/**
 * Recursively register callable methods from one host namespace object.
 */
function registerNestedMethods(registry: EagleInvocationRegistry, prefix: string, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const nextPath = `${prefix}.${key}`;
    if (typeof value === 'function') {
      registry.set(nextPath, (value as EagleCallable).bind(source));
      continue;
    }

    if (isRecord(value)) {
      registerNestedMethods(registry, nextPath, value);
    }
  }
}

/**
 * Register the legacy webapi methods that are part of the previous SDK surface.
 */
function registerWebApiFallbacks(registry: EagleInvocationRegistry): void {
  registerStaticClassMethods(registry, 'application', EagleWebApi.application as unknown as Record<string, unknown>);
  registerStaticClassMethods(registry, 'folder', EagleWebApi.folder as unknown as Record<string, unknown>);
  registerStaticClassMethods(registry, 'library', EagleWebApi.library as unknown as Record<string, unknown>);
  registerStaticClassMethods(registry, 'item', EagleWebApi.item as unknown as Record<string, unknown>);
}

/**
 * Register additional high-level SDK helpers that do not exist directly on the host object.
 */
function registerSdkAugments(registry: EagleInvocationRegistry, hostEagle: HostEagleRuntime): void {
  registry.set('library.switch', (libraryPath: unknown) => EagleWebApi.library.switch(String(libraryPath)));

  registry.set('item.addTags', async (items: unknown, kwargs: Record<string, unknown> = {}) => {
    const tagList = Array.isArray(kwargs?.tags) ? kwargs.tags.filter((tag): tag is string => typeof tag === 'string') : [];
    const itemList = Array.isArray(items) ? items : [];

    return Promise.all(itemList.map(async (item) => addTagsToItem(item, tagList, hostEagle)));
  });
}

/**
 * Register callable static methods from one class-like object under one namespace.
 */
function registerStaticClassMethods(registry: EagleInvocationRegistry, namespace: string, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'function' && !registry.has(`${namespace}.${key}`)) {
      registry.set(`${namespace}.${key}`, value as EagleCallable);
    }
  }
}

/**
 * Add tags to one item using the richest available surface.
 */
async function addTagsToItem(item: unknown, tagList: string[], hostEagle: HostEagleRuntime): Promise<unknown> {
  if (!isRecord(item)) {
    throw new Error('item.addTags expects Eagle item objects or item records with ids.');
  }

  if (Array.isArray(item.tags) && typeof item.save === 'function') {
    const mergedTags = Array.from(new Set([...item.tags.filter((tag): tag is string => typeof tag === 'string'), ...tagList]));
    item.tags = mergedTags;
    return (item.save as EagleCallable)();
  }

  if (typeof item.id === 'string') {
    return EagleWebApi.item.update({ itemId: item.id, tags: tagList });
  }

  if (hostEagle.log && typeof hostEagle.log.warn === 'function') {
    await (hostEagle.log.warn as EagleCallable)('item.addTags received an item without save() or id.');
  }

  throw new Error('item.addTags could not resolve a writable target item.');
}

/**
 * Check whether one unknown value is a plain record.
 */
function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read the Eagle recent library history from the host settings file.
 */
async function readRecentLibraries(hostEagle: HostEagleRuntime): Promise<string[]> {
  try {
    const appDataPath = await resolveAppDataPath(hostEagle);
    const settingsPath = `${trimTrailingSeparator(appDataPath)}/eagle/Settings`;
    const settingsText = await readTextFile(settingsPath);
    const settings = JSON.parse(settingsText) as { libraryHistory?: unknown };
    return Array.isArray(settings.libraryHistory)
      ? settings.libraryHistory.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch (error) {
    console.error('Failed to read recent libraries from Eagle settings:', error);
    return [];
  }
}

/**
 * Resolve the host application data directory using Eagle first and Node fallbacks second.
 */
async function resolveAppDataPath(hostEagle: HostEagleRuntime): Promise<string> {
  if (hostEagle.app && typeof hostEagle.app.getPath === 'function') {
    return String(await (hostEagle.app.getPath as EagleCallable)('appData'));
  }

  const runtimeProcess = await getRuntimeProcess();
  if (runtimeProcess?.env?.APPDATA) {
    return String(runtimeProcess.env.APPDATA);
  }

  if (runtimeProcess?.platform === 'darwin' && runtimeProcess?.env?.HOME) {
    return `${runtimeProcess.env.HOME}/Library/Application Support`;
  }

  if (runtimeProcess?.env?.HOME) {
    return `${runtimeProcess.env.HOME}/.local/share`;
  }

  throw new Error('Unable to resolve appData path for Eagle settings.');
}

/**
 * Read one UTF-8 text file using Node capabilities exposed by the runtime.
 */
async function readTextFile(filePath: string): Promise<string> {
  const runtimeRequire = getRuntimeRequire();
  if (!runtimeRequire) {
    throw new Error('The Eagle utility registry requires a runtime file system bridge.');
  }

  const fs = runtimeRequire('fs') as { promises: { readFile(path: string, encoding: string): Promise<string> } };
  return fs.promises.readFile(filePath, 'utf8');
}

/**
 * Write one UTF-8 text file using Node capabilities exposed by the runtime.
 */
async function writeTextFile(filePath: string, content: string): Promise<void> {
  const runtimeRequire = getRuntimeRequire();
  if (!runtimeRequire) {
    throw new Error('The Eagle utility registry requires a runtime file system bridge.');
  }

  const fs = runtimeRequire('fs') as {
    promises: {
      mkdir(path: string, options: { recursive: boolean }): Promise<void>;
      writeFile(path: string, data: string, encoding: string): Promise<void>;
    };
  };
  const pathModule = runtimeRequire('path') as { dirname(path: string): string };
  await fs.promises.mkdir(pathModule.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, content, 'utf8');
}

/**
 * Get the Node process object when available in the current runtime.
 */
async function getRuntimeProcess(): Promise<{ env?: Record<string, string | undefined>; platform?: string } | null> {
  if (typeof process !== 'undefined') {
    return process as unknown as { env?: Record<string, string | undefined>; platform?: string };
  }

  const runtimeRequire = getRuntimeRequire();
  if (runtimeRequire) {
    return runtimeRequire('process') as { env?: Record<string, string | undefined>; platform?: string };
  }

  return null;
}

/**
 * Resolve runtime require when the host exposes CommonJS access.
 */
function getRuntimeRequire(): ((moduleName: string) => unknown) | null {
  const globalWindow = typeof window !== 'undefined' ? window as unknown as { require?: (moduleName: string) => unknown } : null;
  if (globalWindow?.require) {
    return globalWindow.require;
  }

  try {
    return Function('return typeof require !== "undefined" ? require : null')() as ((moduleName: string) => unknown) | null;
  } catch {
    return null;
  }
}

/**
 * Remove a trailing slash or backslash from one path string.
 */
function trimTrailingSeparator(targetPath: string): string {
  return targetPath.replace(/[\\/]+$/u, '');
}