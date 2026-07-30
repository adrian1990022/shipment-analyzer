export interface RouteBackupEntry {
  chuteId: string;
  trasa: string;
  grupa: "P1" | "P2" | "P3";
}

export interface SorterBackupEntry {
  name: string;
  active: boolean;
}

// Referencjonuje sortujacego po nazwie, nie po id -- ID sa nadawane od
// nowa przy kazdym imporcie (kolumny identity), wiec numeryczne ID z
// eksportu i tak nic by nie znaczyly przy imporcie do tej samej lub innej bazy.
export interface SorterRouteBackupEntry {
  sorterName: string;
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
