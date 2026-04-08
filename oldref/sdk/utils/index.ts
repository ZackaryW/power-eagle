// Main utilities index - re-exports all utility modules for Power Eagle SDK

// Logging utilities
export * from './logging';

// Path utilities
export * from './paths';

// File system utilities
export * from './files';

// DOM utilities
export * from './dom';

// Common utilities
export * from './common';

// Constants
export * from './constants';

// Eagle-specific swap utilities
export * from './op';

// Legacy compatibility - re-export everything from the main interface
export {
  debounce,
  throttle,
  generateId,
  isValidUrl
} from './common';

export {
  createElement,
  addStylesheet,
  removeStylesheet,
  waitForElement,
  injectScript,
  copyToClipboard,
  sanitizeHtml
} from './dom';

export {
  extractZip,
  createFile,
  formatBytes
} from './files';

export {
  getUserHomeDirectory,
  getExtensionsPath,
  getDownloadPath,
  getPowerEagleBasePath,
  ensurePowerEagleDirectories
} from './paths';

export {
  createDebugLogger,
  BaseManager
} from './logging';