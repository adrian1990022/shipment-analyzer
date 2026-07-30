import { vi } from "vitest";

export interface MockResult {
  data?: unknown;
  error?: unknown;
}

// Chainable, "thenable" mock jednego zapytania supabase-js: kazda metoda
// (select/insert/update/upsert/delete/eq/order/gte) zwraca siebie -- tak
// jak prawdziwy PostgrestFilterBuilder -- a caly lancuch mozna zawaitowac
// (albo zakonczyc .single()/.maybeSingle()), zeby dostac skonfigurowany
// wynik. Uzycie w testach repository:
//
//   supabase.from.mockReturnValueOnce(createQueryBuilderMock({ data: [...] }));
export function createQueryBuilderMock(result: MockResult) {
  const resolved = Promise.resolve({ data: result.data ?? null, error: result.error ?? null });

  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    single: vi.fn(() => resolved),
    maybeSingle: vi.fn(() => resolved),
    then: (onFulfilled: Parameters<Promise<unknown>["then"]>[0], onRejected: Parameters<Promise<unknown>["then"]>[1]) =>
      resolved.then(onFulfilled, onRejected),
  };
  return builder;
}

// Do testowania repository, ktore woluja supabase.from(...) -- mockuje
// caly modul lib/supabaseClient, wiec repository nigdy nie dotyka
// prawdziwego Supabase (spec: "nie testuj Supabase, mockuj Repository").
export function createSupabaseClientMock() {
  return { from: vi.fn(), rpc: vi.fn() };
}
