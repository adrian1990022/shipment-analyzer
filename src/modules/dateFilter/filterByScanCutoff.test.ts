import { describe, expect, it } from "vitest";
import { panoramaRow } from "../../test/fixtures";
import type { JoinedRow } from "../joiner/joinReports";
import { buildScanCutoff, filterByScanCutoff } from "./filterByScanCutoff";

const NOW = new Date(2026, 8, 25, 14, 3, 0); // 25 wrzesnia 2026, 14:03

function joined(lastPhyCpDt: string): JoinedRow {
  return { panorama: panoramaRow({ lastPhyCpDt }), sherloc: null };
}

describe("buildScanCutoff", () => {
  it("dzisiaj o wpisanej godzinie minus 15 minut", () => {
    expect(buildScanCutoff("14:00", NOW)).toEqual(new Date(2026, 8, 25, 13, 45, 0));
  });

  it("przejscie przez polnoc: 00:10 -> 23:55 poprzedniego dnia", () => {
    expect(buildScanCutoff("00:10", NOW)).toEqual(new Date(2026, 8, 24, 23, 55, 0));
  });

  it("akceptuje godzine jednocyfrowa i spacje", () => {
    expect(buildScanCutoff(" 7:30 ", NOW)).toEqual(new Date(2026, 8, 25, 7, 15, 0));
  });

  it("null dla niepoprawnego formatu", () => {
    expect(buildScanCutoff("", NOW)).toBeNull();
    expect(buildScanCutoff("14", NOW)).toBeNull();
    expect(buildScanCutoff("ab:cd", NOW)).toBeNull();
  });

  it("null dla godziny/minut poza zakresem", () => {
    expect(buildScanCutoff("24:00", NOW)).toBeNull();
    expect(buildScanCutoff("12:60", NOW)).toBeNull();
  });
});

describe("filterByScanCutoff", () => {
  const cutoff = new Date(2026, 8, 25, 13, 45, 0); // wpisane 14:00

  it("zostawia skany starsze niz 15 minut, takze z poprzednich dni", () => {
    const rows = [joined("25/09/2026 13:44"), joined("24/09/2026 18:00"), joined("2026-09-01 08:00")];
    const { keptRows, recentCount, noDateCount } = filterByScanCutoff(rows, cutoff);
    expect(keptRows).toHaveLength(3);
    expect(recentCount).toBe(0);
    expect(noDateCount).toBe(0);
  });

  it("pomija skany w oknie 15 minut (granica 13:45 wlacznie) i pozniejsze niz wpisana godzina", () => {
    const rows = [joined("25/09/2026 13:45"), joined("25/09/2026 13:59"), joined("25/09/2026 14:30")];
    const { keptRows, recentCount } = filterByScanCutoff(rows, cutoff);
    expect(keptRows).toHaveLength(0);
    expect(recentCount).toBe(3);
  });

  it("pomija wiersze bez daty lub z niepoprawna data", () => {
    const { keptRows, noDateCount } = filterByScanCutoff([joined(""), joined("nie-data")], cutoff);
    expect(keptRows).toHaveLength(0);
    expect(noDateCount).toBe(2);
  });
});
