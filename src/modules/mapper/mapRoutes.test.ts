import { describe, expect, it } from "vitest";
import { panoramaRow, routeRef, sherlocRow } from "../../test/fixtures";
import type { JoinedRow } from "../joiner/joinReports";
import { isCoy004Trasa, isMagazynTrasa, mapRoutes } from "./mapRoutes";

function joined(panoramaOverrides = {}, sherloc: ReturnType<typeof sherlocRow> | null = null): JoinedRow {
  return { panorama: panoramaRow(panoramaOverrides), sherloc };
}

// Baza przypisan tras: znormalizowany numer -> trasa.
function base(pairs: [string, string][]): Map<string, string> {
  return new Map(pairs);
}

const ROUTES = [
  routeRef({ id: 1, chuteId: "P1R01", trasa: "WAEX", grupa: "P1" }),
  routeRef({ id: 2, chuteId: "P2R01", trasa: "WALC", grupa: "P2" }),
  routeRef({ id: 3, chuteId: "P3R01", trasa: "WAFB", grupa: "P3" }),
];

describe("mapRoutes -- baza przypisan tras (2026-10-21)", () => {
  it("numer w bazie, trasa znana w routes -> trasa i grupa z bazy, przypisanie 'baza'", () => {
    const { shipments, przypisanieCounts } = mapRoutes(
      [joined({ shipmentId: "123456789", chuteId: "P1R01" })],
      ROUTES,
      new Map(),
      new Map([["WAEX", "Jan Kowalski"]]),
      base([["123456789", "WAEX"]])
    );

    expect(shipments[0]).toMatchObject({ trasa: "WAEX", grupa: "P1", przypisanie: "baza", sortujacy: "Jan Kowalski" });
    expect(przypisanieCounts).toEqual({ baza: 1, brak_w_bazie: 0, nieznana_trasa: 0 });
  });

  it("Chute ID wskazuje inna trase -> pierwszenstwo ma baza", () => {
    const { shipments } = mapRoutes(
      [joined({ shipmentId: "123456789", chuteId: "P1R01" })], // Chute ID -> WAEX/P1
      ROUTES,
      new Map(),
      new Map(),
      base([["123456789", "WAFB"]])
    );

    expect(shipments[0]).toMatchObject({ trasa: "WAFB", grupa: "P3" });
  });

  it("przyklad z zadania: Chute ID COY004, w bazie WAEX -> WAEX", () => {
    const { shipments } = mapRoutes(
      [joined({ shipmentId: "123456789", chuteId: "COY004" })],
      ROUTES,
      new Map(),
      new Map(),
      base([["123456789", "WAEX"]])
    );

    expect(shipments[0]).toMatchObject({ trasa: "WAEX", grupa: "P1", przypisanie: "baza" });
  });

  it("numeru nie ma w bazie -> przesylka zostaje, NIEPRZYPISANE, bez trasy i sortujacego", () => {
    const { shipments, przypisanieCounts, bezSortujacegoRows } = mapRoutes(
      [joined({ shipmentId: "999", chuteId: "P1R01" })], // Chute ID wskazywalby WAEX
      ROUTES,
      new Map(),
      new Map([["WAEX", "Jan Kowalski"]]),
      base([["123", "WAEX"]])
    );

    expect(shipments).toHaveLength(1);
    expect(shipments[0]).toMatchObject({ trasa: "", grupa: "NIEPRZYPISANE", sortujacy: "", przypisanie: "brak_w_bazie" });
    expect(przypisanieCounts.brak_w_bazie).toBe(1);
    // Brak trasy to nie "brak sortujacego" -- osobny stan.
    expect(bezSortujacegoRows).toBe(0);
  });

  it("pusta baza -> wszystkie przesylki NIEPRZYPISANE (bez fallbacku po Chute ID)", () => {
    const { shipments } = mapRoutes(
      [joined({ shipmentId: "1", chuteId: "P1R01" }), joined({ shipmentId: "2", chuteId: "COY004" })],
      ROUTES,
      new Map(),
      new Map(),
      new Map()
    );

    expect(shipments.map((s) => s.grupa)).toEqual(["NIEPRZYPISANE", "NIEPRZYPISANE"]);
  });

  it("trasa z bazy spoza routes -> trasa zachowana, NIEPRZYPISANE / nieznana_trasa", () => {
    const { shipments, przypisanieCounts } = mapRoutes(
      [joined({ shipmentId: "123" })],
      ROUTES,
      new Map(),
      new Map(),
      base([["123", "WAZZ"]])
    );

    expect(shipments[0]).toMatchObject({ trasa: "WAZZ", grupa: "NIEPRZYPISANE", przypisanie: "nieznana_trasa" });
    expect(przypisanieCounts.nieznana_trasa).toBe(1);
  });

  it("trasa z 'O' na 3. miejscu -> COY004, niezaleznie od routes", () => {
    const { shipments } = mapRoutes(
      [joined({ shipmentId: "1" }), joined({ shipmentId: "2" })],
      [...ROUTES, routeRef({ id: 9, chuteId: "P2R09", trasa: "WAOB", grupa: "P2" })],
      new Map(),
      new Map(),
      base([
        ["1", "WAOA"],
        ["2", "WAOB"],
      ])
    );

    expect(shipments.map((s) => [s.trasa, s.grupa, s.przypisanie])).toEqual([
      ["WAOA", "COY004", "baza"],
      ["WAOB", "COY004", "baza"],
    ]);
  });

  it("WAGM / WAW1 -> MAGAZYN (2026-10-22), takze gdyby byly w routes", () => {
    const { shipments, przypisanieCounts } = mapRoutes(
      [joined({ shipmentId: "1" }), joined({ shipmentId: "2" })],
      [...ROUTES, routeRef({ id: 9, chuteId: "X", trasa: "WAGM", grupa: "P2" })],
      new Map(),
      new Map(),
      base([
        ["1", "WAGM"],
        ["2", "WAW1"],
      ])
    );

    expect(shipments.map((s) => [s.trasa, s.grupa, s.przypisanie])).toEqual([
      ["WAGM", "MAGAZYN", "baza"],
      ["WAW1", "MAGAZYN", "baza"],
    ]);
    expect(przypisanieCounts.baza).toBe(2);
  });

  it("isMagazynTrasa: tylko WAGM i WAW1", () => {
    expect(isMagazynTrasa("WAGM")).toBe(true);
    expect(isMagazynTrasa("WAW1")).toBe(true);
    expect(isMagazynTrasa("WAEX")).toBe(false);
    expect(isMagazynTrasa("WAOA")).toBe(false);
  });

  it("isCoy004Trasa: tylko 3. znak = O", () => {
    expect(isCoy004Trasa("WAOA")).toBe(true);
    expect(isCoy004Trasa("WABA")).toBe(false);
    expect(isCoy004Trasa("OAAA")).toBe(false);
    expect(isCoy004Trasa("")).toBe(false);
  });

  it("trasa bez sortujacego -> trasa zostaje, sortujacy '' (bez fallbacku z 3. litery)", () => {
    const { shipments, bezSortujacegoRows } = mapRoutes(
      [joined({ shipmentId: "1" })],
      ROUTES,
      new Map(),
      new Map(),
      base([["1", "WALC"]])
    );

    expect(shipments[0]).toMatchObject({ trasa: "WALC", grupa: "P2", sortujacy: "" });
    expect(bezSortujacegoRows).toBe(1);
  });

  it("sortujacy z sorter_routes dla trasy z bazy", () => {
    const { shipments } = mapRoutes(
      [joined({ shipmentId: "1" })],
      ROUTES,
      new Map(),
      new Map([["WAFB", "Anna Nowak"]]),
      base([["1", "WAFB"]])
    );

    expect(shipments[0].sortujacy).toBe("Anna Nowak");
  });

  it("Shipment ID dopasowywany po normalizacji (spacje, wielkosc liter), zera wiodace zachowane", () => {
    const { shipments } = mapRoutes(
      [joined({ shipmentId: " 0012 345 " }), joined({ shipmentId: "12345" }), joined({ shipmentId: "jd01" })],
      ROUTES,
      new Map(),
      new Map(),
      base([
        ["0012345", "WAEX"],
        ["JD01", "WALC"],
      ])
    );

    expect(shipments.map((s) => s.trasa)).toEqual(["WAEX", "", "WALC"]);
  });

  it("dubel Chute ID nie mnozy juz przesylki -- jedna przesylka, jedna trasa", () => {
    const { shipments } = mapRoutes(
      [joined({ shipmentId: "1", chuteId: "P1R01" })],
      [routeRef({ id: 1, chuteId: "P1R01", trasa: "WAEX", grupa: "P1" }), routeRef({ id: 2, chuteId: "P1R01", trasa: "WAFB", grupa: "P3" })],
      new Map(),
      new Map(),
      base([["1", "WAEX"]])
    );

    expect(shipments).toHaveLength(1);
  });

  it("trasa kilka razy w routes (rozne Chute ID) -> grupa z pierwszego wpisu", () => {
    const { shipments } = mapRoutes(
      [joined({ shipmentId: "1" })],
      [routeRef({ id: 1, chuteId: "A", trasa: "WAEX", grupa: "P1" }), routeRef({ id: 2, chuteId: "B", trasa: " waex ", grupa: "P2" })],
      new Map(),
      new Map(),
      base([["1", "WAEX"]])
    );

    expect(shipments[0].grupa).toBe("P1");
  });

  it("dolacza dane z Sherloc i zachowuje Chute ID z Panoramy", () => {
    const { shipments } = mapRoutes(
      [joined({ shipmentId: "1", chuteId: " P1R01 " }, sherlocRow({ receiverName: "Anna Nowak" }))],
      ROUTES,
      new Map(),
      new Map(),
      base([["1", "WAEX"]])
    );

    expect(shipments[0].receiverName).toBe("Anna Nowak");
    expect(shipments[0].chuteId).toBe("P1R01");
  });

  it("bez dopasowania w Sherloc pola odbiorcy sa pustymi stringami", () => {
    const { shipments } = mapRoutes([joined({ shipmentId: "1" }, null)], ROUTES, new Map(), new Map(), base([["1", "WAEX"]]));

    expect(shipments[0]).toMatchObject({ receiverName: "", rcvrAddr1: "", rcvrPostcode: "", rcvrCity: "" });
  });

  it("wystapilo pochodzi z occurrenceCounts, domyslnie 1 gdy brak wpisu", () => {
    const rows = [joined({ shipmentId: "1001" })];
    const b = base([["1001", "WAEX"]]);

    expect(mapRoutes(rows, ROUTES, new Map([["1001", 3]]), new Map(), b).shipments[0].wystapilo).toBe(3);
    expect(mapRoutes(rows, ROUTES, new Map(), new Map(), b).shipments[0].wystapilo).toBe(1);
  });

  it("poprawna/bledna data w Last Phy Cp dt -> ISO string albo null", () => {
    const rows = [
      joined({ shipmentId: "1", lastPhyCpDt: "22/07/2026 10:00" }),
      joined({ shipmentId: "2", lastPhyCpDt: "nie-data" }),
    ];

    const { shipments } = mapRoutes(rows, ROUTES, new Map(), new Map(), new Map());

    expect(shipments[0].lastPhyCpDt).not.toBeNull();
    expect(shipments[1].lastPhyCpDt).toBeNull();
  });
});
