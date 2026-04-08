/**
 * Remove one library from the in-memory recent list.
 */
export default async function remove(peagle, [library]) {
  const state = peagle.state.values;
  peagle.state.batch(() => {
    state.libraries = state.libraries.filter((entry) => entry.id !== library.id);
    state.filtered = state.filtered.filter((entry) => entry.id !== library.id);
  });
}