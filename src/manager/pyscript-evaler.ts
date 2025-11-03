// Python script callback evaluator - handles Eagle API callbacks from Python scripts

import { webapi } from '../sdk';
import { BaseManager } from '../sdk/utils/logging';
import { pythonExecutorV2, PythonExecutionOptions, PythonExecutionResult } from '../sdk/utils/pyv2';
import { asyncExecReadonly } from '../sdk/utils/coderunner';

// Methods that return values and cannot be implemented with the callback system
// These should be ignored when processing callbacks
const METHODS_WITH_RETURN_VALUES = new Set([
  // Tag methods
  'tag.get',
  'tag.get_recents',
  // TagGroup methods
  'tag_group.get',
  'tag_group.create',
  // Library methods
  'library.info',
  'library.get_name',
  'library.get_path',
  'library.get_modification_time',
  // Window methods
  'window.is_minimized',
  'window.is_maximized',
  'window.is_full_screen',
  'window.get_size',
  'window.get_bounds',
  'window.is_resizable',
  'window.is_always_on_top',
  'window.get_position',
  'window.get_opacity',
  // App methods
  'app.is_dark_colors',
  'app.get_path',
  'app.get_file_icon',
  'app.get_version',
  'app.get_build',
  'app.get_locale',
  'app.get_arch',
  'app.get_platform',
  'app.get_env',
  'app.get_exec_path',
  'app.get_pid',
  'app.is_windows',
  'app.is_mac',
  'app.is_running_under_arm64_translation',
  'app.get_theme',
  // OS methods
  'os.tmpdir',
  'os.version',
  'os.type',
  'os.release',
  'os.hostname',
  'os.homedir',
  'os.arch',
  // Screen methods
  'screen.get_cursor_screen_point',
  'screen.get_primary_display',
  'screen.get_all_displays',
  'screen.get_display_nearest_point',
  // Item methods
  'item.get',
  'item.get_all',
  'item.get_by_id',
  'item.get_by_ids',
  'item.get_selected',
  'item.add_from_url',
  'item.add_from_base64',
  'item.add_from_path',
  'item.add_bookmark',
  'item.open',
  // Folder methods
  'folder.create',
  'folder.create_subfolder',
  'folder.get',
  'folder.get_all',
  'folder.get_by_id',
  'folder.get_by_ids',
  'folder.get_selected',
  'folder.get_recents',
  // Dialog methods
  'dialog.show_open_dialog',
  'dialog.show_save_dialog',
  // Clipboard methods
  'clipboard.has',
  'clipboard.read_text',
  'clipboard.read_buffer',
  'clipboard.read_image',
  'clipboard.read_html',
]);

interface ParsedCallback {
  token: string;
  pluginId: string;
  method: string;
  args: Record<string, any>;
}

export class PythonScriptEvaler extends BaseManager {
  private pendingCallbacks: Map<string, ParsedCallback[]> = new Map();

  constructor() {
    super('PythonScriptEvaler');
  }

  /**
   * Executes Python script with callback evaluation support
   * @param scriptPath - Path to the Python script file
   * @param options - Execution options
   * @returns Promise<PythonExecutionResult> - Execution result
   */
  async executeScriptWithCallbacks(
    scriptPath: string,
    options: PythonExecutionOptions = {}
  ): Promise<PythonExecutionResult> {
    const pluginId = this.extractPluginIdFromPath(scriptPath);
    
    // Set up custom stderr handler to intercept callbacks
    const enhancedOptions: PythonExecutionOptions = {
      ...options,
      onStderr: async (data: string) => {
        // Filter stderr data to separate callback signals from regular stderr
        const filteredData = await this.handleStderrData(data, pluginId);
        
        // Only pass non-callback stderr to the original handler
        if (filteredData && options.onStderr) {
          options.onStderr(filteredData);
        }
      }
    };

    const result = await pythonExecutorV2.executeScript(scriptPath, enhancedOptions);
    
    // Filter callback signals from the final stderr result as well
    result.stderr = await this.filterCallbackSignalsFromStderr(result.stderr, pluginId);
    
    return result;
  }

