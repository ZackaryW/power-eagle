// Core types for Power Eagle SDK

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
