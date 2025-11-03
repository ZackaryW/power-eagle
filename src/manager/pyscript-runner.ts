// Python script plugin execution and management

import { ExtensionInfo } from '../sdk/types';
import { BaseManager } from '../sdk/utils/logging';
import { PythonExecutionResult } from '../sdk/utils/py';
import { pythonScriptEvaler } from './pyscript-evaler';
import { rootListeners, EagleEventType } from '../sdk/root-listeners';

export class PythonScriptRunner extends BaseManager {
  private activePlugins: Map<string, HTMLElement> = new Map();
  private pluginCallbacks: Map<string, Set<() => void>> = new Map();

  constructor() {
    super('PythonScriptRunner');
  }

  /**
   * Clears all existing plugin content from the page
   * Removes plugin containers and hides main app
   */
  clearHomeContent(): void {
    // Remove all existing containers
    const existingContainers = document.querySelectorAll('[id^="pyscript-container-"]');
    existingContainers.forEach(container => {
      this.removeAllEventListeners(container);
      container.remove();
    });
    
    // Clear plugin buttons
    const pluginButtonsContainer = document.getElementById('plugin-buttons');
    if (pluginButtonsContainer) {
      this.removeAllEventListeners(pluginButtonsContainer);
      pluginButtonsContainer.innerHTML = '';
    }
    
    // Hide main app
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
    const pluginId = element.getAttribute('data-plugin-id') || 
                    element.id.replace('pyscript-container-', '') ||
                    element.id.replace('plugin-buttons-', '');
    
    if (pluginId && this.pluginCallbacks.has(pluginId)) {
      const callbacks = this.pluginCallbacks.get(pluginId)!;
      callbacks.forEach(cleanup => cleanup());
      callbacks.clear();
      this.pluginCallbacks.delete(pluginId);
    }
    
    // Clone element to remove all event listeners
    const newElement = element.cloneNode(true);
    if (element.parentNode) {
      element.parentNode.replaceChild(newElement, element);
    }
  }

