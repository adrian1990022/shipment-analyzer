import { toLocalDateKey } from "../normalizer/normalize";
import type { Grupa, ImportResult, Przypisanie, Shipment } from "../../types/shipment";

// Wiersz tabeli shipments w ksztalcie, jaki przyjmuje funkcja bazy
// import_shipments (migracja 0011) -- bez id/import_id/created_at, ktore
// nadaje baza.
export interface ShipmentInsertRow {
  shipment_id: string;
  remarks: string | null;
  hwx: string | null;
  last_phy_cp: string | null;
  last_phy_cp_dt: string | null;
  weight_dimension: string | null;
  shp_calc_wgt: number | null;
  shp_tot_pcs: number | null;
  consignee_name: string | null;
  chute_id: string | null;
  receiver_name: string | null;
  rcvr_addr1: string | null;
  rcvr_postcode: string | null;
  rcvr_city: string | null;
  trasa: string;
  grupa: Grupa;
  sortujacy: string;
  wystapilo: number;
  przypisanie: Przypisanie | null;
}

// Wiersz tabeli imports (metadane importu). today_rows to nazwa historyczna
// kolumny -- trzyma ImportSummary.resultRows.
export interface ImportInsertRow {
  panorama_filename: string;
  sherloc_filename: string;
  total_rows: number;
  matched_rows: number;
  unmatched_rows: number;
  unmapped_rows: number;
  today_rows: number;
  group_counts: Record<Grupa, number>;
}

// Argumenty funkcji bazy import_shipments -- JEDNO miejsce budowania dla
// obu aplikacji: shipment (shipmentsRepository.saveImport) i kurier_appp
// (kopia tego modulu -> api/shipment-import.js przekazuje je bez zmian).
export interface ImportPayload {
  p_import: ImportInsertRow;
  p_shipments: ShipmentInsertRow[];
  p_prune_before: string;
}

export function toShipmentRow(shipment: Shipment): ShipmentInsertRow {
  return {
    shipment_id: shipment.shipmentId,
    remarks: shipment.remarks || null,
    hwx: shipment.hwx || null,
    last_phy_cp: shipment.lastPhyCp || null,
    last_phy_cp_dt: shipment.lastPhyCpDt,
    weight_dimension: shipment.weightDimension || null,
    shp_calc_wgt: shipment.shpCalcWgt,
    shp_tot_pcs: shipment.shpTotPcs,
    consignee_name: shipment.consigneeName || null,
    chute_id: shipment.chuteId || null,
    receiver_name: shipment.receiverName || null,
    rcvr_addr1: shipment.rcvrAddr1 || null,
    rcvr_postcode: shipment.rcvrPostcode || null,
    rcvr_city: shipment.rcvrCity || null,
    trasa: shipment.trasa,
    grupa: shipment.grupa,
    sortujacy: shipment.sortujacy,
    wystapilo: shipment.wystapilo,
    przypisanie: shipment.przypisanie,
  };
}

// Najstarszy dzien skanu w wyniku (albo dzisiaj, jesli wczesniejszy) --
// granica czyszczenia shipment_actions: oznaczenia "Obsluzono" z dni wciaz
// obecnych w raporcie musza przetrwac (retencja od 2026-09-25).
export function pruneBeforeDateKey(shipments: Shipment[], now: Date = new Date()): string {
  let oldest = toLocalDateKey(now.toISOString())!;
  for (const s of shipments) {
    const key = toLocalDateKey(s.lastPhyCpDt);
    if (key && key < oldest) oldest = key;
  }
  return oldest;
}

export function buildImportPayload(result: ImportResult, now: Date = new Date()): ImportPayload {
  const { summary, shipments } = result;
  return {
    p_import: {
      panorama_filename: summary.panoramaFilename,
      sherloc_filename: summary.sherlocFilename,
      total_rows: summary.totalRows,
      matched_rows: summary.matchedRows,
      unmatched_rows: summary.unmatchedRows,
      unmapped_rows: summary.unmappedRows,
      today_rows: summary.resultRows,
      group_counts: summary.groupCounts,
    },
    p_shipments: shipments.map(toShipmentRow),
    p_prune_before: pruneBeforeDateKey(shipments, now),
  };
}
