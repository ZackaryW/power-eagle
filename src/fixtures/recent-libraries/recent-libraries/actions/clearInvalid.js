/**
 * Remove invalid libraries in one batched reactive update.
 */
export default async function clearInvalid(peagle) {
  const state = peagle.state.values;
  const invalid = state.libraries.filter((library) => library.status === 'invalid');

  if (!invalid.length) {
    await peagle.eagle.plugin.invokeFunc('notification.show', [{
      title: 'Nothing to clear',
      description: 'All libraries are valid',
    }], {});
    return;
  }

  const confirmed = await peagle.ext.invokeFunc('dialog.confirm', [`Remove ${invalid.length} invalid libraries?`], {
    title: 'Clear Invalid',
    confirmText: 'Remove',
  });

  if (!confirmed) {
    return;
  }

  peagle.state.batch(() => {
    state.libraries = state.libraries.filter((library) => library.status === 'valid');
    state.filtered = [...state.libraries];
  });

  await peagle.eagle.plugin.invokeFunc('notification.show', [{
    title: 'Done',
    description: `Removed ${invalid.length} invalid libraries`,
  }], {});
}