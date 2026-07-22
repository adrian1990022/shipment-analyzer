import type { PanoramaRow } from "../../types/report";

// Kolejnosc / obecnosc kolumn wg specyfikacji raportu Panorama.
const COLUMNS = {
  shipmentId: "Shipment ID",
  remarks: "Remarks",
  hwx: "HWX?",
  lastPhyCp: "Last Phy Cp",
  lastPhyCpDt: "Last Phy Cp dt",
  weightDimension: "Weight (KG)/Dimension (CM)",
  shpCalcWgt: "Shp Calc Wgt (KG)",
  consigneeName: "Consignee Name",
  chuteId: "Chute ID",
} as const;

export function parsePanoramaRows(rawRows: Record<string, string>[]): PanoramaRow[] {
  return rawRows
    .map((raw) => ({
      shipmentId: raw[COLUMNS.shipmentId] ?? "",
      remarks: raw[COLUMNS.remarks] ?? "",
      hwx: raw[COLUMNS.hwx] ?? "",
      lastPhyCp: raw[COLUMNS.lastPhyCp] ?? "",
      lastPhyCpDt: raw[COLUMNS.lastPhyCpDt] ?? "",
      weightDimension: raw[COLUMNS.weightDimension] ?? "",
      shpCalcWgt: raw[COLUMNS.shpCalcWgt] ?? "",
      consigneeName: raw[COLUMNS.consigneeName] ?? "",
      chuteId: raw[COLUMNS.chuteId] ?? "",
    }))
    .filter((row) => row.shipmentId !== "");
}
