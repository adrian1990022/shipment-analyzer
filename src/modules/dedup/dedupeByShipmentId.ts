import type { JoinedRow } from "../joiner/joinReports";
import { parseFlexibleDate } from "../normalizer/normalize";

export interface DedupeResult {
  // Po jednym wierszu na Shipment ID -- reprezentantem jest wiersz z
  // NAJNOWSZYM skanem (Last Phy Cp dt), przy remisie/braku daty pierwsze
  // wystapienie w pliku.
  rows: JoinedRow[];
  // Shipment ID -> ile razy wystapil w danych wejsciowych do tego kroku.
  occurrenceCounts: Map<string, number>;
}

function scanTime(row: JoinedRow): number {
  return parseFlexibleDate(row.panorama.lastPhyCpDt)?.getTime() ?? -Infinity;
}

// Ten sam Shipment ID moze wystapic w raporcie Panorama wiecej niz raz
// (np. wielokrotny skan). Zeby w tabeli i w bazie nie bylo duplikatow,
// zliczamy wystapienia i zostawiamy jeden reprezentatywny wiersz -- licznik
// trafia do pola "wystapilo".
//
// Od 2026-09-25 plik nie jest juz zawezany do dzisiejszego dnia, a regula
// 15 minut (filterByScanCutoff) dotyczy OSTATNIEGO skanu -- dlatego
// reprezentantem jest najnowszy skan, nie pierwszy wiersz w pliku.
export function dedupeByShipmentId(rows: JoinedRow[]): DedupeResult {
  const occurrenceCounts = new Map<string, number>();
  const latest = new Map<string, JoinedRow>();

  for (const row of rows) {
    const id = row.panorama.shipmentId;
    occurrenceCounts.set(id, (occurrenceCounts.get(id) ?? 0) + 1);
    const current = latest.get(id);
    if (!current || scanTime(row) > scanTime(current)) {
      latest.set(id, row);
    }
  }

  return { rows: Array.from(latest.values()), occurrenceCounts };
}
