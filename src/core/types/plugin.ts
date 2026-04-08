export type { HostEagleRuntime } from '../../sdk';

/**
 * Represent a static v2 plugin manifest extracted from plugin package metadata.
 */
export interface V2PluginManifest {
  id: string;
  name: string;
  version: string;
  stateVersion: number;
  type: string;
  keywords?: string[];
  description?: string;
}

/**
 * Represent the supported invocation namespaces in the peagle runtime.
 */
export type InvocationNamespace = 'local' | 'ext' | 'eagle';

/**
 * Represent the tuple convention used by ui.json invocation bindings.
 */
export type InvocationTuple = [
  InvocationNamespace,
  string,
  unknown[]?,
  Record<string, unknown>?
];

/**
 * Represent a parsed UI node from ui.json.
 */
export interface UiNode {
  type?: string;
  slot?: string;
  template?: string;
  children?: UiNode[];
  actions?: UiNode[];
  content?: UiNode | string;
  onClick?: InvocationTuple;
  onInput?: InvocationTuple;
  empty?: string;
  [key: string]: unknown;
}

/**
 * Represent a parsed render template JSON payload.
 */
export type RenderTemplate = Record<string, unknown>;

/**
 * Describe the startup hooks owned by the host runtime.
 */
export interface PluginLifecycleDefinition {
  onMount?: InvocationTuple[];
}

/**
 * Describe the canonical plugin.json package payload.
 */
export interface PluginPackageDefinition extends V2PluginManifest {
  ui: UiNode;
  state?: {
    initial?: Record<string, unknown>;
    slots?: Record<string, string>;
  };
  lifecycle?: PluginLifecycleDefinition;
}

/**
 * Represent one loaded local registry entry.
 */
export interface RegistryEntry {
  key: string;
  modulePath: string;
  exportedDefault: unknown;
}

/**
 * Represent the fully parsed plugin package before activation.
 */
export interface ParsedPluginPackage {
  rootDir: string;
  folderName: string;
  declaredType: string;
  manifest: V2PluginManifest;
  ui: UiNode;
  templates: Record<string, RenderTemplate>;
  modulePaths: string[];
  initialState: Record<string, unknown>;
  stateSlots: Record<string, string>;
  lifecycle: PluginLifecycleDefinition;
}

/**
 * Represent the persisted render state for a named slot.
 */
export interface SlotSnapshot {
  name: string;
  rendered: unknown;
}

/**
 * Describe the file system contract used by the parser and activation pipeline.
 */
export interface PluginFileSystem {
  exists(filePath: string): Promise<boolean>;
  listFiles(rootDir: string): Promise<string[]>;
  readText(filePath: string): Promise<string>;
  importModule(modulePath: string): Promise<Record<string, unknown>>;
}

/**
 * Represent the activated plugin runtime returned to tests and higher layers.
 */
export interface ActivatedPlugin {
  parsed: ParsedPluginPackage;
  slots: Record<string, SlotSnapshot & { onInput?: ((value: string) => Promise<unknown>) | null }>;
  registry: Map<string, RegistryEntry>;
  peagle: PeagleRuntime;
}

/**
 * Represent the runtime facade exposed to actions, lifecycle hooks, and the host shell.
 */
export interface PeagleRuntime {
  local: {
    func(key: string, args?: unknown[], kwargs?: Record<string, unknown>): (...callArgs: unknown[]) => Promise<unknown>;
    invokeFunc(key: string, args?: unknown[], kwargs?: Record<string, unknown>): Promise<unknown>;
  };
  ext: {
    func(key: string, args?: unknown[], kwargs?: Record<string, unknown>): (...callArgs: unknown[]) => Promise<unknown>;
    invokeFunc(key: string, args?: unknown[], kwargs?: Record<string, unknown>): Promise<unknown>;
  };
  eagle: {
    plugin: {
      func(key: string, args?: unknown[], kwargs?: Record<string, unknown>): (...callArgs: unknown[]) => Promise<unknown>;
      invokeFunc(key: string, args?: unknown[], kwargs?: Record<string, unknown>): Promise<unknown>;
    };
    web: {
      func(key: string, args?: unknown[], kwargs?: Record<string, unknown>): (...callArgs: unknown[]) => Promise<unknown>;
      invokeFunc(key: string, args?: unknown[], kwargs?: Record<string, unknown>): Promise<unknown>;
    };
    util: {
      func(key: string, args?: unknown[], kwargs?: Record<string, unknown>): (...callArgs: unknown[]) => Promise<unknown>;
      invokeFunc(key: string, args?: unknown[], kwargs?: Record<string, unknown>): Promise<unknown>;
    };
  };
  slot(name: string): SlotSnapshot & { onInput?: ((value: string) => Promise<unknown>) | null };
  state: {
    values: Record<string, unknown>;
    batch<T>(callback: () => T): T;
  };
}