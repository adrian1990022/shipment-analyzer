import type { JoinedRow } from "../joiner/joinReports";
import { parseFlexibleDate } from "../normalizer/normalize";

// Przesylki zeskanowane w ciagu tylu minut przed godzina wpisana przy
// imporcie sa pomijane -- "swieze" skany, ktore jeszcze moga sie
// rozwiazac same (decyzja Adriana 2026-09-25). Wszystko starsze zostaje,
// niezaleznie od dnia -- starsze przesylki sa celowo zachowywane.
export const RECENT_SCAN_WINDOW_MINUTES = 15;

export interface ScanCutoffResult {
  keptRows: JoinedRow[];
  // Ostatni skan w oknie 15 minut przed wpisana godzina (albo pozniej).
  recentCount: number;
  // Brak/niepoprawna data ostatniego skanu -- nie da sie ocenic reguly
  // 15 minut, wiec (jak wczesniej przy filtrze "tylko dzis") pomijane.
  noDateCount: number;
}

// "HH:mm" wpisane przy imporcie -> moment odciecia: dzisiaj (zegar
// urzadzenia) o tej godzinie minus RECENT_SCAN_WINDOW_MINUTES. null dla
// niepoprawnej godziny.
export function buildScanCutoff(timeHHmm: string, now: Date = new Date()): Date | null {
  const match = timeHHmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const reference = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  return new Date(reference.getTime() - RECENT_SCAN_WINDOW_MINUTES * 60 * 1000);
}

// Zostawia wiersze z ostatnim skanem SCISLE przed momentem odciecia.
// Skany w oknie 15 minut i pozniejsze niz wpisana godzina sa pomijane.
export function filterByScanCutoff(rows: JoinedRow[], cutoff: Date): ScanCutoffResult {
  let recentCount = 0;
  let noDateCount = 0;

  const keptRows = rows.filter((row) => {
    const parsed = parseFlexibleDate(row.panorama.lastPhyCpDt);
    if (!parsed) {
      noDateCount += 1;
      return false;
    }
    if (parsed.getTime() >= cutoff.getTime()) {
      recentCount += 1;
      return false;
    }
    return true;
  });

  return { keptRows, recentCount, noDateCount };
}
