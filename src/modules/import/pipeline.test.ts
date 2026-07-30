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

describe("runImportPipeline", () => {
  beforeEach(() => {
    supabase.from.mockReset();
    vi.setSystemTime(new Date(2026, 6, 22, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("laczy Panorama+Sherloc, filtruje do dzis, mapuje trasy end-to-end", async () => {
    mockRoutesAndSorters();

    const panorama = panoramaFile([
      ["1001", "", "", "OK", "22/07/2026 10:00", "", "", "", "Jan Kowalski", "P1R01"],
    ]);
    const sherloc = sherlocFile([["1001", "Jan Kowalski", "ul. Testowa 1", "00-001", "Warszawa"]]);

    const result = await runImportPipeline(panorama, sherloc);

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
    const result = await runImportPipeline(sherloc, panorama);

    expect(result.shipments).toHaveLength(1);
  });

  it("odrzuca gdy oba pliki to ten sam typ raportu", async () => {
    const a = panoramaFile([["1001", "", "", "", "", "", "", "", "", "P1R01"]]);
    const b = panoramaFile([["1002", "", "", "", "", "", "", "", "", "P1R02"]], "panorama2.xlsx");

    await expect(runImportPipeline(a, b)).rejects.toThrow(PipelineError);
  });

  it("odrzuca plik z nierozpoznawalnymi naglowkami", async () => {
    const bad = buildXlsxFile(["Foo", "Bar"], [["1", "2"]]);
    const sherloc = sherlocFile([["1001", "Jan", "", "", ""]]);

    await expect(runImportPipeline(bad, sherloc)).rejects.toThrow(PipelineError);
  });

  it("odrzuca gdy Panorama nie ma zadnych wierszy z Shipment ID", async () => {
    const emptyPanorama = panoramaFile([]);
    const sherloc = sherlocFile([["1001", "Jan", "", "", ""]]);

    await expect(runImportPipeline(emptyPanorama, sherloc)).rejects.toThrow(PipelineError);
  });

  it("rekordy spoza dzisiejszej daty i niezmapowane bramy nie trafiaja do wyniku", async () => {
    mockRoutesAndSorters();

    const panorama = panoramaFile([
      ["1001", "", "", "OK", "22/07/2026 10:00", "", "", "", "A", "P1R01"], // dzisiaj, zmapowany
      ["1002", "", "", "OK", "21/07/2026 10:00", "", "", "", "B", "P1R01"], // wczoraj
      ["1003", "", "", "OK", "22/07/2026 10:00", "", "", "", "C", "NIEZNANY"], // dzis, niezmapowany
    ]);
    const sherloc = sherlocFile([["1001", "A", "", "", ""]]);

    const result = await runImportPipeline(panorama, sherloc);

    expect(result.summary.totalRows).toBe(3);
    expect(result.shipments).toHaveLength(1);
    expect(result.unmappedChuteIds).toEqual(["NIEZNANY"]);
  });
});
