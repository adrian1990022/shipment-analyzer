import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeRef } from "../../test/fixtures";

const { fetchRoutes, fetchSorters, replaceReferenceData } = vi.hoisted(() => ({
  fetchRoutes: vi.fn(),
  fetchSorters: vi.fn(),
  replaceReferenceData: vi.fn(),
}));
vi.mock("../repository/routesRepository", () => ({ fetchRoutes }));
vi.mock("../repository/sorterRepository", () => ({ fetchSorters }));
vi.mock("../repository/backupRepository", () => ({ replaceReferenceData }));

const { buildBackup, triggerDownload, validateBackup, importBackup } = await import(
  "./referenceBackupService"
);

function validBackupJson() {
  return JSON.stringify({
    appVersion: "1.0.0",
    schemaVersion: 1,
    createdAt: "2026-07-30T00:00:00.000Z",
    createdBy: "admin",
    routes: [{ chuteId: "P1R01", trasa: "WAEX", grupa: "P1" }],
    sorters: [{ id: 1, name: "Jan Kowalski", active: true }],
    sorterRoutes: [{ sorterId: 1, route: "WAEX" }],
  });
}

describe("referenceBackupService", () => {
  beforeEach(() => {
    fetchRoutes.mockReset();
    fetchSorters.mockReset();
    replaceReferenceData.mockReset();
  });

  describe("buildBackup", () => {
    it("sklada backup z routes i sorters (sorterRoutes splaszczone z routes[])", async () => {
      fetchRoutes.mockResolvedValue([routeRef({ chuteId: "P1R01", trasa: "WAEX", grupa: "P1" })]);
      fetchSorters.mockResolvedValue([
        { id: 1, name: "Jan Kowalski", active: true, createdAt: "t", updatedAt: "t", routes: ["WAEX", "WAEF"] },
      ]);

      const backup = await buildBackup("admin");

      expect(backup.appVersion).toBe("1.0.0");
      expect(backup.schemaVersion).toBe(1);
      expect(backup.createdBy).toBe("admin");
      expect(backup.routes).toEqual([{ chuteId: "P1R01", trasa: "WAEX", grupa: "P1" }]);
      expect(backup.sorters).toEqual([{ id: 1, name: "Jan Kowalski", active: true }]);
      expect(backup.sorterRoutes).toEqual([
        { sorterId: 1, route: "WAEX" },
        { sorterId: 1, route: "WAEF" },
      ]);
    });

    it("rozroznia sortujacych o tej samej nazwie po id (np. dwaj \"Piotrek\")", async () => {
      fetchRoutes.mockResolvedValue([]);
      fetchSorters.mockResolvedValue([
        { id: 13, name: "Piotrek", active: true, createdAt: "t", updatedAt: "t", routes: ["WAJA"] },
        { id: 22, name: "Piotrek", active: true, createdAt: "t", updatedAt: "t", routes: ["WADA"] },
      ]);

      const backup = await buildBackup("admin");

      expect(backup.sorterRoutes).toEqual([
        { sorterId: 13, route: "WAJA" },
        { sorterId: 22, route: "WADA" },
      ]);
    });
  });

  describe("triggerDownload", () => {
    // Brak jsdom w tym projekcie (celowo -- "nie testuj React UI") --
    // dla tej jednej funkcji z manipulacja DOM podstawiamy minimalne
    // atrapy zamiast ciagnac cala biblioteke jsdom dla jednego testu.
    it("tworzy link pobierania z nazwa pliku zawierajaca date backupu i klika go", () => {
      const link = { href: "", download: "", click: vi.fn() };
      const createElement = vi.fn(() => link as unknown as HTMLAnchorElement);
      const appendChild = vi.fn();
      const removeChild = vi.fn();
      const createObjectURL = vi.fn(() => "blob:fake-url");
      const revokeObjectURL = vi.fn();

      vi.stubGlobal("document", { createElement, body: { appendChild, removeChild } });
      vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

      const backup = JSON.parse(validBackupJson());
      triggerDownload(backup);

      expect(link.download).toBe("shipment-analyzer-backup-2026-07-30.json");
      expect(link.click).toHaveBeenCalled();
      expect(appendChild).toHaveBeenCalledWith(link);
      expect(removeChild).toHaveBeenCalledWith(link);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");

      vi.unstubAllGlobals();
    });
  });

  describe("validateBackup", () => {
    it("akceptuje poprawny backup", () => {
      const result = validateBackup(validBackupJson());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data?.createdBy).toBe("admin");
    });

    it("odrzuca niepoprawny JSON", () => {
      const result = validateBackup("{ to nie jest json");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/JSON/);
    });

    it("odrzuca gdy najwyzszy poziom to nie obiekt", () => {
      const result = validateBackup(JSON.stringify([1, 2, 3]));
      expect(result.valid).toBe(false);
    });

    it("odrzuca niezgodna wersje schematu", () => {
      const backup = JSON.parse(validBackupJson());
      backup.schemaVersion = 2;
      const result = validateBackup(JSON.stringify(backup));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("schemaVersion"))).toBe(true);
    });

    it("odrzuca brak wymaganych list (routes/sorters/sorterRoutes)", () => {
      const backup = JSON.parse(validBackupJson());
      delete backup.sorters;
      const result = validateBackup(JSON.stringify(backup));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("sorters"))).toBe(true);
    });

    it("odrzuca route z grupa spoza P1/P2/P3", () => {
      const backup = JSON.parse(validBackupJson());
      backup.routes[0].grupa = "P9";
      const result = validateBackup(JSON.stringify(backup));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("grupa"))).toBe(true);
    });

    it("odrzuca sorterRoutes odwolujace sie do nieistniejacego sortujacego", () => {
      const backup = JSON.parse(validBackupJson());
      backup.sorterRoutes.push({ sorterId: 999, route: "WAEX" });
      const result = validateBackup(JSON.stringify(backup));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("999"))).toBe(true);
    });

    it("odrzuca sorterRoutes odwolujace sie do nieistniejacej trasy", () => {
      const backup = JSON.parse(validBackupJson());
      backup.sorterRoutes.push({ sorterId: 1, route: "NIEISTNIEJE" });
      const result = validateBackup(JSON.stringify(backup));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("NIEISTNIEJE"))).toBe(true);
    });

    it("odrzuca zdeformowane wpisy w tablicach (nie-obiekt zamiast rekordu)", () => {
      const backup = JSON.parse(validBackupJson());
      backup.routes.push("nie obiekt");
      const result = validateBackup(JSON.stringify(backup));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("routes[1]"))).toBe(true);
    });

    it("odrzuca sortujacego bez pola name", () => {
      const backup = JSON.parse(validBackupJson());
      backup.sorters.push({ id: 2, active: true });
      const result = validateBackup(JSON.stringify(backup));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("brak name"))).toBe(true);
    });

    it("odrzuca sortujacego bez pola id", () => {
      const backup = JSON.parse(validBackupJson());
      backup.sorters.push({ name: "Ktos", active: true });
      const result = validateBackup(JSON.stringify(backup));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("brak id"))).toBe(true);
    });

    it("odrzuca zdeformowany wpis w sorterRoutes (nie-obiekt)", () => {
      const backup = JSON.parse(validBackupJson());
      backup.sorterRoutes.push(null);
      const result = validateBackup(JSON.stringify(backup));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("sorterRoutes[1]"))).toBe(true);
    });

    it("odrzuca brak wymaganych pol najwyzszego poziomu (kompletnosc)", () => {
      const backup = JSON.parse(validBackupJson());
      delete backup.createdBy;
      const result = validateBackup(JSON.stringify(backup));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("createdBy"))).toBe(true);
    });
  });

  describe("importBackup", () => {
    it("wola replaceReferenceData i zwraca podsumowanie liczbowe", async () => {
      replaceReferenceData.mockResolvedValue(undefined);
      const backup = JSON.parse(validBackupJson());

      const summary = await importBackup(backup);

      expect(replaceReferenceData).toHaveBeenCalledWith(backup);
      expect(summary).toEqual({ routesCount: 1, sortersCount: 1, sorterRoutesCount: 1 });
    });

    it("blad transakcji -> propaguje sie do wywolujacego (nic nie zapisano czesciowo)", async () => {
      replaceReferenceData.mockRejectedValue(new Error("rolled back"));
      const backup = JSON.parse(validBackupJson());

      await expect(importBackup(backup)).rejects.toThrow("rolled back");
    });
  });
});
