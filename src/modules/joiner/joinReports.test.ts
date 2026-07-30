import { describe, expect, it } from "vitest";
import { panoramaRow, sherlocRow } from "../../test/fixtures";
import { joinReports } from "./joinReports";

describe("joinReports", () => {
  it("laczy poprawnie po Shipment ID = HWB No", () => {
    const panorama = [panoramaRow({ shipmentId: "1001" })];
    const sherloc = [sherlocRow({ hwbNo: "1001", receiverName: "Anna Nowak" })];

    const { rows, matchedCount, unmatchedCount } = joinReports(panorama, sherloc);

    expect(matchedCount).toBe(1);
    expect(unmatchedCount).toBe(0);
    expect(rows[0].sherloc?.receiverName).toBe("Anna Nowak");
  });

  it("dopasowanie jest niewrazliwe na spacje/wielkosc liter w kluczu", () => {
    const panorama = [panoramaRow({ shipmentId: " 1001 " })];
    const sherloc = [sherlocRow({ hwbNo: "1001" })];

    const { matchedCount } = joinReports(panorama, sherloc);

    expect(matchedCount).toBe(1);
  });

  it("rekord bez dopasowania w Sherloc dostaje sherloc: null", () => {
    const panorama = [panoramaRow({ shipmentId: "9999" })];

    const { rows, matchedCount, unmatchedCount } = joinReports(panorama, []);

    expect(matchedCount).toBe(0);
    expect(unmatchedCount).toBe(1);
    expect(rows[0].sherloc).toBeNull();
  });

  it("brakujacy HWB No w Sherloc (pusty string) nie dopasowuje niczego", () => {
    const panorama = [panoramaRow({ shipmentId: "1001" })];
    const sherloc = [sherlocRow({ hwbNo: "" })];

    const { rows, matchedCount } = joinReports(panorama, sherloc);

    expect(matchedCount).toBe(0);
    expect(rows[0].sherloc).toBeNull();
  });

  it("wiele rekordow: kazdy panorama dostaje swoje dopasowanie niezaleznie", () => {
    const panorama = [
      panoramaRow({ shipmentId: "1001" }),
      panoramaRow({ shipmentId: "1002" }),
      panoramaRow({ shipmentId: "1003" }),
    ];
    const sherloc = [
      sherlocRow({ hwbNo: "1001", receiverName: "A" }),
      sherlocRow({ hwbNo: "1003", receiverName: "C" }),
    ];

    const { rows, matchedCount, unmatchedCount } = joinReports(panorama, sherloc);

    expect(matchedCount).toBe(2);
    expect(unmatchedCount).toBe(1);
    expect(rows.map((r) => r.sherloc?.receiverName ?? null)).toEqual(["A", null, "C"]);
  });
});
