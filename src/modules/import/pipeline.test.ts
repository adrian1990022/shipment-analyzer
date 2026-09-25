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

function mockRoutesAndSorters() {
  supabase.from
    .mockReturnValueOnce(
      createQueryBuilderMock({
        data: [
          {
            id: 1,
            chute_id: "P1R01",
            trasa: "WAEX",
            grupa: "P1",
            created_at: "t",
            updated_at: "t",
          },
        ],
      })
    )
    .mockReturnValueOnce(createQueryBuilderMock({ data: [] }));
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

  it("starsze przesylki (takze z poprzednich dni) zostaja; swieze skany, bez daty i niezmapowane bramy odpadaja", async () => {
    mockRoutesAndSorters();

    const panorama = panoramaFile([
      ["1001", "", "", "OK", "22/07/2026 10:00", "", "", "", "A", "P1R01"], // dzisiaj, starszy niz 15 min
      ["1002", "", "", "OK", "21/07/2026 10:00", "", "", "", "B", "P1R01"], // wczoraj -- zostaje
      ["1003", "", "", "OK", "22/07/2026 10:00", "", "", "", "C", "NIEZNANY"], // niezmapowany
      ["1004", "", "", "OK", "22/07/2026 11:50", "", "", "", "D", "P1R01"], // w oknie 15 min
      ["1005", "", "", "OK", "", "", "", "", "E", "P1R01"], // bez daty
    ]);
    const sherloc = sherlocFile([["1001", "A", "", "", ""]]);

    const result = await runImportPipeline(panorama, sherloc, CUTOFF);

    expect(result.summary.totalRows).toBe(5);
    expect(result.shipments.map((s) => s.shipmentId)).toEqual(["1001", "1002"]);
    expect(result.summary.resultRows).toBe(2);
    expect(result.summary.recentSkippedRows).toBe(1);
    expect(result.summary.noDateRows).toBe(1);
    expect(result.summary.cutoffAt).toBe(CUTOFF.toISOString());
    expect(result.unmappedChuteIds).toEqual(["NIEZNANY"]);
  });
});
