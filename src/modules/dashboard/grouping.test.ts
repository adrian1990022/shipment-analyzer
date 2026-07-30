import { describe, expect, it } from "vitest";
import { shipment } from "../../test/fixtures";
import {
  countByGrupa,
  hasTrasaLevel,
  shipmentsForSorter,
  shipmentsForTrasa,
  shipmentsInGrupa,
  sortersInGrupa,
  trasyInSorter,
} from "./grouping";

describe("hasTrasaLevel", () => {
  it("P1 i P3 maja dodatkowy poziom trasa, P2/COY004 nie", () => {
    expect(hasTrasaLevel("P1")).toBe(true);
    expect(hasTrasaLevel("P3")).toBe(true);
    expect(hasTrasaLevel("P2")).toBe(false);
    expect(hasTrasaLevel("COY004")).toBe(false);
  });
});

describe("countByGrupa / shipmentsInGrupa", () => {
  it("liczy i filtruje po P1/P2/P3/COY004 niezaleznie", () => {
    const shipments = [
      shipment({ grupa: "P1" }),
      shipment({ grupa: "P2" }),
      shipment({ grupa: "P2" }),
      shipment({ grupa: "COY004" }),
    ];

    expect(countByGrupa(shipments)).toEqual({ P1: 1, P2: 2, P3: 0, COY004: 1 });
    expect(shipmentsInGrupa(shipments, "P2")).toHaveLength(2);
    expect(shipmentsInGrupa(shipments, "P3")).toHaveLength(0);
  });
});

describe("sortersInGrupa", () => {
  it("grupuje po sortujacym, liczy wystapienia i zbiera trasy", () => {
    const shipments = [
      shipment({ sortujacy: "Jan Kowalski", trasa: "WAEX" }),
      shipment({ sortujacy: "Jan Kowalski", trasa: "WAEF" }),
      shipment({ sortujacy: "Anna Nowak", trasa: "WACA" }),
    ];

    const result = sortersInGrupa(shipments);

    expect(result).toEqual([
      { sortujacy: "Anna Nowak", count: 1, trasy: ["WACA"] },
      { sortujacy: "Jan Kowalski", count: 2, trasy: ["WAEF", "WAEX"] },
    ]);
  });

  it("sortuje sortujacych numerycznie, nie alfabetycznie", () => {
    const shipments = [
      shipment({ sortujacy: "10" }),
      shipment({ sortujacy: "2" }),
      shipment({ sortujacy: "1" }),
    ];

    expect(sortersInGrupa(shipments).map((s) => s.sortujacy)).toEqual(["1", "2", "10"]);
  });
});

describe("shipmentsForSorter / trasyInSorter / shipmentsForTrasa", () => {
  it("filtruje po sortujacym i wylicza trasy w jego obrebie", () => {
    const shipments = [
      shipment({ sortujacy: "Jan Kowalski", trasa: "WAEX" }),
      shipment({ sortujacy: "Jan Kowalski", trasa: "WAEX" }),
      shipment({ sortujacy: "Anna Nowak", trasa: "WACA" }),
    ];

    const forSorter = shipmentsForSorter(shipments, "Jan Kowalski");
    expect(forSorter).toHaveLength(2);
    expect(trasyInSorter(forSorter)).toEqual([{ trasa: "WAEX", count: 2 }]);
  });

  it("trasyInSorter sortuje alfabetycznie gdy jest wiecej niz jedna trasa", () => {
    const shipments = [shipment({ trasa: "WAEF" }), shipment({ trasa: "WAEX" }), shipment({ trasa: "WAEF" })];
    expect(trasyInSorter(shipments)).toEqual([
      { trasa: "WAEF", count: 2 },
      { trasa: "WAEX", count: 1 },
    ]);
  });

  it("filtruje po dokladnej trasie", () => {
    const shipments = [shipment({ trasa: "WAEX" }), shipment({ trasa: "WAEF" })];
    expect(shipmentsForTrasa(shipments, "WAEX")).toHaveLength(1);
  });
});
