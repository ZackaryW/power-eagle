// Plugin management utilities for Power Eagle SDK

import { PluginManifest, PluginAPI, HostEagleAPI } from './types';
import { ButtonManager } from './visual/button';

export class PluginManager {
  private plugins: Map<string, PluginManifest> = new Map();
  private buttonManager: ButtonManager;
  private hostEagleApi: HostEagleAPI;

  constructor(hostEagleApi: HostEagleAPI) {
    this.hostEagleApi = hostEagleApi;
    this.buttonManager = new ButtonManager();
  }

  async loadPlugin(manifest: PluginManifest, pluginFunction: Function): Promise<void> {
    try {
      this.plugins.set(manifest.id, manifest);

      // Create plugin API
      const pluginAPI: PluginAPI = {
        registerButton: (config) => {
          this.buttonManager.registerButton({
            ...config,
            id: `${manifest.id}-${config.id}`,
          });
        },
      };

      // Execute the plugin function with the host-provided Eagle runtime.
      // This is distinct from the SDK webapi HTTP client.
      // %ZMEM:8f31% function_change #sdk #api #identity "PluginManager now forwards the injected host Eagle runtime explicitly so plugin execution does not imply equivalence with the webapi client." %ZMEM%
      pluginFunction(pluginAPI, this.hostEagleApi);

      console.log(`Plugin ${manifest.name} loaded successfully`);
    } catch (error) {
      console.error(`Failed to load plugin ${manifest.name}:`, error);
      throw error;
    }
  }

  unloadPlugin(pluginId: string): void {
    this.plugins.delete(pluginId);
    console.log(`Plugin ${pluginId} unloaded`);
  }

  getLoadedPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values());
  }
}
