import { describe, expect, it } from "vitest";
import {
  formatTimeHHmm,
  isSameLocalDay,
  naturalCompare,
  normalizeJoinKey,
  parseFlexibleDate,
  parseNumber,
  toLocalDateKey,
} from "./normalize";

describe("normalizeJoinKey", () => {
  it("trimuje, uppercase'uje i usuwa spacje wewnetrzne", () => {
    expect(normalizeJoinKey("  1001 ")).toBe("1001");
    expect(normalizeJoinKey("p1 r01")).toBe("P1R01");
  });
});

describe("parseFlexibleDate", () => {
  it("parsuje format ISO z czasem", () => {
    const d = parseFlexibleDate("2026-07-22 10:30:00");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(6);
    expect(d?.getDate()).toBe(22);
    expect(d?.getHours()).toBe(10);
  });

  it("parsuje format ISO bez czasu", () => {
    const d = parseFlexibleDate("2026-07-22");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getDate()).toBe(22);
  });

  it("parsuje format europejski dd/mm/yyyy z czasem", () => {
    const d = parseFlexibleDate("22/07/2026 14:05");
    expect(d?.getDate()).toBe(22);
    expect(d?.getMonth()).toBe(6);
    expect(d?.getHours()).toBe(14);
  });

  it("parsuje format europejski z kropkami/myslnikami jako separatorami", () => {
    expect(parseFlexibleDate("22.07.2026")?.getDate()).toBe(22);
    expect(parseFlexibleDate("22-07-2026")?.getDate()).toBe(22);
  });

  it("uzupelnia brakujaca godzine/minute/sekunde zerami, gdy podano tylko czesc czasu", () => {
    const isoHourOnly = parseFlexibleDate("2026-07-22 10");
    expect(isoHourOnly?.getHours()).toBe(10);
    expect(isoHourOnly?.getMinutes()).toBe(0);

    const euDateOnly = parseFlexibleDate("22/07/2026");
    expect(euDateOnly?.getHours()).toBe(0);
    expect(euDateOnly?.getMinutes()).toBe(0);
  });

  it("zwraca null dla pustego stringa", () => {
    expect(parseFlexibleDate("")).toBeNull();
    expect(parseFlexibleDate("   ")).toBeNull();
  });

  it("zwraca null dla blednego formatu (nie zgaduje)", () => {
    expect(parseFlexibleDate("nie-data")).toBeNull();
    expect(parseFlexibleDate("22-2026")).toBeNull();
  });
});

describe("parseNumber", () => {
  it("parsuje liczby z kropka i przecinkiem jako separatorem dziesietnym", () => {
    expect(parseNumber("3.05")).toBe(3.05);
    expect(parseNumber("3,05")).toBe(3.05);
  });

  it("zwraca null dla pustego stringa", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("   ")).toBeNull();
  });

  it("zwraca null dla nieliczbowej wartosci", () => {
    expect(parseNumber("abc")).toBeNull();
  });
});

describe("isSameLocalDay", () => {
  it("true dla tej samej daty (rozny czas)", () => {
    expect(isSameLocalDay(new Date(2026, 6, 22, 1), new Date(2026, 6, 22, 23))).toBe(true);
  });

  it("false dla roznych dni/miesiecy/lat", () => {
    expect(isSameLocalDay(new Date(2026, 6, 22), new Date(2026, 6, 21))).toBe(false);
    expect(isSameLocalDay(new Date(2026, 6, 22), new Date(2026, 5, 22))).toBe(false);
    expect(isSameLocalDay(new Date(2026, 6, 22), new Date(2025, 6, 22))).toBe(false);
  });
});

describe("formatTimeHHmm", () => {
  it("zwraca — dla null", () => {
    expect(formatTimeHHmm(null)).toBe("—");
  });

  it("zwraca — dla niepoprawnego stringa", () => {
    expect(formatTimeHHmm("nie-data")).toBe("—");
  });

  it("formatuje HH:mm w czasie lokalnym (round-trip lokalny -> UTC -> lokalny, niezalezny od strefy testu)", () => {
    const iso = new Date(2026, 6, 23, 7, 30, 56).toISOString();
    expect(formatTimeHHmm(iso)).toBe("07:30");
  });

  it("dopelnia zerami godziny/minuty ponizej 10", () => {
    const iso = new Date(2026, 6, 23, 9, 5, 0).toISOString();
    expect(formatTimeHHmm(iso)).toBe("09:05");
  });
});

describe("toLocalDateKey", () => {
  it("zwraca null dla null", () => {
    expect(toLocalDateKey(null)).toBeNull();
  });

  it("zwraca null dla niepoprawnego stringa", () => {
    expect(toLocalDateKey("nie-data")).toBeNull();
  });

  it("formatuje YYYY-MM-DD w czasie lokalnym", () => {
    const iso = new Date(2026, 6, 23, 7, 30, 56).toISOString();
    expect(toLocalDateKey(iso)).toBe("2026-07-23");
  });

  it("dopelnia zerami miesiac/dzien ponizej 10", () => {
    const iso = new Date(2026, 0, 5, 12, 0, 0).toISOString();
    expect(toLocalDateKey(iso)).toBe("2026-01-05");
  });
});

describe("naturalCompare", () => {
  it("sortuje liczby numerycznie, nie alfabetycznie ('Sortujący 2' przed 'Sortujący 10')", () => {
    const values = ["Sortujący 10", "Sortujący 2", "Sortujący 1"];
    expect([...values].sort(naturalCompare)).toEqual(["Sortujący 1", "Sortujący 2", "Sortujący 10"]);
  });

  it("sortuje zwykle nazwiska alfabetycznie", () => {
    expect(["Nowak", "Kowalski"].sort(naturalCompare)).toEqual(["Kowalski", "Nowak"]);
  });
});
