import { describe, expect, it } from "vitest";
import { panoramaRow } from "../../test/fixtures";
import type { JoinedRow } from "../joiner/joinReports";
import { filterToday } from "./filterToday";

const REFERENCE = new Date(2026, 6, 22, 12, 0, 0); // 22 lipca 2026

function joined(lastPhyCpDt: string): JoinedRow {
  return { panorama: panoramaRow({ lastPhyCpDt }), sherloc: null };
}

describe("filterToday", () => {
  it("zachowuje rekord z dzisiejsza data", () => {
    const { todayRows, todayCount, skippedCount } = filterToday(
      [joined("22/07/2026 09:00")],
      REFERENCE
    );
    expect(todayCount).toBe(1);
    expect(skippedCount).toBe(0);
    expect(todayRows).toHaveLength(1);
  });

  it("odrzuca rekord z wczoraj", () => {
    const { todayRows, skippedCount } = filterToday([joined("21/07/2026 09:00")], REFERENCE);
    expect(todayRows).toHaveLength(0);
    expect(skippedCount).toBe(1);
  });

  it("odrzuca rekord z przyszlosci", () => {
    const { todayRows, skippedCount } = filterToday([joined("23/07/2026 09:00")], REFERENCE);
    expect(todayRows).toHaveLength(0);
    expect(skippedCount).toBe(1);
  });

  it("odrzuca pusta date", () => {
    const { todayRows, skippedCount } = filterToday([joined("")], REFERENCE);
    expect(todayRows).toHaveLength(0);
    expect(skippedCount).toBe(1);
  });

  it("odrzuca blednie sformatowana date zamiast rzucac wyjatek", () => {
    const { todayRows, skippedCount } = filterToday([joined("nie-data")], REFERENCE);
    expect(todayRows).toHaveLength(0);
    expect(skippedCount).toBe(1);
  });

  it("obsluguje mieszany zestaw wielu rekordow", () => {
    const rows = [
      joined("22/07/2026 08:00"),
      joined("21/07/2026 08:00"),
      joined(""),
      joined("22/07/2026 23:59"),
    ];
    const { todayCount, skippedCount } = filterToday(rows, REFERENCE);
    expect(todayCount).toBe(2);
    expect(skippedCount).toBe(2);
  });
});
