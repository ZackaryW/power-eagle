import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PluginFileSystem } from '../types/plugin';

/**
 * Implement plugin package filesystem access against the local Node runtime.
 */
export class NodePluginFileSystem implements PluginFileSystem {
  /**
   * Check whether a file path exists.
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all files beneath a plugin root recursively.
   */
  async listFiles(rootDir: string): Promise<string[]> {
    const discovered: string[] = [];
    await this.walk(rootDir, discovered);
    return discovered;
  }

  /**
   * Read a UTF-8 text file from disk.
   */
  async readText(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf8');
  }

  /**
   * Import a native ESM module from a local file path.
   */
  async importModule(modulePath: string): Promise<Record<string, unknown>> {
    return import(pathToFileURL(modulePath).href);
  }

  /**
   * Walk one directory recursively and accumulate file paths.
   */
  private async walk(currentDir: string, discovered: string[]): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await this.walk(entryPath, discovered);
      } else {
        discovered.push(entryPath);
      }
    }
  }
}