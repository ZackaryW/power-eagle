import renderExtensions from './renderExtensions.js';

/**
 * Remove one saved extension from the quick-create list.
 */
export default async function removeExtension(peagle, [entry]) {
  const state = peagle.state.values;
  state.savedExtensions = state.savedExtensions.filter((extension) => extension !== entry.extension);
  await renderExtensions(peagle);
}