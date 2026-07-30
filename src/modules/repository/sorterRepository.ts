import { supabase } from "../../lib/supabaseClient";
import { reportError } from "../monitoring/reportError";
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
  if (sortersRes.error) {
    reportError(sortersRes.error, { module: "sorterRepository", stage: "fetchSorters:sorters" });
    throw sortersRes.error;
  }
  if (routesRes.error) {
    reportError(routesRes.error, { module: "sorterRepository", stage: "fetchSorters:sorter_routes" });
    throw routesRes.error;
  }

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

// Pojedynczy sortujacy do ekranu edycji -- prosciej i wystarczajaco
// szybko przy tej skali danych, zeby wykorzystac ten sam fetchSorters()
// zamiast duplikowac logike joina.
export async function fetchSorterById(id: number): Promise<SorterWithRoutes | null> {
  const all = await fetchSorters();
  return all.find((s) => s.id === id) ?? null;
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
  if (error) {
    reportError(error, { module: "sorterRepository", stage: "fetchSorterNameByTrasa" });
    throw error;
  }

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

export interface RouteAssignmentStatus {
  trasa: string;
  // null = wolna. Inaczej id sortujacego, do ktorego trasa jest juz
  // przypisana (moze byc innym niz aktualnie edytowany).
  assignedToSorterId: number | null;
}

// Status KAZDEJ trasy z routes wzgledem sorter_routes -- do pokolorowania
// selektora w SorterForm (wolna / zajeta przez kogos innego). W
// przeciwienstwie do dawnego fetchAvailableRoutes nic tu nie jest
// odfiltrowywane -- filtrowanie "nie pokazuj wlasnych" robi juz SorterForm,
// zeby ten modul zostal prostym odczytem stanu, a nie decyzja UI.
export async function fetchRouteAssignmentStatus(): Promise<RouteAssignmentStatus[]> {
  const [routesRes, assignedRes] = await Promise.all([
    supabase.from("routes").select("trasa"),
    supabase.from("sorter_routes").select("route, sorter_id"),
  ]);
  if (routesRes.error) {
    reportError(routesRes.error, { module: "sorterRepository", stage: "fetchRouteAssignmentStatus:routes" });
    throw routesRes.error;
  }
  if (assignedRes.error) {
    reportError(assignedRes.error, {
      module: "sorterRepository",
      stage: "fetchRouteAssignmentStatus:sorter_routes",
    });
    throw assignedRes.error;
  }

  const assignedBySorter = new Map<string, number>();
  for (const row of assignedRes.data ?? []) {
    assignedBySorter.set(row.route, row.sorter_id);
  }

  const allTrasa = Array.from(new Set((routesRes.data ?? []).map((r) => r.trasa))).sort((a, b) =>
    a.localeCompare(b)
  );
  return allTrasa.map((trasa) => ({
    trasa,
    assignedToSorterId: assignedBySorter.get(trasa) ?? null,
  }));
}

export async function createSorter(input: { name: string; routes: string[] }): Promise<void> {
  const { data, error } = await supabase
    .from("sorters")
    .insert({ name: input.name })
    .select("id")
    .single();
  if (error) {
    reportError(error, { module: "sorterRepository", stage: "createSorter" });
    throw error;
  }

  const sorterId = (data as { id: number }).id;
  await replaceSorterRoutes(sorterId, input.routes);
}

export async function updateSorterName(id: number, name: string): Promise<void> {
  const { error } = await supabase.from("sorters").update({ name }).eq("id", id);
  if (error) {
    reportError(error, { module: "sorterRepository", stage: "updateSorterName" });
    throw error;
  }
}

export async function setSorterActive(id: number, active: boolean): Promise<void> {
  const { error } = await supabase.from("sorters").update({ active }).eq("id", id);
  if (error) {
    reportError(error, { module: "sorterRepository", stage: "setSorterActive" });
    throw error;
  }
}

// Nadpisuje CALY zestaw tras danego sortujacego: usun jego stare wiersze,
// potem upsert nowego zestawu po "route" (nie insert!) -- jesli ktoras
// trasa nalezala do INNEGO sortujacego, upsert po prostu przepisuje jej
// sorter_id, zamiast wywalic blad unique constraint. To swiadomie
// umozliwia "przejecie" trasy widocznej jako zajeta (na czerwono) w
// selektorze SorterForm.
export async function replaceSorterRoutes(sorterId: number, routes: string[]): Promise<void> {
  const { error: deleteError } = await supabase.from("sorter_routes").delete().eq("sorter_id", sorterId);
  if (deleteError) {
    reportError(deleteError, { module: "sorterRepository", stage: "replaceSorterRoutes:delete" });
    throw deleteError;
  }

  if (routes.length === 0) return;

  const { error: upsertError } = await supabase
    .from("sorter_routes")
    .upsert(
      routes.map((route) => ({ sorter_id: sorterId, route })),
      { onConflict: "route" }
    );
  if (upsertError) {
    reportError(upsertError, { module: "sorterRepository", stage: "replaceSorterRoutes:upsert" });
    throw upsertError;
  }
}

export async function deleteSorter(id: number): Promise<void> {
  // sorter_routes ma "on delete cascade" na sorter_id -- usuwaja sie same.
  const { error } = await supabase.from("sorters").delete().eq("id", id);
  if (error) {
    reportError(error, { module: "sorterRepository", stage: "deleteSorter" });
    throw error;
  }
}
