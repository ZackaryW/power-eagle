import pluginJson from './file-creator/plugin.json';
import addExtensionModule from './file-creator/actions/addExtension.js';
import createFileModule from './file-creator/actions/createFile.js';
import removeExtensionModule from './file-creator/actions/removeExtension.js';
import renderExtensionsModule from './file-creator/actions/renderExtensions.js';
import extensionCardTemplate from './file-creator/render/extensionCard.json';
import { parseRenderTemplate } from '../../core/parser/template-parser';
import { parseUiDefinition } from '../../core/parser/ui-parser';
import { createBrowserRegistry } from '../../core/runtime/browser-registry';
import type { ParsedPluginPackage, PluginPackageDefinition } from '../../core/types/plugin';

const definition = pluginJson as unknown as PluginPackageDefinition;

/**
 * Export the parsed file-creator package for direct browser activation.
 */
export const fileCreatorParsedPackage: ParsedPluginPackage = {
  rootDir: 'browser:file-creator',
  folderName: 'file-creator',
  declaredType: definition.type,
  manifest: definition,
  ui: parseUiDefinition(definition.ui),
  templates: {
    'render/extensionCard': parseRenderTemplate(extensionCardTemplate),
  },
  modulePaths: [
    'actions/addExtension',
    'actions/createFile',
    'actions/removeExtension',
    'actions/renderExtensions',
  ],
  initialState: definition.state?.initial ?? {},
  stateSlots: definition.state?.slots ?? {},
  lifecycle: definition.lifecycle ?? {},
};

/**
 * Export the browser registry for the file-creator package.
 */
export const fileCreatorRegistry = createBrowserRegistry({
  'actions/addExtension': { default: addExtensionModule },
  'actions/createFile': { default: createFileModule },
  'actions/removeExtension': { default: removeExtensionModule },
  'actions/renderExtensions': { default: renderExtensionsModule },
});