  /**
   * Handles stderr data to detect and process callback signals
   * Filters out callback signals and returns remaining stderr data
   * @param data - Raw stderr data
   * @param pluginId - Plugin ID for context
   * @returns string - Filtered stderr data with callback signals removed
   */
  private async handleStderrData(data: string, pluginId: string): Promise<string> {
    const lines = data.split('\n');
    const filteredLines: string[] = [];
    
    // Get token once for all lines to avoid repeated async calls
    const currentToken = await webapi._internalGetToken();
    const callbackPrefix = currentToken ? `$$$${currentToken}$$$${pluginId}$$$` : null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Fast check: if no callback prefix possible, skip signal detection
      if (callbackPrefix && trimmed.startsWith(callbackPrefix)) {
        this.debugLog(`Detected callback signal: ${line}`);
        // Process callback signal but don't include in filtered output
        try {
          const callback = this.parseCallbackSignal(line);
          if (callback && callback.pluginId === pluginId) {
            this.debugLog(`Callback matches plugin ID (${pluginId}), processing...`);
            this.processCallback(callback);
          } else {
            this.debugLog(`Callback plugin ID mismatch or parsing failed. Expected: ${pluginId}, Got: ${callback?.pluginId || 'null'}`);
          }
        } catch (error) {
          this.debugLog(`Failed to parse callback signal: ${error}`);
        }
        // Don't add callback signals to filtered output
      } else {
        // Keep non-callback stderr lines
        filteredLines.push(line);
      }
    }
    
