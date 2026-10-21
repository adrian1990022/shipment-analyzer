import { normalizeHeader, readWorkbookRowsAsText } from "../parser/parseWorkbook";
import { normalizeJoinKey } from "../normalizer/normalize";

// Baza przypisan tras (2026-10-21, decyzja Adriana): plik Excel z dwiema
// kolumnami -- "Route" (trasa) i "AWB/BkgRef" (numer przesylki = Shipment
// ID z Panoramy). Kolejnosc kolumn dowolna, naglowki porownywane bez
// wzgledu na wielkosc liter i spacje (normalizeHeader). Dodatkowe kolumny
// sa ignorowane.
//
// Ten modul tylko CZYTA i SPRAWDZA plik -- zapis robi funkcja bazy
// replace_route_assignments (migracja 0016), ktora sprawdza dane drugi raz.
// Kopia w kurier_appp: scripts/sync-shipment-pipeline.mjs.

const COLUMNS = {
  route: normalizeHeader("Route"),
  awb: normalizeHeader("AWB/BkgRef"),
} as const;

// Te same limity co w bazie (route_assignments, replace_route_assignments).
export const MAX_ROUTE_BASE_ROWS = 20000;
const MAX_AWB_LENGTH = 64;
const MAX_ROUTE_LENGTH = 16;

export class RouteBaseError extends Error {}

export interface RouteAssignment {
  // Znormalizowany jak Shipment ID przy dopasowaniu (normalizeJoinKey).
  awb: string;
  // Bez bialych znakow na brzegach, wielkie litery.
  route: string;
}

export interface RouteBaseIssue {
  // Numer wiersza jak w Excelu (naglowek = 1).
  wiersz: number;
  opis: string;
}

export interface RouteBaseConflict {
  awb: string;
  routes: string[];
}

export interface RouteBaseValidation {
  // Gotowe do zapisu: po jednym wpisie na numer przesylki.
  assignments: RouteAssignment[];
  // Wiersze z danymi w pliku (bez calkiem pustych).
  dataRows: number;
  // Identyczne pary numer+trasa powtorzone w pliku -- scalane w jeden wpis
  // (nie zmieniaja wyniku dopasowania).
  duplicateRows: number;
  // Wiersze z pustym numerem albo pusta trasa -- pomijane (nie sa
  // przypisaniem), pokazywane w podsumowaniu.
  emptyRows: RouteBaseIssue[];
  // Bledy blokujace zapis: numer w zapisie naukowym (Excel zgubil cyfry),
  // za dlugie wartosci.
  invalidRows: RouteBaseIssue[];
  // Ten sam numer z ROZNYMI trasami -- blokuje zapis (nie wybieramy trasy
  // arbitralnie).
  conflicts: RouteBaseConflict[];
  // Czy baze mozna zapisac.
  canSave: boolean;
}

// "1,23457E+11" / "1.2e+11" -- Excel pokazal dluga liczbe w zapisie
// naukowym, cyfry przepadly juz w pliku.
const SCIENTIFIC = /^\d+([.,]\d+)?e[+-]?\d+$/i;

export function normalizeRoute(value: string): string {
  return value.trim().toUpperCase();
}

// Walidacja wierszy (czysta funkcja). rawRows: klucze juz znormalizowane
// (normalizeHeader), wartosci tekstowe -- jak z readWorkbookRowsAsText.
export function validateRouteBaseRows(rawRows: Record<string, string>[]): RouteBaseValidation {
  const routeByAwb = new Map<string, string>();
  const conflictRoutes = new Map<string, Set<string>>();
  const emptyRows: RouteBaseIssue[] = [];
  const invalidRows: RouteBaseIssue[] = [];
  let dataRows = 0;
  let duplicateRows = 0;

  rawRows.forEach((raw, index) => {
    const wiersz = index + 2;
    const awbRaw = (raw[COLUMNS.awb] ?? "").trim();
    const routeRaw = (raw[COLUMNS.route] ?? "").trim();
    if (awbRaw === "" && routeRaw === "") return; // calkiem pusty wiersz
    dataRows += 1;

    if (awbRaw === "" || routeRaw === "") {
      emptyRows.push({
        wiersz,
        opis: awbRaw === "" ? "pusty numer przesyłki (AWB/BkgRef)" : "pusta trasa (Route)",
      });
      return;
    }
    if (SCIENTIFIC.test(awbRaw)) {
      invalidRows.push({
        wiersz,
        opis: `numer przesyłki w zapisie naukowym (${awbRaw}) — ustaw w Excelu format kolumny „Tekst” i wyeksportuj plik ponownie`,
      });
      return;
    }

    const awb = normalizeJoinKey(awbRaw);
    const route = normalizeRoute(routeRaw);
    if (awb.length > MAX_AWB_LENGTH) {
      invalidRows.push({ wiersz, opis: `numer przesyłki dłuższy niż ${MAX_AWB_LENGTH} znaki` });
      return;
    }
    if (route.length > MAX_ROUTE_LENGTH) {
      invalidRows.push({ wiersz, opis: `trasa dłuższa niż ${MAX_ROUTE_LENGTH} znaków (${route.slice(0, 20)}…)` });
      return;
    }

    const existing = routeByAwb.get(awb);
    if (existing === undefined) {
      routeByAwb.set(awb, route);
    } else if (existing === route) {
      duplicateRows += 1;
    } else {
      const set = conflictRoutes.get(awb) ?? new Set([existing]);
      set.add(route);
      conflictRoutes.set(awb, set);
    }
  });

  const conflicts = Array.from(conflictRoutes.entries()).map(([awb, routes]) => ({
    awb,
    routes: Array.from(routes).sort(),
  }));
  const assignments = Array.from(routeByAwb.entries())
    .filter(([awb]) => !conflictRoutes.has(awb))
    .map(([awb, route]) => ({ awb, route }));

  return {
    assignments,
    dataRows,
    duplicateRows,
    emptyRows,
    invalidRows,
    conflicts,
    canSave:
      conflicts.length === 0 &&
      invalidRows.length === 0 &&
      assignments.length > 0 &&
      assignments.length <= MAX_ROUTE_BASE_ROWS,
  };
}

// Czyta plik i sprawdza naglowki. Zla struktura (brak ktorejs kolumny,
// pusty plik) -> RouteBaseError z przyczyna dla uzytkownika.
export async function parseRouteBaseFile(file: File): Promise<RouteBaseValidation> {
  const rows = await readWorkbookRowsAsText(file);
  if (rows.length === 0) {
    throw new RouteBaseError(`Plik "${file.name}" nie zawiera żadnych wierszy z danymi.`);
  }
  const headers = new Set(Object.keys(rows[0]));
  const missing = [
    ...(headers.has(COLUMNS.route) ? [] : ["Route"]),
    ...(headers.has(COLUMNS.awb) ? [] : ["AWB/BkgRef"]),
  ];
  if (missing.length > 0) {
    throw new RouteBaseError(
      `Plik "${file.name}" nie ma wymaganych kolumn: ${missing.join(", ")}. Potrzebne są kolumny „Route” i „AWB/BkgRef”.`
    );
  }
  const validation = validateRouteBaseRows(rows);
  if (validation.assignments.length > MAX_ROUTE_BASE_ROWS) {
    throw new RouteBaseError(
      `Plik ma ${validation.assignments.length} przypisań — więcej niż dopuszczalne ${MAX_ROUTE_BASE_ROWS}.`
    );
  }
  return validation;
}
