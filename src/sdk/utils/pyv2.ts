// Python execution utilities for Power Eagle SDK (v2 with custom stdout/stderr handlers)

import { webapi } from '..';
import { BaseManager } from './logging';
import {
  createSerializedSelectedFolders,
  createSerializedSelectedItems,
} from './serialize';


// function to build py context to pass as a environment variable
const buildPyContext = async () => {
    const context = {
        selected : {
          folders: await createSerializedSelectedFolders(),
          items: await createSerializedSelectedItems(),
        },
        apiToken: await webapi._internalGetToken() || ''
    };

    return context;
};

// Use Eagle's Node.js API or require in Eagle environment
const getChildProcess = () => {
  try {
    // Try Eagle's Node.js API first
    if ((window as any).eagle?.node?.child_process) {
      return (window as any).eagle.node.child_process;
    }
    // Fallback to require in Eagle environment
    return require('child_process');
  } catch (error) {
    console.error('Child process not available:', error);
    return null;
  }
};

const getPath = () => {
  try {
    // Try Eagle's Node.js API first
    if ((window as any).eagle?.node?.path) {
      return (window as any).eagle.node.path;
    }
    // Fallback to require in Eagle environment
    return require('path');
  } catch (error) {
    console.error('Path module not available:', error);
    return null;
  }
};

const getFS = () => {
  try {
    // Try Eagle's Node.js API first
    if ((window as any).eagle?.node?.fs) {
      return (window as any).eagle.node.fs;
    }
    // Fallback to require in Eagle environment
    return require('fs');
  } catch (error) {
    console.error('FS module not available:', error);
    return null;
  }
};

export interface PythonExecutionResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface PythonExecutionOptions {
  pythonEnv?: string; // Override python executable
  workingDir?: string; // Working directory for script execution
  timeout?: number; // Execution timeout in ms
  // NEW: Custom handlers for stdout and stderr
  onStdout?: (data: string) => void; // Custom function to handle stdout data
  onStderr?: (data: string) => void; // Custom function to handle stderr data
}

export class PythonExecutorV2 extends BaseManager {
  constructor() {
    super('PythonExecutorV2');
  }

  /**
   * Gets plugin ID from script path by reading plugin.json
   * Note: This is a synchronous method as it's called in contexts where async is not possible
   * @param scriptPath - Path to the Python script
   * @returns string | null - Plugin ID or null if not found
   */
  private getPluginIdFromScript(scriptPath: string): string | null {
    try {
      const fs = getFS();
      const path = getPath();
      if (!fs || !path) return null;

      const scriptDir = path.dirname(scriptPath);
      const pluginJsonPath = path.join(scriptDir, 'plugin.json');
      
      // Use existsSync to avoid exception overhead
      if (fs.existsSync(pluginJsonPath)) {
        const pluginManifest = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
        return pluginManifest.id || null;
      }
    } catch (error) {
      this.debugLog(`Failed to read plugin.json: ${error}`);
    }
    return null;
  }

  /**
   * Filters callback signals from output for logging purposes
   * Uses exact token and plugin ID validation
   * @param output - Raw output string
   * @param scriptPath - Path to script (to get plugin ID)
   * @returns Promise<string> - Filtered output with callback signals removed
   */
  private async filterCallbackSignals(output: string, scriptPath?: string): Promise<string> {
    const lines = output.split('\n');
    const filteredLines: string[] = [];
    
    // Get current token and plugin ID for validation
    const currentToken = await webapi._internalGetToken();
    const pluginId = scriptPath ? this.getPluginIdFromScript(scriptPath) : null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check if line is a callback signal with exact validation
      if (currentToken && pluginId && trimmed.startsWith(`$$$${currentToken}$$$${pluginId}$$$`)) {
        // This is a valid callback signal - filter it out
        continue;
      }
      
      // Keep all other lines (including invalid callback attempts)
      filteredLines.push(line);
    }
    
