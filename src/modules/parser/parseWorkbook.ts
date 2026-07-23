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
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  return rows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = String(value ?? "").trim();
    }
    return normalized;
  });
}

export function readHeaders(rows: Record<string, string>[]): string[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]);
}
