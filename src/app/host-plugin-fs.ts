import type { PluginFileSystem } from '../core/types/plugin';

type RuntimeRequire = ((moduleName: string) => unknown) | null;

interface RuntimeFs {
  existsSync(targetPath: string): boolean;
  readdirSync(targetPath: string): string[];
  readFileSync(targetPath: string, encoding: string): string;
  statSync(targetPath: string): { isDirectory(): boolean };
}

interface RuntimePath {
  join(...pathSegments: string[]): string;
}

interface RuntimeUrl {
  pathToFileURL(targetPath: string): { href: string };
}

/**
 * Implement plugin package filesystem access through the host runtime require bridge.
 */
export class HostRuntimePluginFileSystem implements PluginFileSystem {
  /**
   * Check whether a file path exists.
   */
  async exists(filePath: string): Promise<boolean> {
    const fs = getRuntimeFs();
    return Boolean(fs?.existsSync(filePath));
  }

  /**
   * List all files beneath a plugin root recursively.
   */
  async listFiles(rootDir: string): Promise<string[]> {
    const fs = getRuntimeFs();
    const pathModule = getRuntimePath();
    if (!fs || !pathModule || !fs.existsSync(rootDir)) {
      return [];
    }

    const discovered: string[] = [];
    walkDirectory(fs, pathModule, rootDir, discovered);
    return discovered;
  }

  /**
   * Read a UTF-8 text file from disk.
   */
  async readText(filePath: string): Promise<string> {
    const fs = getRuntimeFs();
    if (!fs) {
      throw new Error('Host runtime fs is unavailable.');
    }

    return fs.readFileSync(filePath, 'utf8');
  }

  /**
   * Import a native ESM module from a local file path.
   */
  async importModule(modulePath: string): Promise<Record<string, unknown>> {
    const urlModule = getRuntimeUrl();
    if (!urlModule) {
      throw new Error('Host runtime url helpers are unavailable.');
    }

    return import(urlModule.pathToFileURL(modulePath).href);
  }
}

/**
 * Walk one directory recursively and accumulate file paths.
 */
function walkDirectory(fs: RuntimeFs, pathModule: RuntimePath, currentDir: string, discovered: string[]): void {
  for (const entryName of fs.readdirSync(currentDir)) {
    const entryPath = pathModule.join(currentDir, entryName);
    if (fs.statSync(entryPath).isDirectory()) {
      walkDirectory(fs, pathModule, entryPath, discovered);
      continue;
    }

    discovered.push(entryPath);
  }
}

/**
 * Resolve runtime require when the host exposes CommonJS access.
 */
function getRuntimeRequire(): RuntimeRequire {
  const globalWindow = typeof window !== 'undefined' ? window as unknown as { require?: (moduleName: string) => unknown } : null;
  if (globalWindow?.require) {
    return globalWindow.require;
  }

  try {
    return Function('return typeof require !== "undefined" ? require : null')() as RuntimeRequire;
  } catch {
    return null;
  }
}

/**
 * Resolve the runtime fs module through host APIs.
 */
function getRuntimeFs(): RuntimeFs | null {
  const runtimeRequire = getRuntimeRequire();
  if (!runtimeRequire) {
    return null;
  }

  try {
    return runtimeRequire('fs') as RuntimeFs;
  } catch {
    return null;
  }
}

/**
 * Resolve the runtime path module through host APIs.
 */
function getRuntimePath(): RuntimePath | null {
  const runtimeRequire = getRuntimeRequire();
  if (!runtimeRequire) {
    return null;
  }

  try {
    return runtimeRequire('path') as RuntimePath;
  } catch {
    return null;
  }
}

/**
 * Resolve the runtime url module through host APIs.
 */
function getRuntimeUrl(): RuntimeUrl | null {
  const runtimeRequire = getRuntimeRequire();
  if (!runtimeRequire) {
    return null;
  }

  try {
    return runtimeRequire('url') as RuntimeUrl;
  } catch {
    return null;
  }
}