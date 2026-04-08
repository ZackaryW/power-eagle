// Plugin code loading functionality

import { ExtensionInfo } from '../sdk/types';
import { BaseManager } from '../sdk/utils/logging';
import { BUILT_IN_PLUGINS } from '../sdk/utils/constants';

export class PluginLoader extends BaseManager {
  constructor() {
    super('PluginLoader');
  }

  /**
   * Loads plugin code from a file path using Eagle's file system API
   * @param filePath - Path to the plugin file to load
   * @returns Promise<string> - The plugin code as a string
   */
  async loadPluginFile(filePath: string): Promise<string> {
    try {
      // Use Eagle's file system API to read the file
      const eagle = (window as any).eagle;
      
      if (eagle?.fs?.readFile) {
        // Use Eagle's file system API
        const fileContent = await eagle.fs.readFile(filePath, 'utf8');
        return fileContent;
      } else {
        // Use Node.js fs promises API for non-blocking I/O
        const fs = require('fs');
        // %ZMEM:29af% function_change #performance #io #loader "loadPluginFile now uses fs.promises.readFile on the Node fallback path so plugin source loading avoids blocking synchronous filesystem reads." %ZMEM%
        const fileContent = await fs.promises.readFile(filePath, 'utf8');
        return fileContent;
      }
      
    } catch (error) {
      console.error(`Failed to load plugin file ${filePath}:`, error);
      
      // Return fallback code if file loading fails
      return `
        console.log('Plugin file loading failed, using fallback code');
        console.log('Attempted to load from: ${filePath}');
        
        // Fallback plugin functionality
        if (typeof api !== 'undefined' && typeof eagle !== 'undefined') {
          api.registerButton({
            id: 'fallback-action',
            text: 'Fallback Action',
            onClick: () => {
              eagle.notification.show({
                title: 'Fallback Plugin',
                description: 'Using fallback code due to file loading error'
              });
            }
          });
        }
      `;
    }
  }

  /**
   * Loads built-in example plugin code by importing from TSX files
   * @param pluginId - ID of the example plugin to load
   * @returns Promise<string> - The plugin code as executable string
   */
  async loadExamplePlugin(pluginId: string): Promise<string> {
    // Import the plugin function and return it as executable code
    switch (pluginId) {
      case 'recent-libraries':
        const { plugin } = await import('../examples/recent-libraries');
        return `
          const plugin = ${plugin.toString()};
          plugin(context);
        `;
        
      case 'example-plugin':
        const { plugin: examplePlugin } = await import('../examples/basic-plugin');
        return `
          const plugin = ${examplePlugin.toString()};
          plugin(context);
        `;
      case 'file-creator':
        const { plugin: fileCreatorPlugin } = await import('../examples/file-creator');
        return `
          const plugin = ${fileCreatorPlugin.toString()};
          plugin(context);
        `;
      default:
        throw new Error(`Unknown plugin: ${pluginId}`);
    }
  }

  /**
   * Gets plugin code for an extension, handling both built-in and installed plugins
   * @param extension - Extension info containing plugin metadata
   * @returns Promise<string> - The plugin code as executable string
   */
  async getPluginCode(extension: ExtensionInfo): Promise<string> {
    try {
      this.debugLog(`Getting plugin code for: ${extension.id} (builtin: ${extension.isBuiltin})`);
      
      // For built-in examples, import them as assets
      if (extension.isBuiltin || this.isExamplePlugin(extension.id)) {
        this.debugLog(`Loading built-in example plugin: ${extension.id}`);
        return await this.loadExamplePlugin(extension.id);
      }
      
      // For installed plugins, read from the extension path and wrap it
      const pluginPath = `${extension.path}/main.js`;
      this.debugLog(`Loading installed plugin from path: ${pluginPath}`);
      const pluginCode = await this.loadPluginFile(pluginPath);
      
      // Wrap the plugin code to ensure it executes properly
      return `
        // Plugin code for ${extension.name}
        ${pluginCode}
        
        // Execute the plugin function if it exists
        if (typeof plugin === 'function') {
          plugin(context);
        } else {
          console.error('Plugin function not found in ${extension.name}');
        }
      `;
    } catch (error) {
      this.debugLog(`Failed to load plugin code for ${extension.id}:`, error);
      return this.getDefaultPluginCode(extension);
    }
  }

  /**
   * Checks if a plugin ID corresponds to a built-in example plugin
   * @param pluginId - Plugin ID to check
   * @returns boolean - True if it's an example plugin
   */
  private isExamplePlugin(pluginId: string): boolean {
    return BUILT_IN_PLUGINS.includes(pluginId as any);
  }

  /**
   * Generates fallback plugin code when loading fails
   * @param extension - Extension info for the plugin
   * @returns string - Default plugin code as executable string
   */
  private getDefaultPluginCode(extension: ExtensionInfo): string {
    return `
      console.log('Plugin ${extension.name} executing in isolated context');
      
      api.registerButton({
        id: '${extension.id}-action',
        text: '${extension.name} Action',
        onClick: () => {
          eagle.notification.show({
            title: '${extension.name}',
            description: 'Action executed from isolated plugin context!'
          });
        }
      });
    `;
  }
}