  /**
   * Creates an isolated execution context for a Python script plugin
   * @param extension - Extension info for the plugin
   * @returns Promise<any> - Context object with APIs and output container
   */
  async createIsolatedContext(extension: ExtensionInfo): Promise<any> {
    // Import SDK context builder
    const { createPowerSDKContext } = await import('../sdk');
    
    // Create plugin container first
    const pluginContainer = this.createPluginContainer(extension.id);
    
    // Get python environment from manifest
    const pythonEnv = extension.manifest.pythonEnv || 'python';
    const scriptPath = extension.isBuiltin 
      ? `${extension.path}/main.py`  // For built-in examples
      : `${extension.path}/main.py`; // For installed plugins
    
    // Create execute callback for manual execution
    const executeCallback = async () => {
      try {
        const result = await pythonScriptEvaler.executeScriptWithCallbacks(scriptPath, {
          pythonEnv: pythonEnv,
          timeout: 600000 // 10 minute timeout
        });
        
        // We'll set up the output container reference later
        if (context.output) {
          this.handleExecutionResult(context, result);
        }
      } catch (error) {
        if (context.output) {
          context.output.error(`Manual execution failed: ${error}`);
        }
      }
    };
    
    // Create output container after plugin container is created
    const outputContainer = this.createOutputContainer(extension.id, executeCallback);
    
    // Create clean context with organized namespaces
    const context = {
      eagle: (window as any).eagle,
      powersdk: await createPowerSDKContext(
        this.createPluginStorage(extension.id),
        pluginContainer,
        extension.id,
        extension.manifest
      ),
      output: outputContainer
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
    const container = document.createElement('div');
    container.id = `pyscript-container-${pluginId}`;
    container.className = 'pyscript-container w-full h-screen p-8 flex flex-col';
    
    // Add to body
    document.body.appendChild(container);
    
    // Store container reference
    this.activePlugins.set(pluginId, container);
    
    return container;
  }

  /**
   * Creates an output container with selectable but non-modifiable textbox
   * @param pluginId - Plugin ID for output container identification
   * @param executeCallback - Callback function to execute the script manually
   * @returns object - Output container with display methods
   */
  private createOutputContainer(pluginId: string, executeCallback?: () => void): any {
    const container = this.activePlugins.get(pluginId);
    if (!container) {
      this.debugLog(`No container found for plugin: ${pluginId}`);
      return {};
    }

    // Create output section
    const outputSection = document.createElement('div');
    outputSection.className = 'output-section flex-1 flex flex-col mt-4';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'output-header flex items-center justify-between mb-2';
    header.innerHTML = `
      <h3 class="text-lg font-semibold">Python Script Output</h3>
      <div class="button-group flex gap-2">
        <button id="execute-${pluginId}" class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
          Execute
        </button>
        <button id="clear-output-${pluginId}" class="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600">
          Clear
        </button>
      </div>
    `;
    
    // Create output textbox (selectable but not editable)
    const outputTextbox = document.createElement('textarea');
    outputTextbox.id = `output-${pluginId}`;
    outputTextbox.className = 'output-textbox flex-1 p-4 border rounded font-mono text-sm bg-gray-900 text-green-400 resize-none';
    outputTextbox.readOnly = true;
    outputTextbox.placeholder = 'Python script output will appear here...';
    
    // Add elements to container
    outputSection.appendChild(header);
    outputSection.appendChild(outputTextbox);
    container.appendChild(outputSection);
    
    // Add execute functionality
    const executeButton = header.querySelector(`#execute-${pluginId}`) as HTMLButtonElement;
    if (executeCallback) {
      executeButton.addEventListener('click', executeCallback);
    }
    
    // Add clear functionality
    const clearButton = header.querySelector(`#clear-output-${pluginId}`) as HTMLButtonElement;
    clearButton.addEventListener('click', () => {
      outputTextbox.value = '';
    });

    return {
      log: (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        // Avoid repeated DOM reflows by batching updates
        outputTextbox.value += `[${timestamp}] ${message}\n`;
        // Use requestAnimationFrame to batch scroll updates
        requestAnimationFrame(() => {
          outputTextbox.scrollTop = outputTextbox.scrollHeight;
        });
      },
      error: (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        outputTextbox.value += `[${timestamp}] ERROR: ${message}\n`;
        requestAnimationFrame(() => {
          outputTextbox.scrollTop = outputTextbox.scrollHeight;
        });
      },
      clear: () => {
        outputTextbox.value = '';
      },
      append: (text: string) => {
        outputTextbox.value += text;
        requestAnimationFrame(() => {
          outputTextbox.scrollTop = outputTextbox.scrollHeight;
        });
      }
    };
  }

  /**
   * Executes a Python script plugin and manages event listeners
   * @param extension - Extension info for the plugin
   * @param context - Isolated context object
   * @param scriptPath - Path to the Python script file
   */
  async executePythonScript(extension: ExtensionInfo, context: any, scriptPath: string): Promise<void> {
    try {
      this.debugLog(`Executing Python script plugin: ${extension.name}`);
      
      // Get python environment from manifest
      const pythonEnv = extension.manifest.pythonEnv || 'python';
      
      // Setup event listeners if specified in manifest
      if (extension.manifest.on && Array.isArray(extension.manifest.on)) {
        await this.setupEventListeners(extension, context, scriptPath, pythonEnv);
      }
      
      // Only auto-execute if onStart is specified in the manifest
      const hasOnStart = extension.manifest.on && 
                        Array.isArray(extension.manifest.on) && 
                        extension.manifest.on.includes('onStart');
      
      if (hasOnStart) {
        // Execute initial script
        context.output.log(`Auto-starting Python script: ${extension.name}`);
        
        const result = await pythonScriptEvaler.executeScriptWithCallbacks(scriptPath, {
          pythonEnv: pythonEnv,
          timeout: 30000 // 30 second timeout
        });
        
        this.handleExecutionResult(context, result);
      } else {
        // Just show ready message
        context.output.log(`Python script ready: ${extension.name}`);
        context.output.log(`Click 'Execute' button to run the script manually.`);
      }
      
    } catch (error) {
      this.debugLog(`Failed to execute Python script ${extension.name}:`, error);
      context.output.error(`Failed to execute script: ${error}`);
    }
  }

  /**
   * Sets up event listeners for Python script based on manifest configuration
   * @param extension - Extension info
   * @param context - Plugin context
   * @param scriptPath - Path to Python script
   * @param pythonEnv - Python environment command
   */
  private async setupEventListeners(
    extension: ExtensionInfo, 
    context: any, 
    scriptPath: string, 
    pythonEnv: string
  ): Promise<void> {
    const eventTypes = extension.manifest.on as EagleEventType[];
    const callbacks: (() => void)[] = [];
    
    eventTypes.forEach(eventType => {
      if (['itemChange', 'libraryChange', 'folderChange'].includes(eventType)) {
        const callback = (_data: any) => {
          context.output.log(`Event triggered: ${eventType}`);
          
          // Execute script again on event
          pythonScriptEvaler.executeScriptWithCallbacks(scriptPath, {
            pythonEnv: pythonEnv,
            timeout: 30000
          }).then(result => {
            this.handleExecutionResult(context, result);
          }).catch(error => {
            context.output.error(`Event execution failed: ${error}`);
          });
        };
        
        rootListeners.registerCallback(eventType, callback);
        callbacks.push(() => rootListeners.unregisterCallback(eventType, callback));
        
        this.debugLog(`Registered ${eventType} listener for plugin: ${extension.name}`);
        context.output.log(`Listening for ${eventType} events`);
      }
    });
    
    // Store cleanup callbacks
    if (callbacks.length > 0) {
      this.pluginCallbacks.set(extension.id, new Set(callbacks));
    }
    
    // Start polling to monitor Eagle state changes
    await rootListeners.startPolling(1000);
  }

  /**
   * Handles Python script execution results and displays output
   * @param context - Plugin context with output container
   * @param result - Python execution result
   */
  private handleExecutionResult(context: any, result: PythonExecutionResult): void {
    if (result.stdout) {
      context.output.append(result.stdout + '\n');
    }
    
    if (result.stderr) {
      context.output.error(result.stderr);
    }
    
    const statusMessage = result.code === 0 ? 'Script completed successfully' : `Script exited with code ${result.code}`;
    context.output.log(statusMessage);
    
    this.debugLog(`Python script execution completed with code: ${result.code}`);
  }
}
