/**
 * Render the saved extension list into the extensions slot.
 */
export default async function renderExtensions(peagle) {
  const state = peagle.state.values;
  await peagle.ext.invokeFunc(
    'slot.render',
    [
      'extensions',
      state.savedExtensions.map((extension) => ({
        id: `ext_${extension}`,
        extension,
      })),
    ],
    { template: 'render/extensionCard' },
  );
}