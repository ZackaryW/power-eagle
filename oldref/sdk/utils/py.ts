// Python execution utilities for Power Eagle SDK

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

export interface PythonExecutionResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface PythonExecutionOptions {
  pythonEnv?: string; // Override python executable
  workingDir?: string; // Working directory for script execution
  timeout?: number; // Execution timeout in ms
}

export class PythonExecutor extends BaseManager {
  constructor() {
    super('PythonExecutor');
  }

  /**
   * Executes a Python script and returns the result
   * @param scriptPath - Path to the Python script file
   * @param options - Execution options
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

        // Collect stdout
        pythonProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          stdout += output;
          this.debugLog(`Python stdout: ${output.trim()}`);
        });

        // Collect stderr
        pythonProcess.stderr.on('data', (data: Buffer) => {
          const output = data.toString();
          stderr += output;
          this.debugLog(`Python stderr: ${output.trim()}`);
        });

        // Handle process completion
        pythonProcess.on('close', (code: number) => {
          this.debugLog(`Python process exited with code: ${code}`);
          resolve({
            code,
            stdout: stdout.trim(),
            stderr: stderr.trim()
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

  /**
   * Executes Python code directly (creates temporary script)
   * @param code - Python code to execute
   * @param options - Execution options
   * @returns Promise<PythonExecutionResult> - Execution result
   */
  async executeCode(
    code: string,
    options: PythonExecutionOptions = {}
  ): Promise<PythonExecutionResult> {
    return new Promise(async (resolve, reject) => {
      try {
        this.debugLog(`Executing Python code directly`);
        
        // Get required modules
        const childProcess = getChildProcess();
        
        if (!childProcess) {
          throw new Error('Child process module not available');
        }
        
        // Determine python executable
        const pythonCmd = options.pythonEnv || 'python';
        
        this.debugLog(`Using Python: ${pythonCmd}`);
        
        // Build Python context and pass as environment variable
        const pyContext = await buildPyContext();
        const contextJson = JSON.stringify(pyContext);
        
        // Spawn python process with code as stdin and POWEREAGLE_CONTEXT environment variable
        const pythonProcess = childProcess.spawn(pythonCmd, ['-c', code], {
          cwd: options.workingDir || process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            POWEREAGLE_CONTEXT: contextJson
          }
        });

        let stdout = '';
        let stderr = '';

        // Collect stdout
        pythonProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          stdout += output;
          this.debugLog(`Python stdout: ${output.trim()}`);
        });

        // Collect stderr
        pythonProcess.stderr.on('data', (data: Buffer) => {
          const output = data.toString();
          stderr += output;
          this.debugLog(`Python stderr: ${output.trim()}`);
        });

        // Handle process completion
        pythonProcess.on('close', (code: number) => {
          this.debugLog(`Python process exited with code: ${code}`);
          resolve({
            code,
            stdout: stdout.trim(),
            stderr: stderr.trim()
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
            reject(new Error(`Python code execution timed out after ${options.timeout}ms`));
          }, options.timeout);
        }

      } catch (error) {
        this.debugLog(`Failed to execute Python code: ${error}`);
        reject(error);
      }
    });
  }

  /**
   * Checks if Python is available in the system
   * @param pythonCmd - Python command to test (default: 'python')
   * @returns Promise<boolean> - True if Python is available
   */
  async isPythonAvailable(pythonCmd: string = 'python'): Promise<boolean> {
    try {
      const result = await this.executeCode('print("Python is available")', { 
        pythonEnv: pythonCmd,
        timeout: 5000 
      });
      return result.code === 0;
    } catch (error) {
      this.debugLog(`Python not available with command '${pythonCmd}': ${error}`);
      return false;
    }
  }
}

// Export singleton instance
export const pythonExecutor = new PythonExecutor();
