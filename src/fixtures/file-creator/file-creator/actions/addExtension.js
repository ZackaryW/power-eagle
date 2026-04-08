import renderExtensions from './renderExtensions.js';

/**
 * Add the current extension to the saved extension list.
 */
export default async function addExtension(peagle) {
  const state = peagle.state.values;
  const extension = String(state.fileExtension ?? '').trim().replace(/^\.+/u, '').toLowerCase();
  if (!extension) {
    await peagle.eagle.plugin.invokeFunc('notification.show', [{
      title: 'Extension Required',
      body: 'Enter an extension before saving it.',
    }], {});
    return;
  }

  if (!state.savedExtensions.includes(extension)) {
    state.savedExtensions = [...state.savedExtensions, extension];
    await renderExtensions(peagle);
  }
}