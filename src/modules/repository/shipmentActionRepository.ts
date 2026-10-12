import { supabase } from "../../lib/supabaseClient";
import { fetchAllPages } from "../../lib/fetchAllPages";
import { reportError } from "../monitoring/reportError";
import { buildHandledKey } from "../normalizer/normalize";

// Re-eksport -- historyczne miejsce importu dla App.tsx/testow. Definicje
// sa w normalize.ts (czysty modul, bez inicjalizacji klienta Supabase),
// zeby moduly logiki (grouping.ts) mogly z nich korzystac bez pociagania
// za soba tego pliku.
export { buildHandledKey, isShipmentHandled } from "../normalizer/normalize";

export interface ShipmentActionRow {
  shipmentId: string;
  shipmentDate: string;
  handled: boolean;
}

interface ShipmentActionDbRow {
  shipment_id: string;
  shipment_date: string;
  handled: boolean;
}

// Czysta funkcja (bez Supabase) -- testowalna wprost. Trzyma tylko wpisy
// handled===true, bo brak klucza w mapie == "nieobsluzone" (patrz
// App.tsx: handledMap.get(key) ?? false).
export function buildHandledMap(rows: ShipmentActionRow[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const row of rows) {
    if (row.handled) map.set(buildHandledKey(row.shipmentId, row.shipmentDate), true);
  }
  return map;
}

// Pobiera CALY stan "obsluzono" (stronami, fetchAllPages -- limit 1000
// wierszy) -- laczenie z Shipment[] dzieje sie w pamieci (App.tsx), zeby nie
// robic zapytania per wiersz tabeli.
export async function fetchHandledMap(): Promise<Map<string, boolean>> {
  let rows: ShipmentActionDbRow[];
  try {
    rows = (await fetchAllPages(() =>
      supabase.from("shipment_actions").select("shipment_id, shipment_date, handled").order("id")
    )) as ShipmentActionDbRow[];
  } catch (error) {
    reportError(error, { module: "shipmentActionRepository", stage: "fetchHandledMap" });
    throw error;
  }
  return buildHandledMap(
    rows.map((row) => ({ shipmentId: row.shipment_id, shipmentDate: row.shipment_date, handled: row.handled }))
  );
}

export async function setHandled(shipmentId: string, shipmentDate: string, handled: boolean): Promise<void> {
  const { error } = await supabase
    .from("shipment_actions")
    .upsert(
      { shipment_id: shipmentId, shipment_date: shipmentDate, handled },
      { onConflict: "shipment_id,shipment_date" }
    );
  if (error) {
    reportError(error, { module: "shipmentActionRepository", stage: "setHandled" });
    throw error;
  }
}
