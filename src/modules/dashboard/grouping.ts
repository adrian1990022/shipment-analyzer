import type { Grupa, Shipment } from "../../types/shipment";

export const GRUPY: Grupa[] = ["P1", "P2", "P3", "COY004"];

export function countByGrupa(shipments: Shipment[]): Record<Grupa, number> {
  const counts: Record<Grupa, number> = { P1: 0, P2: 0, P3: 0, COY004: 0 };
  for (const s of shipments) counts[s.grupa] += 1;
  return counts;
}

export function shipmentsInGrupa(shipments: Shipment[], grupa: Grupa): Shipment[] {
  return shipments.filter((s) => s.grupa === grupa);
}

export interface SorterSummary {
  sortujacy: string;
  count: number;
}

export function sortersInGrupa(shipments: Shipment[]): SorterSummary[] {
  const counts = new Map<string, number>();
  for (const s of shipments) {
    counts.set(s.sortujacy, (counts.get(s.sortujacy) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([sortujacy, count]) => ({ sortujacy, count }))
    .sort((a, b) => a.sortujacy.localeCompare(b.sortujacy));
}

export function shipmentsForSorter(shipments: Shipment[], sortujacy: string): Shipment[] {
  return shipments.filter((s) => s.sortujacy === sortujacy);
}
