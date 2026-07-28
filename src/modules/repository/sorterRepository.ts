import { supabase } from "../../lib/supabaseClient";
import type { Sorter, SorterWithRoutes } from "../../types/sorter";

interface SorterRow {
  id: number;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function fromRow(row: SorterRow): Sorter {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Lista sortujacych + ich trasy, do ekranu "Sortujacy" (lista/edycja).
export async function fetchSorters(): Promise<SorterWithRoutes[]> {
  const [sortersRes, routesRes] = await Promise.all([
    supabase.from("sorters").select("id, name, active, created_at, updated_at").order("name"),
    supabase.from("sorter_routes").select("sorter_id, route"),
  ]);
  if (sortersRes.error) throw sortersRes.error;
  if (routesRes.error) throw routesRes.error;

  const routesBySorterId = new Map<number, string[]>();
  for (const row of routesRes.data ?? []) {
    const list = routesBySorterId.get(row.sorter_id) ?? [];
    list.push(row.route);
    routesBySorterId.set(row.sorter_id, list);
  }

  return (sortersRes.data ?? []).map((row) => ({
    ...fromRow(row as SorterRow),
    routes: (routesBySorterId.get((row as SorterRow).id) ?? []).sort((a, b) => a.localeCompare(b)),
  }));
}

// Trasa (routes.trasa) -> nazwa sortujacego. Uzywane wylacznie przez
// Mapper (patrz modules/mapper/mapRoutes.ts) do przypisania sortujacego
// -- nie zaleznie od pola "active": brak wpisu = fallback (3. litera
// trasy), a nie status sortujacego. Jesli sortujacy jest dezaktywowany,
// jego przypisania nadal obowiazuja, dopoki ktos ich recznie nie zmieni --
// to bardziej uczciwy stan niz ciche przeskoczenie na fallback.
export async function fetchSorterNameByTrasa(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("sorter_routes")
    .select("route, sorters(name)");
  if (error) throw error;

  // supabase-js typuje relacje "do jednego" bez wygenerowanych typow bazy
  // jako tablice, mimo ze w runtime PostgREST zwraca tu pojedynczy obiekt
  // (sorter_routes.sorter_id -> sorters.id jest relacja wiele-do-jednego).
  // Obsluga obu ksztaltow defensywnie, zeby nie polegac na zgadywaniu.
  type RawRow = { route: string; sorters: { name: string } | { name: string }[] | null };
  const map = new Map<string, string>();
  for (const row of (data ?? []) as unknown as RawRow[]) {
    const sorterName = Array.isArray(row.sorters) ? row.sorters[0]?.name : row.sorters?.name;
    if (sorterName) map.set(row.route, sorterName);
  }
  return map;
}

// Trasy z routes, ktore mozna zaproponowac w multi-select: wolne (nigdzie
// nieprzypisane) plus -- przy edycji -- te juz nalezace do edytowanego
// sortujacego (zeby nie znikaly z listy podczas edycji).
export async function fetchAvailableRoutes(currentSorterId?: number): Promise<string[]> {
  const [routesRes, assignedRes] = await Promise.all([
    supabase.from("routes").select("trasa"),
    supabase.from("sorter_routes").select("route, sorter_id"),
  ]);
  if (routesRes.error) throw routesRes.error;
  if (assignedRes.error) throw assignedRes.error;

  const allTrasa = Array.from(new Set((routesRes.data ?? []).map((r) => r.trasa))).sort((a, b) =>
    a.localeCompare(b)
  );
  const assignedToOthers = new Set(
    (assignedRes.data ?? [])
      .filter((r) => r.sorter_id !== currentSorterId)
      .map((r) => r.route)
  );
  return allTrasa.filter((trasa) => !assignedToOthers.has(trasa));
}

export async function createSorter(input: { name: string; routes: string[] }): Promise<void> {
  const { data, error } = await supabase
    .from("sorters")
    .insert({ name: input.name })
    .select("id")
    .single();
  if (error) throw error;

  const sorterId = (data as { id: number }).id;
  await replaceSorterRoutes(sorterId, input.routes);
}

export async function updateSorterName(id: number, name: string): Promise<void> {
  const { error } = await supabase.from("sorters").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function setSorterActive(id: number, active: boolean): Promise<void> {
  const { error } = await supabase.from("sorters").update({ active }).eq("id", id);
  if (error) throw error;
}

// Nadpisuje CALY zestaw tras danego sortujacego (usun + wstaw od nowa) --
// prostsze i wystarczajaco szybkie przy tej skali danych niz liczenie diffu.
export async function replaceSorterRoutes(sorterId: number, routes: string[]): Promise<void> {
  const { error: deleteError } = await supabase.from("sorter_routes").delete().eq("sorter_id", sorterId);
  if (deleteError) throw deleteError;

  if (routes.length === 0) return;

  const { error: insertError } = await supabase
    .from("sorter_routes")
    .insert(routes.map((route) => ({ sorter_id: sorterId, route })));
  if (insertError) throw insertError;
}

export async function deleteSorter(id: number): Promise<void> {
  // sorter_routes ma "on delete cascade" na sorter_id -- usuwaja sie same.
  const { error } = await supabase.from("sorters").delete().eq("id", id);
  if (error) throw error;
}