    return filteredLines.join('\n');
  }

  /**
   * Executes a Python script and returns the result
   * @param scriptPath - Path to the Python script file
   * @param options - Execution options including custom stdout/stderr handlers
   * @returns Promise<PythonExecutionResult> - Execution result with stdout, stderr, and exit code
   */
  async executeScript(
    scriptPath: string, 
    options: PythonExecutionOptions = {}
  ): Promise<PythonExecutionResult> {
    return new Promise(async (resolve, reject) => {
      try {
        this.debugLog(`Executing Python script: ${scriptPath}`);
        
        // Get required modules
        const childProcess = getChildProcess();
        const path = getPath();
        
        if (!childProcess || !path) {
          throw new Error('Required Node.js modules not available');
        }
        
        // Determine python executable
        const pythonCmd = options.pythonEnv || 'python';
        
        // Set working directory
        const workingDir = options.workingDir || path.dirname(scriptPath);
        
        this.debugLog(`Using Python: ${pythonCmd}, Working dir: ${workingDir}`);
        
        // Build Python context and pass as environment variable
        const pyContext = await buildPyContext();
        const contextJson = JSON.stringify(pyContext);
        
        // Spawn python process with POWEREAGLE_CONTEXT environment variable
        const pythonProcess = childProcess.spawn(pythonCmd, [scriptPath], {
          cwd: workingDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            POWEREAGLE_CONTEXT: contextJson
          }
        });

        let stdout = '';
        let stderr = '';
        
        // Use arrays for efficient string concatenation
        // %ZMEM:77ac% function_change #performance #python #streaming "executeScript buffers stdout and stderr chunks in arrays and joins once on process close to avoid repeated string concatenation during streaming output." %ZMEM%
        const stdoutChunks: string[] = [];
        const stderrChunks: string[] = [];

        // Collect stdout with optional custom handler
        pythonProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          stdoutChunks.push(output);
          this.debugLog(`Python stdout: ${output.trim()}`);
          
          // Call custom stdout handler if provided
          if (options.onStdout) {
            try {
              options.onStdout(output);
            } catch (error) {
              this.debugLog(`Error in custom stdout handler: ${error}`);
            }
          }
        });

        // Collect stderr with optional custom handler and callback filtering
        pythonProcess.stderr.on('data', (data: Buffer) => {
          const output = data.toString();
          stderrChunks.push(output);
          
          // Debug: Log all stderr data to see what we're receiving
          this.debugLog(`Raw Python stderr received: "${output.trim()}"`);
          
          // Filter callback signals and only log non-callback content
          this.filterCallbackSignals(output, scriptPath).then(filtered => {
            if (filtered.trim()) {
              this.debugLog(`Python stderr: ${filtered.trim()}`);
            }
          });
          
          // Call custom stderr handler if provided (with raw data)
          if (options.onStderr) {
            try {
              options.onStderr(output);
            } catch (error) {
              this.debugLog(`Error in custom stderr handler: ${error}`);
            }
          }
        });

        // Handle process completion
        pythonProcess.on('close', async (code: number) => {
          this.debugLog(`Python process exited with code: ${code}`);
          
          // Join chunks efficiently
          stdout = stdoutChunks.join('');
          stderr = stderrChunks.join('');
          
          // Filter callback signals from final stderr before resolving
          const filteredStderr = await this.filterCallbackSignals(stderr, scriptPath);
          
          resolve({
            code,
            stdout: stdout.trim(),
            stderr: filteredStderr.trim()
          });
        });

        // Handle process errors
        pythonProcess.on('error', (error: Error) => {
          this.debugLog(`Python process error: ${error.message}`);
          reject(error);
        });

        // Set timeout if specified
        if (options.timeout && options.timeout > 0) {
          setTimeout(() => {
            pythonProcess.kill('SIGTERM');
            reject(new Error(`Python script execution timed out after ${options.timeout}ms`));
          }, options.timeout);
        }

      } catch (error) {
        this.debugLog(`Failed to execute Python script: ${error}`);
        reject(error);
      }
    });
  }
}

// Export singleton instance
export const pythonExecutorV2 = new PythonExecutorV2();
