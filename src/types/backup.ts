export interface RouteBackupEntry {
  chuteId: string;
  trasa: string;
  grupa: "P1" | "P2" | "P3";
}

export interface SorterBackupEntry {
  id: number;
  name: string;
  // Opcjonalne -- pliki sprzed 2026-10-12 go nie maja (wgrywaja sie z
  // pustym imieniem i nazwiskiem).
  fullName?: string | null;
  // Opcjonalne jak fullName -- pliki sprzed 2026-10-13 go nie maja.
  loop?: string | null;
  active: boolean;
}

// Referencjonuje sortujacego po id Z CHWILI EKSPORTU (nie po nazwie --
// dwoch roznych sortujacych moze miec to samo imie, np. w realnych danych
// sa dwaj "Piotrek" i dwaj "Dima", wiec nazwa nie jest unikalna). Import
// nadaje nowe ID (kolumny identity) i mapuje "id z eksportu" -> "nowe id"
// wewnatrz jednej transakcji SQL, wiec numeryczne id ponizej jest tylko
// kluczem wewnetrznym pliku, nigdy nie trafia bezposrednio do bazy.
export interface SorterRouteBackupEntry {
  sorterId: number;
  route: string;
}

export interface ReferenceBackup {
  appVersion: string;
  schemaVersion: number;
  createdAt: string;
  createdBy: string;
  routes: RouteBackupEntry[];
  sorters: SorterBackupEntry[];
  sorterRoutes: SorterRouteBackupEntry[];
}

export interface BackupImportSummary {
  routesCount: number;
  sortersCount: number;
  sorterRoutesCount: number;
}
