/**
 * Filter the current recent library list by query.
 */
export default async function filter(peagle, [query]) {
  const state = peagle.state.values;
  const normalizedQuery = String(query ?? '').trim().toLowerCase();
  state.filtered = !normalizedQuery
    ? [...state.libraries]
    : state.libraries.filter((library) =>
        library.name.toLowerCase().includes(normalizedQuery) ||
        library.path.toLowerCase().includes(normalizedQuery),
      );
}