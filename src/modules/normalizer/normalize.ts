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

// "lastPhyCpDt" jest budowane (mapRoutes.ts) jako
// parseFlexibleDate(...).toISOString() -- lokalne skladowe czasu
// zserializowane do UTC. Odczyt lokalnymi getterami (nie UTC) odwraca to
// bezstratnie w tej samej przegladarce/sesji -- ten sam mechanizm co
// isSameLocalDay powyzej. Zero sekund/strefy czasowej w wyniku (Sprint UX 1.1).
export function formatTimeHHmm(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Jak formatTimeHHmm, ale zwraca date-only klucz (YYYY-MM-DD) w lokalnym
// czasie -- uzywane jako "shipment_date" przy zapisie/odczycie
// shipment_actions (Sprint UX 1.1).
export function toLocalDateKey(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Zwykle localeCompare sortuje "Sortujący 10" przed "Sortujący 2" (porownanie
// znak po znaku). Intl.Collator z numeric:true rozpoznaje liczby wewnatrz
// tekstu i porownuje je jako liczby -- dziala tak samo dobrze dla samych
// liczb ("1".."17") jak i dla prawdziwych imion/nazwisk bez cyfr.
const naturalCollator = new Intl.Collator("pl", { numeric: true, sensitivity: "base" });

export function naturalCompare(a: string, b: string): number {
  return naturalCollator.compare(a, b);
}
