// Helpers to bypass PostgREST's default 1000-row cap by paginating with
// `.range()` and chunking large `.in(...)` id lists.

export async function fetchAll<T = any>(
  build: () => any,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as T[];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return out;
}

export async function fetchAllIn<T = any>(
  build: (ids: any[]) => any,
  ids: any[],
  chunk = 300,
): Promise<T[]> {
  const out: T[] = [];
  const unique = Array.from(new Set(ids));
  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk);
    const rows = await fetchAll<T>(() => build(slice));
    out.push(...rows);
  }
  return out;
}
