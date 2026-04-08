// Logging utilities for Power Eagle SDK

/**
 * Creates a debug logger with a specific prefix
 * @param prefix - The prefix to use for log messages (e.g., class name)
 * @param enabled - Whether debug logging is enabled
 * @returns Debug logging function
 */
export function createDebugLogger(prefix: string, enabled: boolean = true) {
  return (message: string, ...args: any[]): void => {
    if (enabled) {
      console.log(`[${prefix} DEBUG] ${message}`, ...args);
    }
  };
}

/**
 * Base class for managers that need debug logging
 */
export abstract class BaseManager {
  protected debugMode: boolean = true;
  private debugLogger: (message: string, ...args: any[]) => void;

  constructor(className: string) {
    this.debugLogger = createDebugLogger(className, this.debugMode);
  }

  /**
   * Logs debug messages when debug mode is enabled
   * @param message - Debug message to log
   * @param args - Additional arguments to log
   */
  protected debugLog(message: string, ...args: any[]): void {
    this.debugLogger(message, ...args);
  }

  /**
   * Enable or disable debug logging
   * @param enabled - Whether to enable debug logging
   */
  protected setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    this.debugLogger = createDebugLogger(this.constructor.name, enabled);
  }
}