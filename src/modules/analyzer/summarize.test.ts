import { describe, expect, it } from "vitest";
import { shipment } from "../../test/fixtures";
import { summarize } from "./summarize";

describe("summarize", () => {
  it("liczy bledy/rekordy (totalRows, matchedRows, unmatchedRows, unmappedRows, resultRows)", () => {
    const result = summarize({
      totalRows: 10,
      matchedRows: 8,
      unmatchedRows: 2,
      unmappedRows: 1,
      shipments: [shipment(), shipment({ shipmentId: "1002" })],
      panoramaFilename: "panorama.xlsx",
      sherlocFilename: "sherloc.xlsx",
    });

    expect(result.totalRows).toBe(10);
    expect(result.matchedRows).toBe(8);
    expect(result.unmatchedRows).toBe(2);
    expect(result.unmappedRows).toBe(1);
    expect(result.resultRows).toBe(2);
    expect(result.panoramaFilename).toBe("panorama.xlsx");
    expect(result.sherlocFilename).toBe("sherloc.xlsx");
  });

  it("grupuje poprawnie po P1/P2/P3/COY004 (Dashboard)", () => {
    const result = summarize({
      totalRows: 4,
      matchedRows: 4,
      unmatchedRows: 0,
      unmappedRows: 0,
      shipments: [
        shipment({ grupa: "P1" }),
        shipment({ grupa: "P1" }),
        shipment({ grupa: "P2" }),
        shipment({ grupa: "P3" }),
      ],
      panoramaFilename: "p.xlsx",
      sherlocFilename: "s.xlsx",
    });

    expect(result.groupCounts).toEqual({ P1: 2, P2: 1, P3: 1, COY004: 0, MAGAZYN: 0, NIEPRZYPISANE: 0 });
  });

  it("COY004 liczy sie osobno od P1/P2/P3", () => {
    const result = summarize({
      totalRows: 1,
      matchedRows: 1,
      unmatchedRows: 0,
      unmappedRows: 0,
      shipments: [shipment({ grupa: "COY004" })],
      panoramaFilename: "p.xlsx",
      sherlocFilename: "s.xlsx",
    });

    expect(result.groupCounts.COY004).toBe(1);
    expect(result.groupCounts.P1).toBe(0);
  });

  it("brak przesylek -> wszystkie liczniki grup = 0", () => {
    const result = summarize({
      totalRows: 0,
      matchedRows: 0,
      unmatchedRows: 0,
      unmappedRows: 0,
      shipments: [],
      panoramaFilename: "p.xlsx",
      sherlocFilename: "s.xlsx",
    });

    expect(result.groupCounts).toEqual({ P1: 0, P2: 0, P3: 0, COY004: 0, MAGAZYN: 0, NIEPRZYPISANE: 0 });
    expect(result.resultRows).toBe(0);
  });

  it("przenosi liczniki przypisania, brak sortujacego i date bazy; NIEPRZYPISANE liczone osobno", () => {
    const result = summarize({
      totalRows: 2,
      matchedRows: 2,
      unmatchedRows: 0,
      unmappedRows: 1,
      shipments: [shipment({ grupa: "P1" }), shipment({ grupa: "NIEPRZYPISANE", trasa: "", przypisanie: "brak_w_bazie" })],
      przypisanieCounts: { baza: 1, brak_w_bazie: 1, nieznana_trasa: 0 },
      bezSortujacegoRows: 1,
      routeBaseUploadedAt: "2026-10-21T05:00:00.000Z",
      panoramaFilename: "p.xlsx",
      sherlocFilename: "s.xlsx",
    });

    expect(result.groupCounts.NIEPRZYPISANE).toBe(1);
    expect(result.przypisanieCounts).toEqual({ baza: 1, brak_w_bazie: 1, nieznana_trasa: 0 });
    expect(result.bezSortujacegoRows).toBe(1);
    expect(result.routeBaseUploadedAt).toBe("2026-10-21T05:00:00.000Z");
  });
});
