import type { PanoramaRow } from "../../types/report";
import { normalizeHeader } from "./parseWorkbook";

// Kolejnosc / obecnosc kolumn wg specyfikacji raportu Panorama. Klucze sa
// znormalizowane (patrz parseWorkbook.normalizeHeader), zeby drobne roznice
// spacji w realnym eksporcie nie psuly dopasowania.
const COLUMNS = {
  shipmentId: normalizeHeader("Shipment ID"),
  remarks: normalizeHeader("Remarks"),
  hwx: normalizeHeader("HWX?"),
  lastPhyCp: normalizeHeader("Last Phy Cp"),
  lastPhyCpDt: normalizeHeader("Last Phy Cp dt"),
  weightDimension: normalizeHeader("Weight (KG)/Dimension (CM)"),
  shpCalcWgt: normalizeHeader("Shp Calc Wgt (KG)"),
  shpTotPcs: normalizeHeader("Shp Tot Pcs"),
  consigneeName: normalizeHeader("Consignee Name"),
  chuteId: normalizeHeader("Chute ID"),
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
      shpTotPcs: raw[COLUMNS.shpTotPcs] ?? "",
      consigneeName: raw[COLUMNS.consigneeName] ?? "",
      chuteId: raw[COLUMNS.chuteId] ?? "",
    }))
    .filter((row) => row.shipmentId !== "");
}
