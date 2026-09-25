import type { Grupa, ImportSummary, Shipment } from "../../types/shipment";

const EMPTY_GROUP_COUNTS: Record<Grupa, number> = {
  P1: 0,
  P2: 0,
  P3: 0,
  COY004: 0,
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
    panoramaFilename: input.panoramaFilename,
    sherlocFilename: input.sherlocFilename,
  };
}
