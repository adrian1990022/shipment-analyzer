import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildXlsxFile } from "../../test/xlsxFixture";
import { createQueryBuilderMock } from "../../test/supabaseMock";

const { supabase } = vi.hoisted(() => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("../../lib/supabaseClient", () => ({ supabase }));

const { runImportPipeline, PipelineError } = await import("./pipeline");

const PANORAMA_HEADERS = [
  "Shipment ID",
  "Remarks",
  "HWX?",
  "Last Phy Cp",
  "Last Phy Cp dt",
  "Weight (KG)/Dimension (CM)",
  "Shp Calc Wgt (KG)",
  "Shp Tot Pcs",
  "Consignee Name",
  "Chute ID",
];
const SHERLOC_HEADERS = ["HWB No", "Receiver Name", "Rcvr Addr 1", "Rcvr Postcode", "Rcvr City"];

function panoramaFile(rows: (string | number)[][], filename = "panorama.xlsx") {
  return buildXlsxFile(PANORAMA_HEADERS, rows, filename);
}
function sherlocFile(rows: (string | number)[][], filename = "sherloc.xlsx") {
  return buildXlsxFile(SHERLOC_HEADERS, rows, filename);
}

// Dane referencyjne po nazwie tabeli: routes (WAEX = P1), brak sortujacych,
// baza przypisan tras wgrana DZIS (6:00) -- 1001/1002/1004/1005 -> WAEX.
function mockRoutesAndSorters(
  base: { uploadedAt: Date; pairs: [string, string][] } | null = {
    uploadedAt: new Date(2026, 6, 22, 6, 0, 0),
    pairs: [
      ["1001", "WAEX"],
      ["1002", "WAEX"],
      ["1004", "WAEX"],
      ["1005", "WAEX"],
    ],
  }
) {
  supabase.from.mockImplementation((table: string) => {
    if (table === "routes") {
      return createQueryBuilderMock({
        data: [{ id: 1, chute_id: "P1R01", trasa: "WAEX", grupa: "P1", created_at: "t", updated_at: "t" }],
      });
    }
    if (table === "route_assignment_meta") {
      return createQueryBuilderMock({
        data: base
          ? { uploaded_at: base.uploadedAt.toISOString(), filename: "baza.xlsx", record_count: base.pairs.length, zrodlo: "shipment" }
          : null,
      });
    }
    if (table === "route_assignments") {
      return createQueryBuilderMock({ data: (base?.pairs ?? []).map(([awb, route]) => ({ awb, route })) });
    }
    return createQueryBuilderMock({ data: [] });
  });
}

// Wpisana godzina 12:00 -> odciecie 11:45 (regula 15 minut).
const CUTOFF = new Date(2026, 6, 22, 11, 45, 0);

describe("runImportPipeline", () => {
  beforeEach(() => {
    supabase.from.mockReset();
    vi.setSystemTime(new Date(2026, 6, 22, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("laczy Panorama+Sherloc, stosuje regule 15 minut, mapuje trasy end-to-end", async () => {
    mockRoutesAndSorters();

    const panorama = panoramaFile([
      ["1001", "", "", "OK", "22/07/2026 10:00", "", "", "", "Jan Kowalski", "P1R01"],
    ]);
    const sherloc = sherlocFile([["1001", "Jan Kowalski", "ul. Testowa 1", "00-001", "Warszawa"]]);

    const result = await runImportPipeline(panorama, sherloc, CUTOFF);

    expect(result.summary.totalRows).toBe(1);
    expect(result.summary.matchedRows).toBe(1);
    expect(result.shipments).toHaveLength(1);
    expect(result.shipments[0].trasa).toBe("WAEX");
    expect(result.shipments[0].receiverName).toBe("Jan Kowalski");
  });

  it("kolejnosc plikow nie ma znaczenia (auto-rozpoznanie typu raportu)", async () => {
    mockRoutesAndSorters();

    const panorama = panoramaFile([
      ["1001", "", "", "OK", "22/07/2026 10:00", "", "", "", "Jan Kowalski", "P1R01"],
    ]);
    const sherloc = sherlocFile([["1001", "Jan Kowalski", "", "", ""]]);

    // sherloc jako "fileA", panorama jako "fileB"
    const result = await runImportPipeline(sherloc, panorama, CUTOFF);

    expect(result.shipments).toHaveLength(1);
  });

  it("odrzuca gdy oba pliki to ten sam typ raportu", async () => {
    const a = panoramaFile([["1001", "", "", "", "", "", "", "", "", "P1R01"]]);
    const b = panoramaFile([["1002", "", "", "", "", "", "", "", "", "P1R02"]], "panorama2.xlsx");

    await expect(runImportPipeline(a, b, CUTOFF)).rejects.toThrow(PipelineError);
  });

  it("odrzuca plik z nierozpoznawalnymi naglowkami", async () => {
    const bad = buildXlsxFile(["Foo", "Bar"], [["1", "2"]]);
    const sherloc = sherlocFile([["1001", "Jan", "", "", ""]]);

    await expect(runImportPipeline(bad, sherloc, CUTOFF)).rejects.toThrow(PipelineError);
  });

  it("odrzuca gdy Panorama nie ma zadnych wierszy z Shipment ID", async () => {
    const emptyPanorama = panoramaFile([]);
    const sherloc = sherlocFile([["1001", "Jan", "", "", ""]]);

    await expect(runImportPipeline(emptyPanorama, sherloc, CUTOFF)).rejects.toThrow(PipelineError);
  });

  it("starsze przesylki (takze z poprzednich dni) zostaja; swieze skany i bez daty odpadaja; brak w bazie = Nieprzypisane", async () => {
    mockRoutesAndSorters();

    const panorama = panoramaFile([
      ["1001", "", "", "OK", "22/07/2026 10:00", "", "", "", "A", "P1R01"], // dzisiaj, starszy niz 15 min
      ["1002", "", "", "OK", "21/07/2026 10:00", "", "", "", "B", "P1R01"], // wczoraj -- zostaje
      ["1003", "", "", "OK", "22/07/2026 10:00", "", "", "", "C", "P1R01"], // nie ma go w bazie tras
      ["1004", "", "", "OK", "22/07/2026 11:50", "", "", "", "D", "P1R01"], // w oknie 15 min
      ["1005", "", "", "OK", "", "", "", "", "E", "P1R01"], // bez daty
    ]);
    const sherloc = sherlocFile([["1001", "A", "", "", ""]]);

    const result = await runImportPipeline(panorama, sherloc, CUTOFF);

    expect(result.summary.totalRows).toBe(5);
    expect(result.shipments.map((s) => [s.shipmentId, s.trasa, s.grupa])).toEqual([
      ["1001", "WAEX", "P1"],
      ["1002", "WAEX", "P1"],
      ["1003", "", "NIEPRZYPISANE"],
    ]);
    expect(result.summary.resultRows).toBe(3);
    expect(result.summary.recentSkippedRows).toBe(1);
    expect(result.summary.noDateRows).toBe(1);
    expect(result.summary.cutoffAt).toBe(CUTOFF.toISOString());
    expect(result.summary.przypisanieCounts).toEqual({ baza: 2, brak_w_bazie: 1, nieznana_trasa: 0 });
    expect(result.summary.groupCounts.NIEPRZYPISANE).toBe(1);
  });

  it("brak wgranej bazy przypisan tras -> import zablokowany (bez fallbacku po Chute ID)", async () => {
    mockRoutesAndSorters(null);
    const panorama = panoramaFile([["1001", "", "", "OK", "22/07/2026 10:00", "", "", "", "A", "P1R01"]]);
    const sherloc = sherlocFile([["1001", "A", "", "", ""]]);

    await expect(runImportPipeline(panorama, sherloc, CUTOFF)).rejects.toThrow(/nie została jeszcze wgrana/);
  });

  it("baza przypisan tras z poprzedniego dnia -> import zablokowany", async () => {
    mockRoutesAndSorters({ uploadedAt: new Date(2026, 6, 21, 18, 0, 0), pairs: [["1001", "WAEX"]] });
    const panorama = panoramaFile([["1001", "", "", "OK", "22/07/2026 10:00", "", "", "", "A", "P1R01"]]);
    const sherloc = sherlocFile([["1001", "A", "", "", ""]]);

    await expect(runImportPipeline(panorama, sherloc, CUTOFF)).rejects.toThrow(/jest z 21.07.2026/);
  });
});