    // Return filtered stderr (without callback signals)
    return filteredLines.join('\n');
  }

  /**
   * Filters callback signals from stderr string
   * @param stderr - Raw stderr string
   * @returns string - Filtered stderr with callback signals removed
   */
  private async filterCallbackSignalsFromStderr(stderr: string, pluginId: string): Promise<string> {
    if (!stderr) return stderr;
    
    const lines = stderr.split('\n');
    const filteredLines: string[] = [];
    
    for (const line of lines) {
      if (!(await this.isCallbackSignal(line, pluginId))) {
        filteredLines.push(line);
      }
    }
    
    return filteredLines.join('\n');
  }

  /**
   * Checks if a line contains a callback signal using exact token and plugin validation
   * @param line - Line to check
   * @param pluginId - Plugin ID for validation
   * @returns Promise<boolean> - True if line contains callback signal
   */
  private async isCallbackSignal(line: string, pluginId: string): Promise<boolean> {
    const trimmed = line.trim();
    if (!trimmed.startsWith('$$$')) return false;
    
    // Get current token for validation
    const currentToken = await webapi._internalGetToken();
    if (!currentToken) return false;
    
    // Check if line starts with exact token and plugin pattern
    return trimmed.startsWith(`$$$${currentToken}$$$${pluginId}$$$`);
  }

  /**
   * Parses a callback signal into its components
   * @param signal - Raw callback signal
   * @returns ParsedCallback | null - Parsed callback or null if invalid
   */
  private parseCallbackSignal(signal: string): ParsedCallback | null {
    try {
      // Remove leading/trailing whitespace
      signal = signal.trim();
      
      // Split by $$$ to get components
      const parts = signal.split('$$$');
      if (parts.length < 4) {
        return null;
      }

      const token = parts[1];
      const pluginId = parts[2];
      const methodPart = parts[3];

      // Extract method name and arguments
      const parenIndex = methodPart.indexOf('(');
      let method: string;
      let args: Record<string, any> = {};

      if (parenIndex === -1) {
        // No parentheses - just method name
        method = methodPart;
      } else {
        // Has parentheses - extract method and args
        method = methodPart.substring(0, parenIndex);
        const argsPart = methodPart.substring(parenIndex);
        args = this.parseArguments(argsPart);
      }

      return {
        token,
        pluginId,
        method,
        args
      };
    } catch (error) {
      this.debugLog(`Error parsing callback signal: ${error}`);
      return null;
    }
  }

  /**
   * Parses arguments from the callback signal
   * @param argsPart - Arguments part of the signal
   * @returns Record<string, any> - Parsed arguments
   */
  private parseArguments(argsPart: string): Record<string, any> {
    try {
      // Convert Python-style arguments to JavaScript object
      // Format: (key=value, key2=value2)((options))(nested=value)((options))
      
      const args: Record<string, any> = {};
      
      // Extract all argument sections between parentheses
      const argsRegex = /\(([^)]*)\)/g;
      let match;
      
      while ((match = argsRegex.exec(argsPart)) !== null) {
        const argsSection = match[1];
        if (argsSection && !argsSection.includes('options')) {
          // Parse key=value pairs
          const pairs = argsSection.split(',');
          for (const pair of pairs) {
            const [key, ...valueParts] = pair.split('=');
            if (key && valueParts.length > 0) {
              const value = valueParts.join('=').trim();
              args[key.trim()] = this.parseValue(value);
            }
          }
        }
      }

      return args;
    } catch (error) {
      this.debugLog(`Error parsing arguments: ${error}`);
      return {};
    }
  }

  /**
   * Parses a single value from string representation
   * @param value - String value to parse
   * @returns any - Parsed value
   */
  private parseValue(value: string): any {
    value = value.trim();

    // Handle quoted strings
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Handle numbers
    if (!isNaN(Number(value))) {
      return Number(value);
    }

    // Handle booleans
    if (value === 'True' || value === 'true') {
      return true;
    }
    if (value === 'False' || value === 'false') {
      return false;
    }

    // Handle None/null
    if (value === 'None' || value === 'null') {
      return null;
    }

    // Return as string if no other type matches
    return value;
  }

  /**
   * Processes a parsed callback by executing the corresponding Eagle API call
   * @param callback - Parsed callback to process
   */
  private async processCallback(callback: ParsedCallback): Promise<void> {
    try {
      // Skip methods that return values (they should be handled differently)
      if (METHODS_WITH_RETURN_VALUES.has(callback.method)) {
        this.debugLog(`Skipping method with return value: ${callback.method}`);
        return;
      }

      // Verify token matches current API token
      const currentToken = await webapi._internalGetToken();
      if (callback.token !== currentToken) {
        this.debugLog(`Token mismatch for callback: ${callback.method}`);
        return;
      }

      this.debugLog(`Processing callback: ${callback.method} with args:`, callback.args);

      // Execute the Eagle API call using safe evaluation
      await this.executeEagleAPICall(callback.method, callback.args);

    } catch (error) {
      this.debugLog(`Error processing callback ${callback.method}:`, error);
    }
  }

  /**
   * Executes an Eagle API call safely
   * @param method - API method to call (e.g., 'folder.create')
   * @param args - Arguments for the method
   */
  private async executeEagleAPICall(method: string, args: Record<string, any>): Promise<any> {
    try {
      // Create a safe execution context with Eagle API
      const context = {
        eagle: (window as any).eagle,
        webapi: webapi,
        args: args
      };

      // Build the method call code
      const [namespace, methodName] = method.split('.');
      if (!namespace || !methodName) {
        throw new Error(`Invalid method format: ${method}`);
      }

      this.debugLog(`Checking if eagle.${namespace}.${methodName} exists...`);
      
      // Check if the method exists first
      if (!(window as any).eagle) {
        this.debugLog(`Eagle API not available on window object`);
        throw new Error('Eagle API not available');
      }
      
      if (!(window as any).eagle[namespace]) {
        this.debugLog(`Eagle namespace '${namespace}' not found`);
        throw new Error(`Eagle namespace '${namespace}' not available`);
      }
      
      if (typeof (window as any).eagle[namespace][methodName] !== 'function') {
        this.debugLog(`Eagle method '${namespace}.${methodName}' not found or not a function`);
        throw new Error(`Method ${method} not available in Eagle API`);
      }

      this.debugLog(`Eagle method '${namespace}.${methodName}' found, calling with args:`, args);

      // Generate safe execution code
      const code = `
        console.log('About to call eagle.${namespace}.${methodName} with args:', args);
        
        // Call the method with proper argument spreading
        let result;
        if (Object.keys(args).length === 0) {
          // No arguments - call method directly
          result = await eagle.${namespace}.${methodName}();
        } else {
          // Has arguments - check if it's a single object or multiple params
          const argKeys = Object.keys(args);
          if (argKeys.length === 1 && argKeys[0] === 'options') {
            // Single options object
            result = await eagle.${namespace}.${methodName}(args.options);
          } else {
            // Multiple named parameters - pass as single object
            result = await eagle.${namespace}.${methodName}(args);
          }
        }
        
        console.log('Eagle method result:', result);
        return result;
      `;

      // Execute using the safe async executor
      const result = await asyncExecReadonly(code, context, ['eagle']);
      
      this.debugLog(`Successfully executed ${method}:`, result);
      return result;

    } catch (error) {
      this.debugLog(`Failed to execute Eagle API call ${method}:`, error);
      throw error;
    }
  }

  /**
   * Extracts plugin ID from script path
   * @param scriptPath - Path to the script
   * @returns string - Plugin ID
   */
  private extractPluginIdFromPath(scriptPath: string): string {
    // Extract plugin ID from path like: /path/to/extensions/{pluginId}/main.py
    const pathParts = scriptPath.replace(/\\/g, '/').split('/');
    const extensionsIndex = pathParts.findIndex(part => part === 'extensions');
    
    if (extensionsIndex !== -1 && extensionsIndex < pathParts.length - 1) {
      return pathParts[extensionsIndex + 1];
    }

    // Fallback: use filename without extension
    const filename = pathParts[pathParts.length - 1];
    return filename.replace('.py', '');
  }

  /**
   * Gets pending callbacks for a plugin
   * @param pluginId - Plugin ID
   * @returns ParsedCallback[] - Array of pending callbacks
   */
  getPendingCallbacks(pluginId: string): ParsedCallback[] {
    return this.pendingCallbacks.get(pluginId) || [];
  }

  /**
   * Clears pending callbacks for a plugin
   * @param pluginId - Plugin ID
   */
  clearPendingCallbacks(pluginId: string): void {
    this.pendingCallbacks.delete(pluginId);
  }
}

// Export singleton instance
export const pythonScriptEvaler = new PythonScriptEvaler();
