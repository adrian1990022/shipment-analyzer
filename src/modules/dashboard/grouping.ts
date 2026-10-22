import type { Grupa, Shipment } from "../../types/shipment";
import { isShipmentHandled, naturalCompare } from "../normalizer/normalize";

export const GRUPY: Grupa[] = ["P1", "P2", "P3", "COY004", "MAGAZYN", "NIEPRZYPISANE"];

const GRUPA_LABELS: Partial<Record<Grupa, string>> = { MAGAZYN: "Magazyn", NIEPRZYPISANE: "Nieprzypisane" };

export function grupaLabel(grupa: Grupa): string {
  return GRUPA_LABELS[grupa] ?? grupa;
}

// sortujacy "" = trasa bez przypisanego sortujacego (od 2026-10-21 bez
// fallbacku z 3. litery trasy).
export function sorterLabel(sortujacy: string): string {
  return sortujacy || "Brak sortującego";
}

// Uklad kafelka grupy (2026-10-21):
//   sortujacy -- P1/P2/P3: kafelki sortujacych,
//   trasa     -- COY004 i MAGAZYN: kafelki tras (te trasy nie maja
//                sortujacych, decyzja Adriana), potem tabela,
//   lista     -- NIEPRZYPISANE: od razu lista przesylek z powodem.
export type GroupLayout = "sortujacy" | "trasa" | "lista";

export function groupLayout(grupa: Grupa): GroupLayout {
  if (grupa === "COY004" || grupa === "MAGAZYN") return "trasa";
  if (grupa === "NIEPRZYPISANE") return "lista";
  return "sortujacy";
}

// P1/P3: po sortujacym dodatkowy poziom nawigacji (sortujacy -> trasa ->
// tabela). P2 zostaje przy plaskim ukladzie sortujacy -> tabela.
export function hasTrasaLevel(grupa: Grupa): boolean {
  return grupa === "P1" || grupa === "P3";
}

export function countByGrupa(shipments: Shipment[]): Record<Grupa, number> {
  const counts: Record<Grupa, number> = { P1: 0, P2: 0, P3: 0, COY004: 0, MAGAZYN: 0, NIEPRZYPISANE: 0 };
  for (const s of shipments) counts[s.grupa] += 1;
  return counts;
}

export function shipmentsInGrupa(shipments: Shipment[], grupa: Grupa): Shipment[] {
  return shipments.filter((s) => s.grupa === grupa);
}

export interface SorterSummary {
  sortujacy: string;
  count: number;
  // Lista tras obslugiwanych przez tego sortujacego -- pokazywana wprost
  // na kafelku, zeby nie trzeba bylo w niego klikac, by je poznac.
  trasy: string[];
}

export function sortersInGrupa(shipments: Shipment[]): SorterSummary[] {
  const bucket = new Map<string, { count: number; trasy: Set<string> }>();
  for (const s of shipments) {
    const entry = bucket.get(s.sortujacy) ?? { count: 0, trasy: new Set<string>() };
    entry.count += 1;
    entry.trasy.add(s.trasa);
    bucket.set(s.sortujacy, entry);
  }
  return Array.from(bucket.entries())
    .map(([sortujacy, { count, trasy }]) => ({
      sortujacy,
      count,
      trasy: Array.from(trasy).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => naturalCompare(a.sortujacy, b.sortujacy));
}

export function shipmentsForSorter(shipments: Shipment[], sortujacy: string): Shipment[] {
  return shipments.filter((s) => s.sortujacy === sortujacy);
}

export interface TrasaSummary {
  trasa: string;
  count: number;
  // Czy WSZYSTKIE przesylki tej trasy sa oznaczone jako "Obsluzono" --
  // uzywane do paska statusu na kafelku (TrasaListView). Trasa zawsze ma
  // count >= 1 tutaj (bucketowanie z realnych przesylek), wiec nie ma
  // przypadku "0 z 0".
  allHandled: boolean;
}

export function trasyInSorter(shipments: Shipment[], handledMap: Map<string, boolean>): TrasaSummary[] {
  const bucket = new Map<string, Shipment[]>();
  for (const s of shipments) {
    const list = bucket.get(s.trasa) ?? [];
    list.push(s);
    bucket.set(s.trasa, list);
  }
  return Array.from(bucket.entries())
    .map(([trasa, list]) => ({
      trasa,
      count: list.length,
      allHandled: list.every((s) => isShipmentHandled(s, handledMap)),
    }))
    .sort((a, b) => a.trasa.localeCompare(b.trasa));
}

export function shipmentsForTrasa(shipments: Shipment[], trasa: string): Shipment[] {
  return shipments.filter((s) => s.trasa === trasa);
}
