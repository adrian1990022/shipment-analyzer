import type { Grupa, ImportSummary, Przypisanie, Shipment } from "../../types/shipment";

const EMPTY_GROUP_COUNTS: Record<Grupa, number> = {
  P1: 0,
  P2: 0,
  P3: 0,
  COY004: 0,
  NIEPRZYPISANE: 0,
};

export function summarize(input: {
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  unmappedRows: number;
  recentSkippedRows?: number;
  noDateRows?: number;
  cutoffAt?: string | null;
  shipments: Shipment[];
  przypisanieCounts?: Record<Przypisanie, number>;
  bezSortujacegoRows?: number;
  routeBaseUploadedAt?: string | null;
  panoramaFilename: string;
  sherlocFilename: string;
}): ImportSummary {
  const groupCounts = { ...EMPTY_GROUP_COUNTS };
  for (const shipment of input.shipments) {
    groupCounts[shipment.grupa] += 1;
  }

  return {
    totalRows: input.totalRows,
    matchedRows: input.matchedRows,
    unmatchedRows: input.unmatchedRows,
    unmappedRows: input.unmappedRows,
    resultRows: input.shipments.length,
    recentSkippedRows: input.recentSkippedRows ?? 0,
    noDateRows: input.noDateRows ?? 0,
    cutoffAt: input.cutoffAt ?? null,
    groupCounts,
    przypisanieCounts: input.przypisanieCounts ?? { baza: 0, brak_w_bazie: 0, nieznana_trasa: 0 },
    bezSortujacegoRows: input.bezSortujacegoRows ?? 0,
    routeBaseUploadedAt: input.routeBaseUploadedAt ?? null,
    panoramaFilename: input.panoramaFilename,
    sherlocFilename: input.sherlocFilename,
  };
}
