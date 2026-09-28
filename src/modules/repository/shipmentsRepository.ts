import { supabase } from "../../lib/supabaseClient";
import { reportError } from "../monitoring/reportError";
import type { ImportResult, Shipment } from "../../types/shipment";
import { buildImportPayload, type ShipmentInsertRow } from "../import/importPayload";

// Wiersz odczytany z tabeli shipments -- ksztalt zapisu (importPayload.ts)
// plus import_id nadawane przez baze.
type ShipmentRow = ShipmentInsertRow & { import_id: number | null };

function fromRow(row: ShipmentRow & { id: number }): Shipment {
  return {
    shipmentId: row.shipment_id,
    remarks: row.remarks ?? "",
    hwx: row.hwx ?? "",
    lastPhyCp: row.last_phy_cp ?? "",
    lastPhyCpDt: row.last_phy_cp_dt,
    weightDimension: row.weight_dimension ?? "",
    shpCalcWgt: row.shp_calc_wgt,
    shpTotPcs: row.shp_tot_pcs,
    consigneeName: row.consignee_name ?? "",
    chuteId: row.chute_id ?? "",
    receiverName: row.receiver_name ?? "",
    rcvrAddr1: row.rcvr_addr1 ?? "",
    rcvrPostcode: row.rcvr_postcode ?? "",
    rcvrCity: row.rcvr_city ?? "",
    trasa: row.trasa,
    grupa: row.grupa,
    sortujacy: row.sortujacy,
    wystapilo: row.wystapilo,
  };
}

export async function fetchShipments(): Promise<Shipment[]> {
  const { data, error } = await supabase
    .from("shipments")
    .select(
      "shipment_id, remarks, hwx, last_phy_cp, last_phy_cp_dt, weight_dimension, shp_calc_wgt, shp_tot_pcs, consignee_name, chute_id, receiver_name, rcvr_addr1, rcvr_postcode, rcvr_city, trasa, grupa, sortujacy, wystapilo, import_id, id"
    );

  if (error) {
    reportError(error, { module: "shipmentsRepository", stage: "fetchShipments" });
    throw error;
  }
  return (data ?? []).map((row) => fromRow(row as ShipmentRow & { id: number }));
}

// Zapisuje zaakceptowany import JEDNYM wywolaniem funkcji bazy
// import_shipments (migracja 0011): wpis w imports + podmiana CALEJ
// zawartosci shipments + czyszczenie starych shipment_actions -- w jednej
// transakcji, wszystko albo nic. Zwraca id nowego wpisu w imports.
export async function saveImport(result: ImportResult): Promise<number> {
  const { data, error } = await supabase.rpc("import_shipments", buildImportPayload(result));
  if (error) {
    reportError(error, { module: "shipmentsRepository", stage: "saveImport" });
    throw error;
  }
  return data as number;
}
