import type { Grupa, Shipment } from "../../types/shipment";

export const GRUPY: Grupa[] = ["P1", "P2", "P3", "COY004"];

// P1/P3 maja jawne przypisanie sortujacego -> Brama (routes.sortujacy) i
// dostaja dodatkowy poziom nawigacji (sortujacy -> trasa -> tabela). P2
// (i COY004) zostaja przy plaskim ukladzie sortujacy -> tabela, bo sortujacy
// jest tam nadal wyliczany z 3. litery trasy, nie jawnie przypisany.
export function hasTrasaLevel(grupa: Grupa): boolean {
  return grupa === "P1" || grupa === "P3";
}

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
  // Lista tras obslugiwanych przez tego sortujacego -- pokazywana wprost
  // na kafelku, zeby nie trzeba bylo w niego klikac, by je poznac.
  trasy: string[];
}

// Sortujacy bywa liczba (P1/P3, np. "1".."17") albo litera (P2, fallback
// z 3. litery trasy) -- porownujemy numerycznie gdy oba wpisy sa liczbami,
// inaczej alfabetycznie, zeby "10" nie wypadlo przed "2".
function compareSortujacy(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b);
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
    .sort((a, b) => compareSortujacy(a.sortujacy, b.sortujacy));
}

export function shipmentsForSorter(shipments: Shipment[], sortujacy: string): Shipment[] {
  return shipments.filter((s) => s.sortujacy === sortujacy);
}

export interface TrasaSummary {
  trasa: string;
  count: number;
}

export function trasyInSorter(shipments: Shipment[]): TrasaSummary[] {
  const counts = new Map<string, number>();
  for (const s of shipments) {
    counts.set(s.trasa, (counts.get(s.trasa) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([trasa, count]) => ({ trasa, count }))
    .sort((a, b) => a.trasa.localeCompare(b.trasa));
}

export function shipmentsForTrasa(shipments: Shipment[], trasa: string): Shipment[] {
  return shipments.filter((s) => s.trasa === trasa);
}
