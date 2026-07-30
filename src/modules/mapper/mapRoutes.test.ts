import { describe, expect, it } from "vitest";
import { panoramaRow, routeRef, sherlocRow } from "../../test/fixtures";
import type { JoinedRow } from "../joiner/joinReports";
import { mapRoutes } from "./mapRoutes";

function joined(panoramaOverrides = {}, sherloc: ReturnType<typeof sherlocRow> | null = null): JoinedRow {
  return { panorama: panoramaRow(panoramaOverrides), sherloc };
}

describe("mapRoutes", () => {
  it("poprawnie mapuje trase przez routes (Chute ID -> Trasa/Grupa)", () => {
    const rows = [joined({ chuteId: "P1R01" })];
    const routes = [routeRef({ chuteId: "P1R01", trasa: "WAEX", grupa: "P1" })];

    const { shipments, unmappedChuteIds, unmappedRowCount } = mapRoutes(
      rows,
      routes,
      new Map(),
      new Map()
    );

    expect(shipments).toHaveLength(1);
    expect(shipments[0].trasa).toBe("WAEX");
    expect(shipments[0].grupa).toBe("P1");
    expect(unmappedChuteIds).toEqual([]);
    expect(unmappedRowCount).toBe(0);
  });

  it("brak trasy (Chute ID spoza tabeli routes) -> rekord pomijany, zliczony jako unmapped", () => {
    const rows = [joined({ chuteId: "NIEZNANY" })];

    const { shipments, unmappedChuteIds, unmappedRowCount } = mapRoutes(
      rows,
      [],
      new Map(),
      new Map()
    );

    expect(shipments).toHaveLength(0);
    expect(unmappedChuteIds).toEqual(["NIEZNANY"]);
    expect(unmappedRowCount).toBe(1);
  });

  it("brak bramy (pusty Chute ID) -> tez traktowany jako niezmapowany", () => {
    const rows = [joined({ chuteId: "" })];

    const { shipments, unmappedRowCount } = mapRoutes(rows, [], new Map(), new Map());

    expect(shipments).toHaveLength(0);
    expect(unmappedRowCount).toBe(1);
  });

  it("Chute ID = COY004 pomija tabele routes, trasa i grupa = COY004", () => {
    const rows = [joined({ chuteId: "COY004" })];

    const { shipments } = mapRoutes(rows, [], new Map(), new Map());

    expect(shipments[0].trasa).toBe("COY004");
    expect(shipments[0].grupa).toBe("COY004");
  });

  it("fallback: bez wpisu w sorterNameByTrasa, sortujacy = 3. litera trasy", () => {
    const rows = [joined({ chuteId: "P1R01" })];
    const routes = [routeRef({ chuteId: "P1R01", trasa: "WAEX", grupa: "P1" })];

    const { shipments } = mapRoutes(rows, routes, new Map(), new Map());

    expect(shipments[0].sortujacy).toBe("E"); // 3. znak "WAEX"
  });

  it("przypisanie przez sorter_routes ma pierwszenstwo nad fallbackiem", () => {
    const rows = [joined({ chuteId: "P1R01" })];
    const routes = [routeRef({ chuteId: "P1R01", trasa: "WAEX", grupa: "P1" })];
    const sorterNameByTrasa = new Map([["WAEX", "Jan Kowalski"]]);

    const { shipments } = mapRoutes(rows, routes, new Map(), sorterNameByTrasa);

    expect(shipments[0].sortujacy).toBe("Jan Kowalski");
  });

  it("sorterFromTrasa: trasa krotsza niz 3 znaki spada na cala trasa uppercase", () => {
    const rows = [joined({ chuteId: "X1" })];
    const routes = [routeRef({ chuteId: "X1", trasa: "ab", grupa: "P2" })];

    const { shipments } = mapRoutes(rows, routes, new Map(), new Map());

    expect(shipments[0].sortujacy).toBe("AB");
  });

  it("sorterFromTrasa: pusta trasa (teoretyczny brzeg) daje '?'", () => {
    const rows = [joined({ chuteId: "X2" })];
    const routes = [routeRef({ chuteId: "X2", trasa: "", grupa: "P2" })];

    const { shipments } = mapRoutes(rows, routes, new Map(), new Map());

    expect(shipments[0].sortujacy).toBe("?");
  });

  it("dolacza dane z Sherloc gdy sa dopasowane", () => {
    const rows = [joined({ chuteId: "P1R01" }, sherlocRow({ receiverName: "Anna Nowak" }))];
    const routes = [routeRef({ chuteId: "P1R01" })];

    const { shipments } = mapRoutes(rows, routes, new Map(), new Map());

    expect(shipments[0].receiverName).toBe("Anna Nowak");
  });

  it("bez dopasowania w Sherloc pola odbiorcy sa pustymi stringami", () => {
    const rows = [joined({ chuteId: "P1R01" }, null)];
    const routes = [routeRef({ chuteId: "P1R01" })];

    const { shipments } = mapRoutes(rows, routes, new Map(), new Map());

    expect(shipments[0].receiverName).toBe("");
    expect(shipments[0].rcvrAddr1).toBe("");
    expect(shipments[0].rcvrPostcode).toBe("");
    expect(shipments[0].rcvrCity).toBe("");
  });

  it("wystapilo pochodzi z occurrenceCounts, domyslnie 1 gdy brak wpisu", () => {
    const rows = [joined({ chuteId: "P1R01", shipmentId: "1001" })];
    const routes = [routeRef({ chuteId: "P1R01" })];

    const withCount = mapRoutes(rows, routes, new Map([["1001", 3]]), new Map());
    expect(withCount.shipments[0].wystapilo).toBe(3);

    const withoutCount = mapRoutes(rows, routes, new Map(), new Map());
    expect(withoutCount.shipments[0].wystapilo).toBe(1);
  });

  it("poprawna/bledna data w Last Phy Cp dt -> ISO string albo null", () => {
    const rows = [
      joined({ chuteId: "P1R01", lastPhyCpDt: "22/07/2026 10:00" }),
      joined({ chuteId: "P1R01", lastPhyCpDt: "nie-data" }),
    ];
    const routes = [routeRef({ chuteId: "P1R01" })];

    const { shipments } = mapRoutes(rows, routes, new Map(), new Map());

    expect(shipments[0].lastPhyCpDt).not.toBeNull();
    expect(shipments[1].lastPhyCpDt).toBeNull();
  });

  it("Chute ID dopasowywany bez wzgledu na wielkosc liter/spacje", () => {
    const rows = [joined({ chuteId: " p1r01 " })];
    const routes = [routeRef({ chuteId: "P1R01", trasa: "WAEX" })];

    const { shipments, unmappedRowCount } = mapRoutes(rows, routes, new Map(), new Map());

    expect(unmappedRowCount).toBe(0);
    expect(shipments[0].trasa).toBe("WAEX");
  });

  it("wiele niezmapowanych Chute ID zbiera sie w unikalna liste", () => {
    const rows = [joined({ chuteId: "AAA" }), joined({ chuteId: "AAA" }), joined({ chuteId: "BBB" })];

    const { unmappedChuteIds, unmappedRowCount } = mapRoutes(rows, [], new Map(), new Map());

    expect(unmappedRowCount).toBe(3);
    expect(unmappedChuteIds.sort()).toEqual(["AAA", "BBB"]);
  });
});
