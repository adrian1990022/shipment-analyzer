import { supabase } from "../../lib/supabaseClient";
import type { Grupa, ImportSummary, Shipment } from "../../types/shipment";

interface ShipmentRow {
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
  import_id: number | null;
}

function toRow(shipment: Shipment, importId: number | null): ShipmentRow {
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
    import_id: importId,
  };
}

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

  if (error) throw error;
  return (data ?? []).map((row) => fromRow(row as ShipmentRow & { id: number }));
}

// Zastepuje CALA zawartosc tabeli shipments nowym importem (zgodnie z
// regula "kazdy import zastepuje poprzednie dane"). Zapisuje tez wpis
// w imports (metadane, bez tresci raportow) i wiaze shipments z nim.
export async function replaceShipments(
  shipments: Shipment[],
  summary: ImportSummary
): Promise<void> {
  const { data: importRow, error: importError } = await supabase
    .from("imports")
    .insert({
      panorama_filename: summary.panoramaFilename,
      sherloc_filename: summary.sherlocFilename,
      total_rows: summary.totalRows,
      matched_rows: summary.matchedRows,
      unmatched_rows: summary.unmatchedRows,
      unmapped_rows: summary.unmappedRows,
      today_rows: summary.todayRows,
      group_counts: summary.groupCounts,
    })
    .select("id")
    .single();

  if (importError) throw importError;
  const importId = (importRow as { id: number }).id;

  // Usun poprzednie dane -- "id >= 0" dopasowuje kazdy wiersz (bigint identity).
  const { error: deleteError } = await supabase.from("shipments").delete().gte("id", 0);
  if (deleteError) throw deleteError;

  if (shipments.length === 0) return;

  const rows = shipments.map((s) => toRow(s, importId));

  // Insert w partiach, zeby nie przekroczyc limitow requestu przy duzych plikach.
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error: insertError } = await supabase.from("shipments").insert(chunk);
    if (insertError) throw insertError;
  }
}
