// PostgREST oddaje najwyzej 1000 wierszy na zapytanie -- nadmiar ucina PO
// CICHU (bez bledu). Listy, ktore moga przekroczyc limit, pobieramy stronami
// (audyt QA 2026-10-11, kurier_appp/RAPORT_QA_2026-10-11.md #3).
// buildQuery musi miec jednoznaczne sortowanie (np. po id), inaczej strony
// moga sie nakladac.
export const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

interface RangeQuery<T> {
  range(from: number, to: number): PromiseLike<PageResult<T>>;
}

export async function fetchAllPages<T>(buildQuery: () => RangeQuery<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}
