// Root-level event listeners for Eagle application state changes

import { BaseManager } from './utils/logging';

export interface EagleStateChanges {
  itemChange?: any; // Changed item data
  libraryChange?: any; // Changed library data  
  folderChange?: any; // Changed folder data
}

export type EagleEventType = 'itemChange' | 'libraryChange' | 'folderChange';
export type EagleEventCallback = (data: any) => void;

export class RootListeners extends BaseManager {
  private callbacks: Map<EagleEventType, Set<EagleEventCallback>> = new Map();
  private lastState: EagleStateChanges = {};
  private polling: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private enabledTypes: Set<EagleEventType> = new Set();

  constructor() {
    super('RootListeners');
    
    // Initialize callback maps
    this.callbacks.set('itemChange', new Set());
    this.callbacks.set('libraryChange', new Set());
    this.callbacks.set('folderChange', new Set());
  }

  /**
   * Starts monitoring Eagle application state changes
   * @param intervalMs - Polling interval in milliseconds (default: 1000)
   * @param enabledTypes - Array of event types to monitor (default: all types)
   */
  async startPolling(intervalMs: number = 1000, enabledTypes?: EagleEventType[]): Promise<void> {
    if (this.polling) {
      this.debugLog('Already polling, stopping previous poll');
      this.stopPolling();
    }

    // Set enabled types (default to all if not specified)
    if (enabledTypes) {
      this.enabledTypes = new Set(enabledTypes);
    } else {
      this.enabledTypes = new Set(['itemChange', 'libraryChange', 'folderChange']);
    }

    this.debugLog(`Starting Eagle state polling with ${intervalMs}ms interval for types: ${Array.from(this.enabledTypes).join(', ')}`);
    this.polling = true;
    
    // Initial state capture
    await this.captureCurrentState();
    
    // Start polling
    this.pollInterval = setInterval(async () => {
      await this.checkForChanges();
    }, intervalMs);
  }

  /**
   * Stops monitoring Eagle application state changes
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.polling = false;
    this.enabledTypes.clear();
    this.debugLog('Stopped Eagle state polling');
  }

  /**
   * Start monitoring only item selection changes
   * @param intervalMs - Polling interval in milliseconds (default: 1000)
   */
  async startItemMonitoring(intervalMs: number = 1000): Promise<void> {
    await this.startPolling(intervalMs, ['itemChange']);
  }

  /**
   * Start monitoring only folder selection changes
   * @param intervalMs - Polling interval in milliseconds (default: 1000)
   */
  async startFolderMonitoring(intervalMs: number = 1000): Promise<void> {
    await this.startPolling(intervalMs, ['folderChange']);
  }

  /**
   * Start monitoring only library changes
   * @param intervalMs - Polling interval in milliseconds (default: 1000)
   */
  async startLibraryMonitoring(intervalMs: number = 1000): Promise<void> {
    await this.startPolling(intervalMs, ['libraryChange']);
  }

  /**
   * Start monitoring item and folder changes (most common use case)
   * @param intervalMs - Polling interval in milliseconds (default: 1000)
   */
  async startSelectionMonitoring(intervalMs: number = 1000): Promise<void> {
    await this.startPolling(intervalMs, ['itemChange', 'folderChange']);
  }

  /**
   * Registers a callback for a specific Eagle event type
   * @param eventType - Type of Eagle event to listen for
   * @param callback - Callback function to execute on event
   */
  registerCallback(eventType: EagleEventType, callback: EagleEventCallback): void {
    const callbackSet = this.callbacks.get(eventType);
    if (callbackSet) {
      callbackSet.add(callback);
      this.debugLog(`Registered callback for ${eventType}, total: ${callbackSet.size}`);
    }
  }

  /**
   * Unregisters a callback for a specific Eagle event type
   * @param eventType - Type of Eagle event to stop listening for
   * @param callback - Callback function to remove
   */
  unregisterCallback(eventType: EagleEventType, callback: EagleEventCallback): void {
    const callbackSet = this.callbacks.get(eventType);
    if (callbackSet && callbackSet.has(callback)) {
      callbackSet.delete(callback);
      this.debugLog(`Unregistered callback for ${eventType}, remaining: ${callbackSet.size}`);
    }
  }

  /**
   * Captures the current state of Eagle application
   */
  private async captureCurrentState(): Promise<void> {
    try {
      const eagle = (window as any).eagle;
      if (!eagle) {
        this.debugLog('Eagle API not available');
        return;
      }

      this.lastState = {};

      // Only capture state for enabled types
      if (this.enabledTypes.has('itemChange')) {
        this.lastState.itemChange = await this.getCurrentItem();
      }
      if (this.enabledTypes.has('libraryChange')) {
        this.lastState.libraryChange = await this.getCurrentLibrary();
      }
      if (this.enabledTypes.has('folderChange')) {
        this.lastState.folderChange = await this.getCurrentFolder();
      }

      this.debugLog('Captured current Eagle state for enabled types:', Array.from(this.enabledTypes));
    } catch (error) {
      this.debugLog('Error capturing Eagle state:', error);
    }
  }

