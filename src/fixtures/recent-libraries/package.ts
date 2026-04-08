import pluginJson from './recent-libraries/plugin.json';
import refreshModule from './recent-libraries/actions/refresh.js';
import filterModule from './recent-libraries/actions/filter.js';
import openModule from './recent-libraries/actions/open.js';
import removeModule from './recent-libraries/actions/remove.js';
import clearInvalidModule from './recent-libraries/actions/clearInvalid.js';
import libraryCardTemplate from './recent-libraries/render/libraryCard.json';
import { parseRenderTemplate } from '../../core/parser/template-parser';
import { parseUiDefinition } from '../../core/parser/ui-parser';
import { createBrowserRegistry } from '../../core/runtime/browser-registry';
import type { ParsedPluginPackage, PluginPackageDefinition } from '../../core/types/plugin';

const definition = pluginJson as unknown as PluginPackageDefinition;

/**
 * Export the parsed recent-libraries package for direct browser activation.
 */
export const recentLibrariesParsedPackage: ParsedPluginPackage = {
  rootDir: 'browser:recent-libraries',
  folderName: 'recent-libraries',
  declaredType: definition.type,
  manifest: definition,
  ui: parseUiDefinition(definition.ui),
  templates: {
    'render/libraryCard': parseRenderTemplate(libraryCardTemplate),
  },
  modulePaths: ['actions/refresh', 'actions/filter', 'actions/open', 'actions/remove', 'actions/clearInvalid'],
  initialState: definition.state?.initial ?? {},
  stateSlots: definition.state?.slots ?? {},
  lifecycle: definition.lifecycle ?? {},
};

/**
 * Export the browser registry for the recent-libraries package.
 */
export const recentLibrariesRegistry = createBrowserRegistry({
  'actions/refresh': { default: refreshModule },
  'actions/filter': { default: filterModule },
  'actions/open': { default: openModule },
  'actions/remove': { default: removeModule },
  'actions/clearInvalid': { default: clearInvalidModule },
});