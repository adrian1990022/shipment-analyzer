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
    todayRows: input.shipments.length,
    groupCounts,
    panoramaFilename: input.panoramaFilename,
    sherlocFilename: input.sherlocFilename,
  };
}