  /**
   * Checks for changes in Eagle application state and triggers callbacks
   */
  private async checkForChanges(): Promise<void> {
    try {
      const eagle = (window as any).eagle;
      if (!eagle) {
        return;
      }

      const currentState: EagleStateChanges = {};

      // Only check state for enabled types
      if (this.enabledTypes.has('itemChange')) {
        currentState.itemChange = await this.getCurrentItem();
      }
      if (this.enabledTypes.has('libraryChange')) {
        currentState.libraryChange = await this.getCurrentLibrary();
      }
      if (this.enabledTypes.has('folderChange')) {
        currentState.folderChange = await this.getCurrentFolder();
      }

      // Check for item changes
      if (this.enabledTypes.has('itemChange') && !this.compareObjects(this.lastState.itemChange, currentState.itemChange)) {
        this.debugLog('Item change detected');
        this.triggerCallbacks('itemChange', currentState.itemChange);
        this.lastState.itemChange = currentState.itemChange;
      }

      // Check for library changes
      if (this.enabledTypes.has('libraryChange') && !this.compareObjects(this.lastState.libraryChange, currentState.libraryChange)) {
        this.debugLog('Library change detected');
        this.triggerCallbacks('libraryChange', currentState.libraryChange);
        this.lastState.libraryChange = currentState.libraryChange;
      }

      // Check for folder changes
      if (this.enabledTypes.has('folderChange') && !this.compareObjects(this.lastState.folderChange, currentState.folderChange)) {
        this.debugLog('Folder change detected');
        this.triggerCallbacks('folderChange', currentState.folderChange);
        this.lastState.folderChange = currentState.folderChange;
      }

    } catch (error) {
      this.debugLog('Error checking for changes:', error);
    }
  }

  /**
   * Gets currently selected/active item from Eagle
   * @param eagle - Eagle API object
   * @returns Promise<any> - Current item data or null
   */
  private async getCurrentItem(): Promise<any> {
    try {
      const eagle = (window as any).eagle;
      if (!eagle || !eagle.item) {
        this.debugLog('Eagle item API not available');
        return null;
      }
      
      // Use the correct Eagle API method to get selected items
      const selectedItems = await eagle.item.getSelected();
      const itemsIds = selectedItems ? selectedItems.map((i: any) => i.id) : [];
      
      // Sort the array to ensure consistent ordering for comparison
      return itemsIds.sort();
    } catch (error) {
      this.debugLog('Error getting current item:', error);
      return null;
    }
  }

  /**
   * Gets currently active library from Eagle
   * @param eagle - Eagle API object
   * @returns Promise<any> - Current library data or null
   */
  private async getCurrentLibrary(): Promise<any> {
    try {
        return eagle.library.path;
    } catch (error) {
      this.debugLog('Error getting current library:', error);
      return null;
    }
  }

  /**
   * Gets currently active folder from Eagle
   * @param eagle - Eagle API object
   * @returns Promise<any> - Current folder data or null
   */
  private async getCurrentFolder(): Promise<any> {
    try {
      const eagle = (window as any).eagle;
      if (!eagle || !eagle.folder) {
        this.debugLog('Eagle folder API not available');
        return null;
      }
      
      // Use the correct Eagle API method to get selected folders
      const selectedFolders = await eagle.folder.getSelected();
      //this.debugLog('Current selected folders:', selectedFolders);
      const foldersIDs = selectedFolders ? selectedFolders.map((f: any) => f.id) : [];
      
      // Sort the array to ensure consistent ordering for comparison
      return foldersIDs.sort();
    } catch (error) {
      this.debugLog('Error getting current folder:', error);
      return null;
    }
  }

  /**
   * Triggers callbacks for a specific event type with error handling
   * @param eventType - Type of event that occurred
   * @param data - Event data to pass to callbacks
   */
  private triggerCallbacks(eventType: EagleEventType, data: any): void {
    const callbackSet = this.callbacks.get(eventType);
    if (!callbackSet || callbackSet.size === 0) {
      return;
    }

    const callbacksToRemove: EagleEventCallback[] = [];

    callbackSet.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        this.debugLog(`Callback error for ${eventType}, removing callback:`, error);
        callbacksToRemove.push(callback);
      }
    });

    // Remove invalid callbacks
    callbacksToRemove.forEach(callback => {
      callbackSet.delete(callback);
    });

    if (callbacksToRemove.length > 0) {
      this.debugLog(`Removed ${callbacksToRemove.length} invalid callbacks for ${eventType}`);
    }
  }

  /**
   * Compares two objects for equality (shallow comparison)
   * @param obj1 - First object
   * @param obj2 - Second object
   * @returns boolean - True if objects are equal
   */
  private compareObjects(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return obj1 === obj2;
    
    // Quick type check
    if (typeof obj1 !== typeof obj2) return false;
    
    // For primitives
    if (typeof obj1 !== 'object') return obj1 === obj2;
    
    // For arrays
    if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
    if (Array.isArray(obj1)) {
      if (obj1.length !== obj2.length) return false;
      
      // Since we now sort arrays in getCurrentItem and getCurrentFolder,
      // we can do a simple element-by-element comparison
      for (let i = 0; i < obj1.length; i++) {
        if (obj1[i] !== obj2[i]) return false;
      }
      return true;
    }
    
    // For objects (shallow comparison for performance)
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    // Create a Set for O(1) lookup instead of O(n) includes
    const keys2Set = new Set(keys2);
    
    for (const key of keys1) {
      if (!keys2Set.has(key)) return false;
      if (obj1[key] !== obj2[key]) return false; // Shallow comparison
    }
    
    return true;
  }

  /**
   * Gets the current state of all callbacks
   * @returns object - Current callback counts by event type
   */
  getCallbackStats(): { [K in EagleEventType]: number } {
    return {
      itemChange: this.callbacks.get('itemChange')?.size || 0,
      libraryChange: this.callbacks.get('libraryChange')?.size || 0,
      folderChange: this.callbacks.get('folderChange')?.size || 0
    };
  }
}

// Export singleton instance
export const rootListeners = new RootListeners();
