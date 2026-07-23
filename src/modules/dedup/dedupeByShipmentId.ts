import type { JoinedRow } from "../joiner/joinReports";

export interface DedupeResult {
  // Po jednym wierszu na Shipment ID (pierwsze wystapienie w danych
  // dzisiejszych zachowane jako reprezentant).
  rows: JoinedRow[];
  // Shipment ID -> ile razy wystapil w danych wejsciowych do tego kroku.
  occurrenceCounts: Map<string, number>;
}

// Ten sam Shipment ID moze wystapic w raporcie Panorama wiecej niz raz
// (np. wielokrotny skan tego samego dnia). Zeby w tabeli i w bazie nie
// bylo duplikatow, zliczamy wystapienia i zostawiamy jeden reprezentatywny
// wiersz -- licznik trafia do pola "wystapilo".
export function dedupeByShipmentId(rows: JoinedRow[]): DedupeResult {
  const occurrenceCounts = new Map<string, number>();
  const firstSeen = new Map<string, JoinedRow>();

  for (const row of rows) {
    const id = row.panorama.shipmentId;
    occurrenceCounts.set(id, (occurrenceCounts.get(id) ?? 0) + 1);
    if (!firstSeen.has(id)) {
      firstSeen.set(id, row);
    }
  }

  return { rows: Array.from(firstSeen.values()), occurrenceCounts };
}
