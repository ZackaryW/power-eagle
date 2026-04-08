// Plugin management functionality (removal, hiding, etc.)

export class PluginManagement {
  /**
   * Removes an extension (hides built-in or deletes installed)
   * @param extensionId - ID of the extension to remove
   * @param extension - Extension info object
   */
  async removeExtension(extensionId: string, extension: any): Promise<void> {
    try {
      if (extension.isBuiltin) {
        // For built-in plugins, hide them using localStorage
        this.hideBuiltinPlugin(extensionId);
      } else {
        // For installed plugins, delete the folder
        await this.deletePluginFolder(extension.path);
      }
      
      console.log(`Extension ${extensionId} removed successfully`);
    } catch (error) {
      console.error(`Failed to remove extension ${extensionId}:`, error);
      throw error;
    }
  }

  /**
   * Hides a built-in plugin by storing its ID in localStorage
   * @param pluginId - Plugin ID to hide
   */
  private hideBuiltinPlugin(pluginId: string): void {
    // Store hidden state in localStorage
    const hiddenPlugins = this.getHiddenPlugins();
    if (!hiddenPlugins.includes(pluginId)) {
      hiddenPlugins.push(pluginId);
      localStorage.setItem('power-eagle-hidden-plugins', JSON.stringify(hiddenPlugins));
    }
  }

  /**
   * Gets list of hidden plugin IDs from localStorage
   * @returns string[] - Array of hidden plugin IDs
   */
  private getHiddenPlugins(): string[] {
    const hidden = localStorage.getItem('power-eagle-hidden-plugins');
    return hidden ? JSON.parse(hidden) : [];
  }

  /**
   * Deletes a plugin folder from the file system (currently mocked)
   * @param folderPath - Path to the plugin folder to delete
   */
  private async deletePluginFolder(folderPath: string): Promise<void> {
    const fs = require('fs').promises;
    await fs.rmdir(folderPath, { recursive: true });
  }

  /**
   * Checks if a plugin is currently hidden
   * @param pluginId - Plugin ID to check
   * @returns boolean - True if the plugin is hidden
   */
  isPluginHidden(pluginId: string): boolean {
    const hiddenPlugins = this.getHiddenPlugins();
    return hiddenPlugins.includes(pluginId);
  }

  /**
   * Restores all hidden built-in plugins by clearing localStorage
   */
  async showHiddenPlugins(): Promise<void> {
    // Restore all hidden built-in plugins
    localStorage.removeItem('power-eagle-hidden-plugins');
  }
}
