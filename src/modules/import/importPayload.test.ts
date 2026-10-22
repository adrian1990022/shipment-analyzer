import { describe, expect, it } from "vitest";
import { shipment } from "../../test/fixtures";
import { buildImportPayload, pruneBeforeDateKey, toShipmentRow } from "./importPayload";

const NOW = new Date(2026, 8, 28, 10, 0, 0); // 28 wrzesnia 2026

function isoLocal(y: number, mo: number, d: number, h = 10): string {
  return new Date(y, mo - 1, d, h, 0, 0).toISOString();
}

describe("toShipmentRow", () => {
  it("mapuje camelCase -> snake_case, puste stringi -> null", () => {
    const row = toShipmentRow(shipment({ remarks: "", hwx: "", rcvrCity: "Warszawa" }));
    expect(row.shipment_id).toBe(shipment().shipmentId);
    expect(row.remarks).toBeNull();
    expect(row.hwx).toBeNull();
    expect(row.rcvr_city).toBe("Warszawa");
    expect(row).not.toHaveProperty("import_id");
  });

  it("zachowuje liczby i null w polach liczbowych", () => {
    const row = toShipmentRow(shipment({ shpCalcWgt: null, shpTotPcs: 3, wystapilo: 2 }));
    expect(row.shp_calc_wgt).toBeNull();
    expect(row.shp_tot_pcs).toBe(3);
    expect(row.wystapilo).toBe(2);
  });
});

describe("pruneBeforeDateKey", () => {
  it("bez przesylek -> dzisiaj", () => {
    expect(pruneBeforeDateKey([], NOW)).toBe("2026-09-28");
  });

  it("najstarsza data skanu w imporcie", () => {
    const shipments = [
      shipment({ lastPhyCpDt: isoLocal(2026, 9, 27) }),
      shipment({ lastPhyCpDt: isoLocal(2026, 9, 25) }),
      shipment({ lastPhyCpDt: isoLocal(2026, 9, 28) }),
    ];
    expect(pruneBeforeDateKey(shipments, NOW)).toBe("2026-09-25");
  });

  it("przesylki bez daty sa pomijane, data z przyszlosci nie przesuwa granicy za dzis", () => {
    const shipments = [shipment({ lastPhyCpDt: null }), shipment({ lastPhyCpDt: isoLocal(2026, 9, 30) })];
    expect(pruneBeforeDateKey(shipments, NOW)).toBe("2026-09-28");
  });
});

describe("buildImportPayload", () => {
  it("buduje argumenty funkcji bazy import_shipments", () => {
    const payload = buildImportPayload(
      {
        summary: {
          totalRows: 5,
          matchedRows: 4,
          unmatchedRows: 1,
          unmappedRows: 1,
          resultRows: 2,
          recentSkippedRows: 1,
          noDateRows: 1,
          cutoffAt: null,
          groupCounts: { P1: 2, P2: 0, P3: 0, COY004: 0, MAGAZYN: 0, NIEPRZYPISANE: 0 },
          przypisanieCounts: { baza: 2, brak_w_bazie: 0, nieznana_trasa: 0 },
          bezSortujacegoRows: 0,
          routeBaseUploadedAt: null,
          panoramaFilename: "p.xlsx",
          sherlocFilename: "s.xlsx",
        },
        shipments: [
          shipment({ shipmentId: "1", lastPhyCpDt: isoLocal(2026, 9, 26) }),
          shipment({ shipmentId: "2", lastPhyCpDt: isoLocal(2026, 9, 28), przypisanie: "brak_w_bazie" }),
        ],
      },
      NOW
    );

    expect(payload.p_import).toEqual({
      panorama_filename: "p.xlsx",
      sherloc_filename: "s.xlsx",
      total_rows: 5,
      matched_rows: 4,
      unmatched_rows: 1,
      unmapped_rows: 1,
      today_rows: 2,
      group_counts: { P1: 2, P2: 0, P3: 0, COY004: 0, MAGAZYN: 0, NIEPRZYPISANE: 0 },
    });
    expect(payload.p_shipments.map((r) => r.shipment_id)).toEqual(["1", "2"]);
    expect(payload.p_shipments.map((r) => r.przypisanie)).toEqual(["baza", "brak_w_bazie"]);
    expect(payload.p_prune_before).toBe("2026-09-26");
  });
});
