// NIEPRZYPISANE (2026-10-21): przesylki bez trasy z bazy przypisan tras
// albo z trasa spoza tabeli routes. MAGAZYN (2026-10-22): kody magazynowe
// z bazy (WAGM, WAW1) -- patrz mapRoutes.ts.
export type Grupa = "P1" | "P2" | "P3" | "COY004" | "MAGAZYN" | "NIEPRZYPISANE";

// Skad trasa przesylki (od 2026-10-21, kolumna shipments.przypisanie):
//   baza           -- trasa z bazy przypisan tras, znana w routes (albo
//                     COY004: 3. litera trasy "O", albo MAGAZYN),
//   brak_w_bazie   -- numeru nie ma w bazie -> trasa pusta, NIEPRZYPISANE,
//   nieznana_trasa -- trasa z bazy, ale spoza routes -> NIEPRZYPISANE.
// null = przesylka z importu sprzed bazy (trasa z Chute ID).
export type Przypisanie = "baza" | "brak_w_bazie" | "nieznana_trasa";

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
  shpTotPcs: number | null;
  consigneeName: string;
  chuteId: string;
  receiverName: string;
  rcvrAddr1: string;
  rcvrPostcode: string;
  rcvrCity: string;
  trasa: string;
  grupa: Grupa;
  // Nazwa sortujacego (z sorters/sorter_routes -- patrz SorterRepository).
  // "" = brak sortujacego (trasa bez przypisania albo przesylka bez trasy)
  // -- od 2026-10-21 bez fallbacku z 3. litery trasy.
  sortujacy: string;
  // Ile razy dany Shipment ID wystapil w danych Panorama
  // (przed deduplikacja) -- patrz modules/dedup/dedupeByShipmentId.ts.
  wystapilo: number;
  przypisanie: Przypisanie | null;
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
  // Przesylki w wyniku (po deduplikacji, regule 15 minut i mapowaniu tras).
  // W bazie zapisywane w kolumnie imports.today_rows (nazwa historyczna z
  // czasow filtra "tylko dzisiaj", zniesionego 2026-09-25).
  resultRows: number;
  // Pominiete, bo ostatni skan byl w ciagu 15 minut przed wpisana godzina.
  recentSkippedRows: number;
  // Pominiete, bo brak/niepoprawna data ostatniego skanu.
  noDateRows: number;
  // Moment odciecia (wpisana godzina minus 15 minut), ISO; null gdy brak.
  cutoffAt: string | null;
  groupCounts: Record<Grupa, number>;
  // Przesylki wg zrodla trasy (baza / brak w bazie / nieznana trasa).
  przypisanieCounts: Record<Przypisanie, number>;
  // Przesylki z trasa, ale bez sortujacego w sorter_routes.
  bezSortujacegoRows: number;
  // Kiedy wgrano baze przypisan tras uzyta w tym imporcie (ISO).
  routeBaseUploadedAt: string | null;
  panoramaFilename: string;
  sherlocFilename: string;
}

export interface ImportResult {
  summary: ImportSummary;
  shipments: Shipment[];
}

// Aktywna baza przypisan tras w pamieci (do mapowania): znormalizowany
// numer przesylki (normalizeJoinKey) -> trasa.
export interface RouteBaseRef {
  routeByAwb: Map<string, string>;
  uploadedAt: string;
}

// Status bazy przypisan tras (karta "Baza przypisan tras") -- null, gdy
// baza nie zostala jeszcze wgrana.
export interface RouteBaseStatus {
  uploadedAt: string;
  filename: string | null;
  recordCount: number;
  zrodlo: "shipment" | "kurier";
}
