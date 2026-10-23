import type { JoinedRow } from "../joiner/joinReports";
import { normalizeJoinKey, parseFlexibleDate, parseNumber } from "../normalizer/normalize";
import type { Grupa, Przypisanie, RouteRef, Shipment } from "../../types/shipment";

// Kafelek COY004 (decyzja Adriana 2026-10-21): wszystkie trasy z "O" na
// 3. miejscu kodu (WAOA, WAOB, ...) -- niezaleznie od tabeli routes.
const COY004 = "COY004";
const COY004_TRZECIA_LITERA = "O";

export function isCoy004Trasa(trasa: string): boolean {
  return trasa.charAt(2) === COY004_TRZECIA_LITERA;
}

// Kafelek MAGAZYN (decyzja Adriana 2026-10-22): kody magazynowe z bazy
// przypisan tras -- nie sa trasami kurierow. Nowy kod = dopisac tutaj.
const MAGAZYN_TRASY = new Set(["WAW1"]);

// Zamienniki kodow z bazy przypisan tras (decyzja Adriana 2026-10-23):
// przesylka z trasa z lewej strony dostaje trase z prawej -- dalej obowiazuja
// zwykle reguly (WAON: "O" na 3. miejscu -> COY004, widoczna u kuriera WAON).
const ZAMIENNIKI_TRAS: Record<string, string> = { WAGM: "WAON" };

export function trasaPoZamianie(trasa: string): string {
  return ZAMIENNIKI_TRAS[trasa] ?? trasa;
}

export function isMagazynTrasa(trasa: string): boolean {
  return MAGAZYN_TRASY.has(trasa);
}

export interface MapResult {
  shipments: Shipment[];
  przypisanieCounts: Record<Przypisanie, number>;
  // Przesylki z trasa, ale bez sortujacego w sorter_routes.
  bezSortujacegoRows: number;
}

// Mapper jest jedynym modulem, ktory przypisuje przesylce trase, grupe
// (kafelek) i sortujacego.
//
// Od 2026-10-21 (decyzja Adriana) zrodlem trasy jest WYLACZNIE baza
// przypisan tras (routeByAwb: znormalizowany numer -> trasa, plik "Route |
// AWB/BkgRef"), dla wszystkich przesylek z Panoramy:
//
//   numer nie w bazie       -> trasa "", NIEPRZYPISANE (brak_w_bazie),
//   (najpierw zamiennik kodu: WAGM -> WAON, patrz ZAMIENNIKI_TRAS)
//   WAW1 (magazyn)          -> MAGAZYN (baza),
//   trasa z "O" na 3. msc   -> COY004 (baza),
//   trasa w routes          -> grupa z routes (baza),
//   trasa spoza routes      -> trasa zostaje, NIEPRZYPISANE (nieznana_trasa),
//   sortujacy               -> tylko z sorter_routes, inaczej "" (brak).
//
// Chute ID nie wyznacza juz trasy (dawny dubel i specjalny Chute ID COY004
// przestaly dzialac), nie ma tez fallbacku sortujacego z 3. litery trasy.
// Tabela routes sluzy tylko do ustalenia grupy (P1/P2/P3) po kodzie trasy.
// Przesylka bez przypisania NIE wypada z wyniku -- ma byc widoczna.
//
// occurrenceCounts pochodzi z kroku deduplikacji (dedupeByShipmentId) --
// Mapper tylko przepisuje je do pola "wystapilo", nie liczy ich sam.
export function mapRoutes(
  rows: JoinedRow[],
  routes: RouteRef[],
  occurrenceCounts: Map<string, number>,
  sorterNameByTrasa: Map<string, string>,
  routeByAwb: Map<string, string>
): MapResult {
  // Trasa -> grupa. Trasa ma jedna grupe (sprawdzone na danych 2026-10-21);
  // przy niespojnosci w routes wygrywa pierwszy wpis.
  const grupaByTrasa = new Map<string, Grupa>();
  for (const route of routes) {
    const trasa = route.trasa.trim().toUpperCase();
    if (!grupaByTrasa.has(trasa)) grupaByTrasa.set(trasa, route.grupa);
  }

  const shipments: Shipment[] = [];
  const przypisanieCounts: Record<Przypisanie, number> = { baza: 0, brak_w_bazie: 0, nieznana_trasa: 0 };
  let bezSortujacegoRows = 0;

  for (const { panorama, sherloc } of rows) {
    const zBazy = routeByAwb.get(normalizeJoinKey(panorama.shipmentId));
    const trasaZBazy = zBazy === undefined ? undefined : trasaPoZamianie(zBazy);

    let trasa: string;
    let grupa: Grupa;
    let przypisanie: Przypisanie;
    if (trasaZBazy === undefined) {
      trasa = "";
      grupa = "NIEPRZYPISANE";
      przypisanie = "brak_w_bazie";
    } else if (isMagazynTrasa(trasaZBazy)) {
      trasa = trasaZBazy;
      grupa = "MAGAZYN";
      przypisanie = "baza";
    } else if (isCoy004Trasa(trasaZBazy)) {
      trasa = trasaZBazy;
      grupa = COY004;
      przypisanie = "baza";
    } else {
      trasa = trasaZBazy;
      const znana = grupaByTrasa.get(trasaZBazy);
      grupa = znana ?? "NIEPRZYPISANE";
      przypisanie = znana ? "baza" : "nieznana_trasa";
    }

    const sortujacy = trasa ? sorterNameByTrasa.get(trasa) ?? "" : "";
    if (trasa && !sortujacy) bezSortujacegoRows += 1;
    przypisanieCounts[przypisanie] += 1;

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
      chuteId: panorama.chuteId.trim(),
      receiverName: sherloc?.receiverName ?? "",
      rcvrAddr1: sherloc?.rcvrAddr1 ?? "",
      rcvrPostcode: sherloc?.rcvrPostcode ?? "",
      rcvrCity: sherloc?.rcvrCity ?? "",
      trasa,
      grupa,
      sortujacy,
      wystapilo: occurrenceCounts.get(panorama.shipmentId) ?? 1,
      przypisanie,
    });
  }

  return { shipments, przypisanieCounts, bezSortujacegoRows };
}
