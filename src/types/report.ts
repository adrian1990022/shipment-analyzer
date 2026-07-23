// Surowe wiersze bezposrednio z parsera -- Parser nie zna mapy tras,
// wiec nie ma tu pol "trasa"/"grupa"/"sortujacy".

export interface PanoramaRow {
  shipmentId: string;
  remarks: string;
  hwx: string;
  lastPhyCp: string;
  lastPhyCpDt: string;
  weightDimension: string;
  shpCalcWgt: string;
  shpTotPcs: string;
  consigneeName: string;
  chuteId: string;
}

export interface SherlocRow {
  hwbNo: string;
  receiverName: string;
  rcvrAddr1: string;
  rcvrPostcode: string;
  rcvrCity: string;
}

export type ReportKind = "panorama" | "sherloc";

export interface DetectedReport {
  kind: ReportKind;
  headers: string[];
}
