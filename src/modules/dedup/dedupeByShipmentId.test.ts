import { describe, expect, it } from "vitest";
import { panoramaRow } from "../../test/fixtures";
import type { JoinedRow } from "../joiner/joinReports";
import { dedupeByShipmentId } from "./dedupeByShipmentId";

function joined(shipmentId: string): JoinedRow {
  return { panorama: panoramaRow({ shipmentId }), sherloc: null };
}

describe("dedupeByShipmentId", () => {
  it("brak duplikatow -- wszystkie wiersze zostaja, wystapienia = 1", () => {
    const rows = [joined("1001"), joined("1002"), joined("1003")];
    const { rows: result, occurrenceCounts } = dedupeByShipmentId(rows);

    expect(result).toHaveLength(3);
    expect(occurrenceCounts.get("1001")).toBe(1);
    expect(occurrenceCounts.get("1002")).toBe(1);
    expect(occurrenceCounts.get("1003")).toBe(1);
  });

  it("dwa identyczne Shipment ID -> jeden wiersz, wystapienia = 2", () => {
    const rows = [joined("1001"), joined("1001")];
    const { rows: result, occurrenceCounts } = dedupeByShipmentId(rows);

    expect(result).toHaveLength(1);
    expect(occurrenceCounts.get("1001")).toBe(2);
  });

  it("trzy identyczne Shipment ID -> jeden wiersz, wystapienia = 3", () => {
    const rows = [joined("1001"), joined("1001"), joined("1001")];
    const { rows: result, occurrenceCounts } = dedupeByShipmentId(rows);

    expect(result).toHaveLength(1);
    expect(occurrenceCounts.get("1001")).toBe(3);
  });

  it("zachowuje PIERWSZE wystapienie jako reprezentanta", () => {
    const first = { panorama: panoramaRow({ shipmentId: "1001", remarks: "pierwszy" }), sherloc: null };
    const second = { panorama: panoramaRow({ shipmentId: "1001", remarks: "drugi" }), sherloc: null };

    const { rows } = dedupeByShipmentId([first, second]);

    expect(rows[0].panorama.remarks).toBe("pierwszy");
  });

  it("mieszany zestaw: kazdy Shipment ID dostaje poprawny licznik niezaleznie", () => {
    const rows = [joined("1001"), joined("1002"), joined("1001"), joined("1001"), joined("1003")];
    const { rows: result, occurrenceCounts } = dedupeByShipmentId(rows);

    expect(result).toHaveLength(3);
    expect(occurrenceCounts.get("1001")).toBe(3);
    expect(occurrenceCounts.get("1002")).toBe(1);
    expect(occurrenceCounts.get("1003")).toBe(1);
  });
});
