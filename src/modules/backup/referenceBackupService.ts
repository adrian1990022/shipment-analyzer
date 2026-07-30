import { fetchRoutes } from "../repository/routesRepository";
import { fetchSorters } from "../repository/sorterRepository";
import { replaceReferenceData } from "../repository/backupRepository";
import type { BackupImportSummary, ReferenceBackup } from "../../types/backup";

// Jedyny modul, ktory zna format JSON backupu -- komponenty React woluja
// wylacznie funkcje ponizej (buildBackup/triggerDownload/validateBackup/
// importBackup), nigdy nie parsuja/skladaja JSON same.

const APP_VERSION = "1.0.0";
// Podbij, gdy zmieni sie ksztalt pliku backupu w sposob niekompatybilny
// wstecz -- validateBackup odrzuci pliki z inna wersja, zamiast zgadywac.
const SCHEMA_VERSION = 1;

const VALID_GRUPY = new Set(["P1", "P2", "P3"]);

export async function buildBackup(createdBy: string): Promise<ReferenceBackup> {
  const [routes, sorters] = await Promise.all([fetchRoutes(), fetchSorters()]);

  return {
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    createdBy,
    routes: routes.map((r) => ({ chuteId: r.chuteId, trasa: r.trasa, grupa: r.grupa })),
    sorters: sorters.map((s) => ({ name: s.name, active: s.active })),
    sorterRoutes: sorters.flatMap((s) => s.routes.map((route) => ({ sorterName: s.name, route }))),
  };
}

export function triggerDownload(backup: ReferenceBackup): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `shipment-analyzer-backup-${backup.createdAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  data: ReferenceBackup | null;
}

// Sprawdza: poprawnosc JSON, wersje schematu, kompletnosc pol i typow,
// oraz spojnosc referencji (kazdy sorterRoutes[].sorterName istnieje w
// sorters, kazdy sorterRoutes[].route istnieje w routes) -- zanim
// cokolwiek trafi do importBackup.
export function validateBackup(raw: string): BackupValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, errors: ["Plik nie jest poprawnym JSON-em."], data: null };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { valid: false, errors: ["Nieoczekiwana struktura pliku (oczekiwano obiektu)."], data: null };
  }
  const obj = parsed as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof obj.appVersion !== "string" || !obj.appVersion) errors.push("Brak appVersion.");
  if (obj.schemaVersion !== SCHEMA_VERSION) {
    errors.push(
      `Nieobsługiwana wersja formatu (schemaVersion=${JSON.stringify(obj.schemaVersion)}, oczekiwano ${SCHEMA_VERSION}).`
    );
  }
  if (typeof obj.createdAt !== "string" || !obj.createdAt) errors.push("Brak createdAt.");
  if (typeof obj.createdBy !== "string" || !obj.createdBy) errors.push("Brak createdBy.");
  if (!Array.isArray(obj.routes)) errors.push("Brak listy 'routes'.");
  if (!Array.isArray(obj.sorters)) errors.push("Brak listy 'sorters'.");
  if (!Array.isArray(obj.sorterRoutes)) errors.push("Brak listy 'sorterRoutes'.");

  // Bez podstawowej struktury dalsza walidacja (referencje) nie ma sensu.
  if (errors.length > 0) return { valid: false, errors, data: null };

  const routes = obj.routes as unknown[];
  const sorters = obj.sorters as unknown[];
  const sorterRoutes = obj.sorterRoutes as unknown[];

  routes.forEach((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      errors.push(`routes[${i}]: nieprawidłowy wpis.`);
      return;
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.chuteId !== "string" || !row.chuteId) errors.push(`routes[${i}]: brak chuteId.`);
    if (typeof row.trasa !== "string" || !row.trasa) errors.push(`routes[${i}]: brak trasa.`);
    if (typeof row.grupa !== "string" || !VALID_GRUPY.has(row.grupa)) {
      errors.push(`routes[${i}]: grupa musi być P1/P2/P3.`);
    }
  });

  const sorterNames = new Set<string>();
  sorters.forEach((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      errors.push(`sorters[${i}]: nieprawidłowy wpis.`);
      return;
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.name !== "string" || !row.name) {
      errors.push(`sorters[${i}]: brak name.`);
    } else {
      sorterNames.add(row.name);
    }
    if (typeof row.active !== "boolean") errors.push(`sorters[${i}]: active musi być true/false.`);
  });

  const routeTrasy = new Set(
    routes
      .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
      .map((r) => r.trasa)
  );
  sorterRoutes.forEach((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      errors.push(`sorterRoutes[${i}]: nieprawidłowy wpis.`);
      return;
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.sorterName !== "string" || !sorterNames.has(row.sorterName)) {
      errors.push(`sorterRoutes[${i}]: sortujący "${String(row.sorterName)}" nie istnieje w liście sorters.`);
    }
    if (typeof row.route !== "string" || !routeTrasy.has(row.route)) {
      errors.push(`sorterRoutes[${i}]: trasa "${String(row.route)}" nie istnieje w liście routes.`);
    }
  });

  if (errors.length > 0) return { valid: false, errors, data: null };

  return { valid: true, errors: [], data: obj as unknown as ReferenceBackup };
}

export async function importBackup(backup: ReferenceBackup): Promise<BackupImportSummary> {
  await replaceReferenceData(backup);
  return {
    routesCount: backup.routes.length,
    sortersCount: backup.sorters.length,
    sorterRoutesCount: backup.sorterRoutes.length,
  };
}
