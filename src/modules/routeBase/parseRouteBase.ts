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

// Ten sam numer z ROZNYMI trasami (2026-10-22): uzytkownik wybiera trase
// albo pomija przesylke (resolveAssignments) -- nie wybieramy arbitralnie.
export interface RouteBaseConflict {
  awb: string;
  // Trasy z pliku (alfabetycznie) z numerami wierszy, w ktorych wystapily.
  options: { route: string; wiersze: number[] }[];
}

// Wybor uzytkownika dla konfliktow: numer -> wybrana trasa albo null
// ("Pomin" -- przesylki nie ma w bazie, trafi do Nieprzypisanych). Brak
// wpisu = konflikt nierozstrzygniety.
export type ConflictChoices = Record<string, string | null>;

export interface RouteBaseValidation {
  // Jednoznaczne przypisania (bez konfliktow): po jednym wpisie na numer.
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
  // Powtorzony wiersz naglowka ("Route" / "AWB/BkgRef") w srodku pliku --
  // pomijany (2026-10-22: realny plik DISCO mial go jako dane).
  headerRows: number;
  // Ten sam numer z ROZNYMI trasami -- do rozstrzygniecia przez uzytkownika
  // przed zapisem (resolveAssignments / canSaveRouteBase).
  conflicts: RouteBaseConflict[];
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
  // numer -> (trasa -> wiersze); wiecej niz jedna trasa = konflikt.
  const rowsByAwb = new Map<string, Map<string, number[]>>();
  const emptyRows: RouteBaseIssue[] = [];
  const invalidRows: RouteBaseIssue[] = [];
  let dataRows = 0;
  let duplicateRows = 0;
  let headerRows = 0;

  rawRows.forEach((raw, index) => {
    const wiersz = index + 2;
    const awbRaw = (raw[COLUMNS.awb] ?? "").trim();
    const routeRaw = (raw[COLUMNS.route] ?? "").trim();
    if (awbRaw === "" && routeRaw === "") return; // calkiem pusty wiersz
    if (normalizeHeader(awbRaw) === COLUMNS.awb && normalizeHeader(routeRaw) === COLUMNS.route) {
      headerRows += 1; // powtorzony naglowek
      return;
    }
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

    const byRoute = rowsByAwb.get(awb) ?? new Map<string, number[]>();
    const wiersze = byRoute.get(route);
    if (wiersze) {
      wiersze.push(wiersz);
      duplicateRows += 1;
    } else {
      byRoute.set(route, [wiersz]);
    }
    rowsByAwb.set(awb, byRoute);
  });

  const assignments: RouteAssignment[] = [];
  const conflicts: RouteBaseConflict[] = [];
  for (const [awb, byRoute] of rowsByAwb) {
    if (byRoute.size === 1) {
      assignments.push({ awb, route: byRoute.keys().next().value as string });
    } else {
      conflicts.push({
        awb,
        options: Array.from(byRoute.entries())
          .map(([route, wiersze]) => ({ route, wiersze }))
          .sort((a, b) => a.route.localeCompare(b.route)),
      });
    }
  }

  return { assignments, dataRows, duplicateRows, emptyRows, invalidRows, headerRows, conflicts };
}

// Ile konfliktow nie ma jeszcze wyboru (trasa z pliku albo "Pomin").
export function unresolvedConflicts(validation: RouteBaseValidation, choices: ConflictChoices): number {
  return validation.conflicts.filter((c) => {
    const choice = choices[c.awb];
    return choice === undefined || (choice !== null && !c.options.some((o) => o.route === choice));
  }).length;
}

// Przypisania do zapisu: jednoznaczne + wybrane w konfliktach ("Pomin" i
// nierozstrzygniete -- poza baza).
export function resolveAssignments(validation: RouteBaseValidation, choices: ConflictChoices): RouteAssignment[] {
  const chosen: RouteAssignment[] = [];
  for (const c of validation.conflicts) {
    const choice = choices[c.awb];
    if (choice && c.options.some((o) => o.route === choice)) chosen.push({ awb: c.awb, route: choice });
  }
  return [...validation.assignments, ...chosen];
}

// Czy baze mozna zapisac: bez blednych wierszy, kazdy konflikt rozstrzygniety,
// co najmniej jedno przypisanie i w limicie.
export function canSaveRouteBase(validation: RouteBaseValidation, choices: ConflictChoices): boolean {
  const count = resolveAssignments(validation, choices).length;
  return (
    validation.invalidRows.length === 0 &&
    unresolvedConflicts(validation, choices) === 0 &&
    count > 0 &&
    count <= MAX_ROUTE_BASE_ROWS
  );
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
  const total = validation.assignments.length + validation.conflicts.length;
  if (total > MAX_ROUTE_BASE_ROWS) {
    throw new RouteBaseError(`Plik ma ${total} przypisań — więcej niż dopuszczalne ${MAX_ROUTE_BASE_ROWS}.`);
  }
  return validation;
}
