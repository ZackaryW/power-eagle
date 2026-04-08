// Constants for Power Eagle SDK

/**
 * Built-in example plugins list
 */
export const BUILT_IN_PLUGINS = [
  'example-plugin',
  'recent-libraries', 
  'file-creator'
] as const;

/**
 * Power Eagle directory structure
 */
export const POWER_EAGLE_PATHS = {
  BASE: '.powereagle',
  EXTENSIONS: 'extensions',
  DOWNLOAD: 'download'
} as const;

/**
 * Storage key prefixes
 */
export const STORAGE_KEYS = {
  HIDDEN_PLUGINS: 'powereagle::hidden-plugins',
  FILE_CREATOR_EXTENSIONS: 'powereagle::file-creator::extension-list'
} as const;

/**
 * Plugin types
 */
export const PLUGIN_TYPES = {
  STANDARD: 'standard',
  REACT: 'react',
  VUE: 'vue',
  ANGULAR: 'angular',
  CUSTOM: 'custom'
} as const;

/**
 * Default plugin type
 */
export const DEFAULT_PLUGIN_TYPE = PLUGIN_TYPES.STANDARD;

/**
 * Plugin types
 */
export type BuiltInPlugin = typeof BUILT_IN_PLUGINS[number];
export type PluginType = typeof PLUGIN_TYPES[keyof typeof PLUGIN_TYPES];