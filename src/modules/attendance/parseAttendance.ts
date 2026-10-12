// Rozpoznawanie wklejonej listy obecnosci (2026-10-13). Admin kopiuje
// kolumne z Excela: "Jan Kowalski_1", "Jan Kowalski_2", ... -- imie
// i nazwisko, podkreslnik, dzien miesiaca. Imie i nazwisko dopasowujemy do
// sorters.full_name (bez wzgledu na wielkosc liter i nadmiarowe spacje;
// polskie znaki musza sie zgadzac). Czysta funkcja -- bez bazy, testowalna.

export interface AttendanceSorterRef {
  id: number;
  name: string;
  fullName: string | null;
}

export interface AttendanceEntry {
  sorterId: number;
  day: number;
}

export interface AttendanceParseResult {
  entries: AttendanceEntry[];
  // Najpozniejszy dzien we wklejce (null = brak poprawnych wpisow) -- do
  // niego siegaja dane; po nim kurier pokazuje "jeszcze nie wgrane".
  lastDay: number | null;
  // Rozpoznani: nazwa sortujacego -> liczba dni.
  recognized: { sorterId: number; name: string; fullName: string; days: number }[];
  // Imie i nazwisko bez sortujacego w tabeli "Sortujacy" (wpisy pominiete).
  unknown: { fullName: string; count: number }[];
  // Imie i nazwisko pasujace do kilku sortujacych (wpisy pominiete).
  ambiguous: { fullName: string; count: number }[];
  // Linie bez wzoru "tekst_dzien" albo z dniem spoza miesiaca.
  invalid: string[];
  // Powtorzone wpisy (ta sama osoba, ten sam dzien) -- liczone raz.
  duplicates: number;
}

const ENTRY = /^(.+?)\s*_\s*(\d{1,2})$/;

export function normalizeFullName(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("pl");
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// month: 1-12.
export function parseAttendance(
  text: string,
  year: number,
  month: number,
  sorters: AttendanceSorterRef[]
): AttendanceParseResult {
  const maxDay = daysInMonth(year, month);

  const byFullName = new Map<string, AttendanceSorterRef[]>();
  for (const s of sorters) {
    if (!s.fullName) continue;
    const key = normalizeFullName(s.fullName);
    if (!key) continue;
    byFullName.set(key, [...(byFullName.get(key) ?? []), s]);
  }

  const seen = new Set<string>();
  const entries: AttendanceEntry[] = [];
  const unknown = new Map<string, { fullName: string; count: number }>();
  const ambiguous = new Map<string, { fullName: string; count: number }>();
  const invalid: string[] = [];
  const daysBySorter = new Map<number, number>();
  let duplicates = 0;
  let lastDay: number | null = null;

  // Kolumna z Excela = linie; przy kilku kolumnach -- tabulatory.
  const tokens = text
    .split(/[\r\n\t]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const match = ENTRY.exec(token);
    const day = match ? Number(match[2]) : NaN;
    if (!match || day < 1 || day > maxDay) {
      invalid.push(token);
      continue;
    }
    const displayName = match[1].replace(/\s+/g, " ").trim();
    const key = normalizeFullName(displayName);
    const candidates = byFullName.get(key) ?? [];
    if (candidates.length === 0) {
      const u = unknown.get(key) ?? { fullName: displayName, count: 0 };
      u.count += 1;
      unknown.set(key, u);
      continue;
    }
    if (candidates.length > 1) {
      const a = ambiguous.get(key) ?? { fullName: displayName, count: 0 };
      a.count += 1;
      ambiguous.set(key, a);
      continue;
    }
    const sorterId = candidates[0].id;
    const dedupKey = `${sorterId}:${day}`;
    if (seen.has(dedupKey)) {
      duplicates += 1;
      continue;
    }
    seen.add(dedupKey);
    entries.push({ sorterId, day });
    daysBySorter.set(sorterId, (daysBySorter.get(sorterId) ?? 0) + 1);
    if (lastDay === null || day > lastDay) lastDay = day;
  }

  const recognized = sorters
    .filter((s) => daysBySorter.has(s.id))
    .map((s) => ({ sorterId: s.id, name: s.name, fullName: s.fullName ?? "", days: daysBySorter.get(s.id) ?? 0 }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pl"));

  return {
    entries,
    lastDay,
    recognized,
    unknown: [...unknown.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, "pl")),
    ambiguous: [...ambiguous.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, "pl")),
    invalid,
    duplicates,
  };
}
