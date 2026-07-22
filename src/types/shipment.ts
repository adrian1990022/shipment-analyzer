export type Grupa = "P1" | "P2" | "P3" | "COY004";

// Wynik pelnego pipeline'u (join + filtr daty + mapowanie tras).
// To jest ksztalt wiersza zapisywanego do public.shipments.
export interface Shipment {
  shipmentId: string;
  remarks: string;
  hwx: string;
  lastPhyCp: string;
  lastPhyCpDt: string | null;
  weightDimension: string;
  shpCalcWgt: number | null;
  consigneeName: string;
  chuteId: string;
  receiverName: string;
  rcvrAddr1: string;
  rcvrPostcode: string;
  rcvrCity: string;
  trasa: string;
  grupa: Grupa;
  sortujacy: string;
}

export interface RouteRef {
  id: number;
  chuteId: string;
  trasa: string;
  grupa: "P1" | "P2" | "P3";
  createdAt: string;
  updatedAt: string;
}

export interface ImportSummary {
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  unmappedRows: number;
  todayRows: number;
  groupCounts: Record<Grupa, number>;
  panoramaFilename: string;
  sherlocFilename: string;
}

export interface ImportResult {
  summary: ImportSummary;
  shipments: Shipment[];
  unmappedChuteIds: string[];
}
