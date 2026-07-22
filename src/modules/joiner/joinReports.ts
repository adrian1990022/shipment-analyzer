import type { PanoramaRow, SherlocRow } from "../../types/report";
import { normalizeJoinKey } from "../normalizer/normalize";

export interface JoinedRow {
  panorama: PanoramaRow;
  sherloc: SherlocRow | null;
}

export interface JoinResult {
  rows: JoinedRow[];
  matchedCount: number;
  unmatchedCount: number;
}

// Panorama.Shipment ID = Sherloc.HWB No.
// Panorama jest strona bazowa (ma daty i Chute ID potrzebne dalej w
// pipeline), Sherloc dolacza dane adresowe/odbiorcy tam, gdzie jest dopasowanie.
export function joinReports(panoramaRows: PanoramaRow[], sherlocRows: SherlocRow[]): JoinResult {
  const sherlocByKey = new Map<string, SherlocRow>();
  for (const row of sherlocRows) {
    sherlocByKey.set(normalizeJoinKey(row.hwbNo), row);
  }

  let matchedCount = 0;
  let unmatchedCount = 0;

  const rows = panoramaRows.map((panorama) => {
    const sherloc = sherlocByKey.get(normalizeJoinKey(panorama.shipmentId)) ?? null;
    if (sherloc) matchedCount += 1;
    else unmatchedCount += 1;
    return { panorama, sherloc };
  });

  return { rows, matchedCount, unmatchedCount };
}
