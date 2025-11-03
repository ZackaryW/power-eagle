// Plugin discovery and scanning functionality

import { ExtensionInfo } from '../sdk/types';
import { getExtensionsPath } from '../sdk/utils/paths';
import { BUILT_IN_PLUGINS, DEFAULT_PLUGIN_TYPE } from '../sdk/utils/constants';
import { PluginDownload } from './plugin-download';

// Use require for Node.js modules in Eagle environment
const fs = require('fs');
const path = require('path');

export class PluginDiscovery {
  private extensionsPath: Promise<string>;
  private pluginDownload: PluginDownload;

  constructor() {
    this.extensionsPath = getExtensionsPath();
    this.pluginDownload = new PluginDownload();
  }

  /**
   * Gets display name for a plugin ID
   * @param pluginId - Plugin ID
   * @returns string - Display name
   */
  private getPluginDisplayName(pluginId: string): string {
    const nameMap: Record<string, string> = {
      'example-plugin': 'Example Plugin',
      'recent-libraries': 'Recent Libraries',
      'file-creator': 'File Creator'
    };
    return nameMap[pluginId] || pluginId;
  }

  /**
   * Gets description for a plugin ID
   * @param pluginId - Plugin ID
   * @returns string - Plugin description
   */
  private getPluginDescription(pluginId: string): string {
    const descriptionMap: Record<string, string> = {
      'example-plugin': 'Demonstrates SDK features with Eagle API, CardManager, and Storage examples',
      'recent-libraries': 'Manage and switch between your recent Eagle libraries with search and filtering',
      'file-creator': 'Create files with custom extensions and manage file creation templates'
    };
    return descriptionMap[pluginId] || 'No description available';
  }

  /**
   * Discovers all available plugins (built-in examples and installed plugins)
   * @returns Promise<ExtensionInfo[]> - Array of discovered plugin information
   */
  async discoverExtensions(): Promise<ExtensionInfo[]> {
    // Discover built-in example plugins and installed extensions
    const extensions: ExtensionInfo[] = [];
    
    // Add built-in example plugins using constants
    const examplePlugins = BUILT_IN_PLUGINS.map(pluginId => ({
      id: pluginId,
      name: this.getPluginDisplayName(pluginId),
      description: this.getPluginDescription(pluginId),
      type: 'standard', // Built-in plugins are standard type
      manifest: {
        id: pluginId,
        name: this.getPluginDisplayName(pluginId),
        description: this.getPluginDescription(pluginId),
        type: 'standard',
      },
    }));

    // Add built-in plugins
    for (const plugin of examplePlugins) {
      extensions.push({
        ...plugin,
        path: `src/sdk/examples/${plugin.id}`, // File system path for examples
        isBuiltin: true,
      });
    }

    // Scan for installed plugins in ~user/.powereagle/extensions/{name}
    try {
      const installedPlugins = await this.scanInstalledPlugins();
      extensions.push(...installedPlugins);
    } catch (error) {
      console.error('Failed to scan installed plugins:', error);
    }

    return extensions;
  }

  /**
   * Scans the user's extensions directory for installed plugins
   * @returns Promise<ExtensionInfo[]> - Array of installed plugin information
   */
  private async scanInstalledPlugins(): Promise<ExtensionInfo[]> {
    const installedPlugins: ExtensionInfo[] = [];
    
    try {
      // Get the extensions directory path
      const extensionsDir = await this.extensionsPath;
      
      // Check if extensions directory exists (async)
      try {
        await fs.promises.access(extensionsDir);
      } catch {
        console.log(`Extensions directory does not exist: ${extensionsDir}`);
        return installedPlugins;
      }

      // Read the extensions directory (async)
      const entries = await fs.promises.readdir(extensionsDir, { withFileTypes: true });
      
      // Filter for directories and symbolic links (to support symlinked plugins)
      const pluginDirs = entries.filter((entry: { isDirectory: () => any; isSymbolicLink: () => any; }) => 
        entry.isDirectory() || entry.isSymbolicLink());
      
      // Process plugins in parallel for better performance
      const pluginPromises = pluginDirs.map(async (pluginDir) => {
        try {
          const pluginPath = path.join(extensionsDir, pluginDir.name);
          const manifestPath = path.join(pluginPath, 'plugin.json');
          
          // Check if plugin.json exists (async)
          try {
            await fs.promises.access(manifestPath);
          } catch {
            console.warn(`No plugin.json found in ${pluginDir.name}`);
            return null;
          }
          
          // Read plugin.json (async)
          const manifestContent = await fs.promises.readFile(manifestPath, 'utf8');
          const manifest = JSON.parse(manifestContent);
          
          // Validate manifest has required fields
          if (manifest.id && manifest.name) {
            console.log(`Found installed plugin: ${manifest.name} (${manifest.id})`);
            return {
              id: manifest.id,
              name: manifest.name,
              description: manifest.description,
              type: manifest.type || 'standard', // Default to standard if no type specified
              path: pluginPath,
              manifest,
              isBuiltin: false,
            };
          } else {
            console.warn(`Invalid manifest in ${pluginPath}: missing id or name`);
            return null;
          }
        } catch (error) {
          console.warn(`Failed to load plugin from ${pluginDir.name}:`, error);
          return null;
        }
      });

      // Wait for all plugin loads to complete in parallel
      const results = await Promise.all(pluginPromises);
      
      // Filter out null results and add to installedPlugins
      for (const result of results) {
        if (result !== null) {
          installedPlugins.push(result);
        }
      }
    } catch (error) {
      console.error('Failed to scan extensions directory:', error);
    }
    
    return installedPlugins;
  }

  /**
   * Downloads a plugin from a URL using the real download system
   * @param url - URL to download the plugin from
   * @returns Promise<ExtensionInfo> - Downloaded plugin information
   */
  async downloadExtension(url: string): Promise<ExtensionInfo> {
    try {
      console.log(`Downloading extension from: ${url}`);
      
      // Use the real download system
      const success = await this.pluginDownload.downloadPlugin(url, (window as any).eagle, () => {
        // This callback will be called after successful download to trigger rescan
        // We don't need to do anything here as the caller will handle rescanning
      });
      
      if (!success) {
        throw new Error('Download failed');
      }
      
      console.log(`Extension downloaded successfully`);
      
      // After successful download, we need to find the newly installed plugin
      // by rescanning the extensions directory
      const installedPlugins = await this.scanInstalledPlugins();
      
      // Find the most recently installed plugin (this is a heuristic)
      // In a more robust implementation, we could track which plugin was just added
      if (installedPlugins.length > 0) {
        // Return the first installed plugin we find
        // The real implementation should track which plugin was just downloaded
        const newPlugin = installedPlugins[installedPlugins.length - 1];
        return newPlugin;
      }
      
      // Fallback: create a basic extension info if we can't find the downloaded plugin
      const extensionsDir = await this.extensionsPath;
      const fallbackExtension: ExtensionInfo = {
        id: 'unknown-plugin',
        name: 'Unknown Plugin',
        description: 'A plugin that was downloaded but could not be properly identified',
        type: 'standard',
        path: `${extensionsDir}/unknown-plugin`,
        manifest: {
          id: 'unknown-plugin',
          name: 'Unknown Plugin',
          description: 'A plugin that was downloaded but could not be properly identified',
          type: 'standard',
        },
        isBuiltin: false,
      };
      
      return fallbackExtension;
    } catch (error) {
      console.error(`Failed to download extension from ${url}:`, error);
      throw error;
    }
  }
}
