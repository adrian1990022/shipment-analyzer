// Wspolny odczyt pliku (.xlsx, .xls, .csv) do tablicy wierszy
// reprezentowanych jako Record<naglowek, wartosc-tekstowa>.
// To jedyne miejsce w aplikacji, ktore zna format pliku (SheetJS).
// `xlsx` jest importowany dynamicznie -- jest uzywany tylko na ekranie
// importu, wiec nie powinien obciazac glownego bundla (Dashboard/PWA start).

// Realne eksporty Panorama/Sherloc potrafia miec niespojne spacje w
// naglowkach (np. "Weight (KG) /Dimension (CM)" vs "Weight (KG)/Dimension
// (CM)"). Klucze rowu normalizujemy (bez spacji, lowercase), zeby parser nie
// wywalal sie / nie cichl na takich roznicach -- to jedyne miejsce, gdzie
// trzeba to zrobic, bo wszystkie kolejne moduly czytaja juz znormalizowane
// klucze.
export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "");
}

export async function readWorkbookRows(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  // SheetJS jest bardzo tolerancyjny -- nawet nierozpoznawalne bajty
  // interpretuje jako CSV z jednym arkuszem "Sheet1", wiec SheetNames w
  // praktyce nigdy nie jest puste. Ten guard to czysta obrona (typy
  // SheetJS dopuszczaja pusta liste), nieosiagalna przy realnym wejsciu.
  /* v8 ignore next */
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  return rows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      // sheet_to_json wywolywane z defval:"" gwarantuje, ze value nigdy
      // nie jest null/undefined -- ?? "" to czysto obronny fallback,
      // nieosiagalny przy realnym wejsciu z SheetJS.
      /* v8 ignore next */
      normalized[normalizeHeader(key)] = String(value ?? "").trim();
    }
    return normalized;
  });
}

// Odczyt "wszystko jako tekst bez formatowania" -- dla bazy przypisan tras
// (2026-10-21), gdzie numer przesylki musi przejsc cyfra w cyfre:
//   - CSV: raw:true przy XLSX.read -- wartosci zostaja tekstem (bez tego
//     "0123" w CSV staloby sie liczba 123 i zgubiloby zero wiodace),
//   - XLSX: raw:true przy sheet_to_json -- liczba wprost z komorki, a nie
//     wg formatu wyswietlania (format "Ogolny" pokazuje dlugie liczby jako
//     "1,23457E+11" i gubi cyfry).
// Raporty Panorama/Sherloc czytamy dalej readWorkbookRows -- tam formatowanie
// jest potrzebne (daty).
export async function readWorkbookRowsAsText(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", raw: true });
  const firstSheetName = workbook.SheetNames[0];
  /* v8 ignore next */
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  return rows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      /* v8 ignore next */
      normalized[normalizeHeader(key)] = String(value ?? "").trim();
    }
    return normalized;
  });
}

export function readHeaders(rows: Record<string, string>[]): string[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]);
}
