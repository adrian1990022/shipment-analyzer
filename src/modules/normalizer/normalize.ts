// Normalizacja pol wspolnych dla obu raportow: klucz joina i data.
// Parser dostarcza surowy tekst; ten modul czyni go porownywalnym.

export function normalizeJoinKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

// "Last Phy Cp dt" bywa w kilku formatach eksportu -- probujemy po kolei
// najczestsze warianty (ISO oraz dd/mm/yyyy lub dd-mm-yyyy, europejski
// zapis daty, zgodny z krajem operacji). Zwraca null, gdy nic nie pasuje,
// zamiast zgadywac (zgodnie z zasada "zadnej magii").
export function parseFlexibleDate(value: string): Date | null {
  const text = value.trim();
  if (!text) return null;

  const isoMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T]?(\d{2}):?(\d{2})?:?(\d{2})?/
  );
  if (isoMatch) {
    const [, y, mo, d, h, mi, s] = isoMatch;
    return new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h ?? 0),
      Number(mi ?? 0),
      Number(s ?? 0)
    );
  }

  const isoDateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const [, y, mo, d] = isoDateOnly;
    return new Date(Number(y), Number(mo) - 1, Number(d));
  }

  const euMatch = text.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})[ T]?(\d{1,2})?:?(\d{2})?:?(\d{2})?/
  );
  if (euMatch) {
    const [, d, mo, y, h, mi, s] = euMatch;
    return new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h ?? 0),
      Number(mi ?? 0),
      Number(s ?? 0)
    );
  }

  return null;
}

export function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
