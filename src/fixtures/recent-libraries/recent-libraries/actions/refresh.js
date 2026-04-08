/**
 * Refresh the recent library list and publish the rendered results slot state.
 */
export default async function refresh(peagle) {
  const state = peagle.state.values;
  await peagle.ext.invokeFunc('slot.loading', ['results'], { text: 'Loading...' });

  const paths = await peagle.eagle.util.invokeFunc('getRecentLibraries', [], {});
  const validated = await Promise.all(
    paths.map(async (libPath, index) => {
      const valid = !libPath.endsWith('Projects.library');
      return {
        id: `lib_${index}`,
        name: libPath.split('/').pop().replace('.library', ''),
        path: libPath,
        status: valid ? 'valid' : 'invalid',
        statusVariant: valid ? 'success' : 'error',
      };
    }),
  );

  peagle.state.batch(() => {
    state.libraries = validated;
    state.filtered = [...validated];
  });
}