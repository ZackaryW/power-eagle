// Plugin execution and isolation functionality

import { ExtensionInfo } from '../sdk/types';
import { BaseManager } from '../sdk/utils/logging';

export class PluginExecutor extends BaseManager {
  private activePluginContainers: Map<string, HTMLElement> = new Map();
  private pluginEventListeners: Map<string, Set<() => void>> = new Map();

  constructor() {
    super('PluginExecutor');
  }

  /**
   * Clears all existing plugin content from the page
   * Removes plugin containers, buttons, and hides main app
   */
  clearHomeContent(): void {
    // Remove all existing content from the page
    const existingContainers = document.querySelectorAll('[id^="plugin-container-"]');
    existingContainers.forEach(container => {
      // Remove all event listeners before removing DOM
      this.removeAllEventListeners(container);
      container.remove();
    });
    
    // Clear any existing plugin buttons
    const pluginButtonsContainer = document.getElementById('plugin-buttons');
    if (pluginButtonsContainer) {
      this.removeAllEventListeners(pluginButtonsContainer);
      pluginButtonsContainer.innerHTML = '';
    }
    
    // Hide the main app content
    const mainApp = document.querySelector('[data-theme]');
    if (mainApp) {
      (mainApp as HTMLElement).style.display = 'none';
    }
  }

  /**
   * Removes all event listeners from an element and cleans up tracked listeners
   * @param element - DOM element to clean up
   */
  private removeAllEventListeners(element: Element): void {
    // Clean up stored event listeners
    const pluginId = element.getAttribute('data-plugin-id') || 
                    element.id.replace('plugin-container-', '') ||
                    element.id.replace('plugin-buttons-', '');
    
    if (pluginId && this.pluginEventListeners.has(pluginId)) {
      const listeners = this.pluginEventListeners.get(pluginId)!;
      listeners.forEach(cleanup => cleanup());
      listeners.clear();
      this.pluginEventListeners.delete(pluginId);
    }
    
    // Clone the element to remove all event listeners
    const newElement = element.cloneNode(true);
    if (element.parentNode) {
      element.parentNode.replaceChild(newElement, element);
    }
  }

  /**
   * Creates an isolated execution context for a plugin with SDK components
   * @param extension - Extension info for the plugin
   * @returns Promise<any> - Isolated context object with APIs and SDK components
   */
  async createIsolatedContext(extension: ExtensionInfo): Promise<any> {
    // Import SDK context builder
    const { createPowerSDKContext } = await import('../sdk');
    
    // Create clean context with organized namespaces
    const context = {
      eagle: (window as any).eagle,
      powersdk: await createPowerSDKContext(
        this.createPluginStorage(extension.id),
        this.createPluginContainer(extension.id),
        extension.id,
        extension.manifest
      )
    };
    
    return context;
  }

  /**
   * Creates plugin-specific storage with prefixed keys
   * @param pluginId - Plugin ID for storage prefixing
   * @returns any - Storage object with get/set/remove methods
   */
  private createPluginStorage(pluginId: string): any {
    return {
      get: (key: string) => {
        const fullKey = `${pluginId}_${key}`;
        const value = localStorage.getItem(fullKey);
        return value ? JSON.parse(value) : null;
      },
      set: (key: string, value: any) => {
        const fullKey = `${pluginId}_${key}`;
        localStorage.setItem(fullKey, JSON.stringify(value));
      },
      remove: (key: string) => {
        const fullKey = `${pluginId}_${key}`;
        localStorage.removeItem(fullKey);
      }
    };
  }

  /**
   * Creates an isolated DOM container for a plugin
   * @param pluginId - Plugin ID for container identification
   * @returns HTMLElement - Plugin container element
   */
  private createPluginContainer(pluginId: string): HTMLElement {
    // Create isolated DOM container for plugin
    const container = document.createElement('div');
    container.id = `plugin-container-${pluginId}`;
    container.className = 'plugin-container w-full h-screen p-8';
    
    // Add to body (replacing home content)
    document.body.appendChild(container);
    
    // Store container reference for cleanup
    this.activePluginContainers.set(pluginId, container);
    
    return container;
  }

  /**
   * Executes plugin code in an isolated context using Function constructor
   * @param extension - Extension info for the plugin
   * @param context - Isolated context object with APIs and SDK components
   * @param pluginCode - Plugin code as executable string
   */
  async executePluginInIsolation(extension: ExtensionInfo, context: any, pluginCode: string): Promise<void> {
    try {
      this.debugLog(`Executing plugin in isolation: ${extension.name}`);
      this.debugLog(`Loaded plugin code for ${extension.name}, length: ${pluginCode.length} characters`);
      this.debugLog(`Plugin code preview:`, pluginCode.substring(0, 200) + '...');
      
      // Execute in isolated context
      const pluginFunction = new Function('context', `
        // Plugin code for ${extension.name}
        ${pluginCode}
      `);
      
      this.debugLog(`Executing plugin function with context:`, {
        hasEagle: !!context.eagle,
        hasPowerSDK: !!context.powersdk,
        hasStorage: !!context.powersdk?.storage,
        hasContainer: !!context.powersdk?.container,
        hasCardManager: !!context.powersdk?.CardManager,
        pluginId: context.powersdk?.pluginId
      });
      
      // Execute with context object (await if async)
      const result = pluginFunction(context);
      if (result instanceof Promise) {
        await result;
      }
      
      this.debugLog(`Plugin execution completed for: ${extension.name}`);
      
    } catch (error) {
      this.debugLog(`Failed to execute plugin ${extension.name}:`, error);
    }
  }

}
