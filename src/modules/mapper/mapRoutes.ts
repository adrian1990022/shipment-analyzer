import type { JoinedRow } from "../joiner/joinReports";
import { normalizeJoinKey, parseFlexibleDate, parseNumber } from "../normalizer/normalize";
import type { Grupa, RouteRef, Shipment } from "../../types/shipment";

const COY004 = "COY004";

export interface MapResult {
  shipments: Shipment[];
  unmappedChuteIds: string[];
  unmappedRowCount: number;
}

// Fallback, gdy brama nie ma jawnego przypisania sortujacego w routes:
// MVP wylicza sortujacego z trzeciej litery trasy (regula biznesowa wprost
// ze specyfikacji). Uzywana dzis dla calej grupy P2 i dla COY004.
function sorterFromTrasa(trasa: string): string {
  const upper = trasa.trim().toUpperCase();
  return upper.charAt(2) || upper || "?";
}

// Mapper jest jedynym modulem, ktory zna tabele routes. Parser i Joiner
// dzialaja bez tej wiedzy (patrz komentarze w tych modulach).
// occurrenceCounts pochodzi z kroku deduplikacji (dedupeByShipmentId) --
// Mapper tylko przepisuje je do pola "wystapilo", nie liczy ich sam.
export function mapRoutes(
  rows: JoinedRow[],
  routes: RouteRef[],
  occurrenceCounts: Map<string, number>
): MapResult {
  const routeByChuteId = new Map<string, RouteRef>();
  for (const route of routes) {
    routeByChuteId.set(normalizeJoinKey(route.chuteId), route);
  }

  const shipments: Shipment[] = [];
  const unmapped = new Set<string>();
  let unmappedRowCount = 0;

  for (const { panorama, sherloc } of rows) {
    const chuteId = panorama.chuteId.trim();
    const chuteKey = normalizeJoinKey(chuteId);

    let trasa: string;
    let grupa: Grupa;
    let explicitSortujacy: string | null = null;

    if (chuteKey === COY004) {
      trasa = COY004;
      grupa = COY004;
    } else {
      const route = routeByChuteId.get(chuteKey);
      if (!route) {
        unmapped.add(chuteId);
        unmappedRowCount += 1;
        continue;
      }
      trasa = route.trasa;
      grupa = route.grupa;
      explicitSortujacy = route.sortujacy;
    }

    shipments.push({
      shipmentId: panorama.shipmentId,
      remarks: panorama.remarks,
      hwx: panorama.hwx,
      lastPhyCp: panorama.lastPhyCp,
      lastPhyCpDt: parseFlexibleDate(panorama.lastPhyCpDt)?.toISOString() ?? null,
      weightDimension: panorama.weightDimension,
      shpCalcWgt: parseNumber(panorama.shpCalcWgt),
      shpTotPcs: parseNumber(panorama.shpTotPcs),
      consigneeName: panorama.consigneeName,
      chuteId,
      receiverName: sherloc?.receiverName ?? "",
      rcvrAddr1: sherloc?.rcvrAddr1 ?? "",
      rcvrPostcode: sherloc?.rcvrPostcode ?? "",
      rcvrCity: sherloc?.rcvrCity ?? "",
      trasa,
      grupa,
      sortujacy: explicitSortujacy || sorterFromTrasa(trasa),
      wystapilo: occurrenceCounts.get(panorama.shipmentId) ?? 1,
    });
  }

  return { shipments, unmappedChuteIds: Array.from(unmapped), unmappedRowCount };
}
