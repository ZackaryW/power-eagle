/**
 * Describe one callable function that can be exposed through the peagle.eagle registry.
 */
export type EagleCallable = (...args: any[]) => Promise<unknown> | unknown;

/**
 * Describe the map of Eagle invocation paths to callable wrappers.
 */
export type EagleInvocationRegistry = Map<string, EagleCallable>;

/**
 * Describe the host Eagle runtime surface available inside the Eagle environment.
 */
export interface HostEagleRuntime {
  app?: Record<string, unknown>;
  window?: Record<string, unknown>;
  os?: Record<string, unknown>;
  screen?: Record<string, unknown>;
  notification?: Record<string, unknown>;
  event?: Record<string, unknown>;
  item?: Record<string, unknown>;
  folder?: Record<string, unknown>;
  smartFolder?: Record<string, unknown>;
  contextMenu?: Record<string, unknown>;
  dialog?: Record<string, unknown>;
  clipboard?: Record<string, unknown>;
  drag?: Record<string, unknown>;
  shell?: Record<string, unknown>;
  log?: Record<string, unknown>;
  library?: Record<string, unknown>;
  tag?: Record<string, unknown>;
  tagGroup?: Record<string, unknown>;
  [key: string]: unknown;
}// Core types for Power Eagle SDK

export interface PluginManifest {
  id: string;
  name: string;
  description?: string;
  type?: string;
  // Python-script specific options
  on?: string | string[]; // Event triggers: onStart, itemChange, libraryChange, folderChange
  pythonEnv?: string; // Optional python environment override
}

export interface ExtensionInfo {
  id: string;
  name: string;
  description?: string;
  type?: string;
  path: string;
  manifest: PluginManifest;
  isBuiltin: boolean;
}

export interface LegacyButtonConfig {
  id: string;
  text: string;
  onClick: () => void;
}

// Host-provided Eagle runtime injected by the Eagle application environment.
// This is separate from the SDK's webapi HTTP client.
// %ZMEM:2aa4% decision #sdk #api #identity "HostEagleAPI is the canonical type for the host-provided eagle runtime; it is intentionally distinct from the webapi HTTP client surface." %ZMEM%
export interface HostEagleAPI {
  showNotification: (message: string) => void;
}

// Backward-compatible alias for older SDK code that still refers to EagleAPI.
export type EagleAPI = HostEagleAPI;

export interface PluginAPI {
  registerButton: (config: LegacyButtonConfig) => void;
}
