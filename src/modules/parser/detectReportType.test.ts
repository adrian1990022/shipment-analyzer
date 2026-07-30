import { describe, expect, it } from "vitest";
import { normalizeHeader } from "./parseWorkbook";
import { detectReportType, reportKindLabel } from "./detectReportType";

describe("detectReportType", () => {
  it("poprawnie rozpoznaje raport Panorama", () => {
    const headers = ["shipmentid", "remarks", "chuteid"].map(normalizeHeader);
    expect(detectReportType(headers)).toEqual({ kind: "panorama", headers });
  });

  it("poprawnie rozpoznaje raport Sherloc", () => {
    const headers = ["hwbno", "receivername", "rcvrcity"].map(normalizeHeader);
    expect(detectReportType(headers)).toEqual({ kind: "sherloc", headers });
  });

  it("zwraca null przy braku wymaganej kolumny (Panorama bez Chute ID)", () => {
    const headers = [normalizeHeader("Shipment ID"), normalizeHeader("Remarks")];
    expect(detectReportType(headers)).toBeNull();
  });

  it("zwraca null dla zupelnie niepasujacych naglowkow", () => {
    expect(detectReportType(["foo", "bar", "baz"])).toBeNull();
  });

  it("dziala niezaleznie od wielkosci liter i spacji (naglowki juz znormalizowane)", () => {
    const headers = ["Shipment ID", "  Chute ID  ", "Extra"].map(normalizeHeader);
    expect(detectReportType(headers)?.kind).toBe("panorama");
  });
});

describe("reportKindLabel", () => {
  it("mapuje kind na czytelna etykiete", () => {
    expect(reportKindLabel("panorama")).toBe("Panorama");
    expect(reportKindLabel("sherloc")).toBe("Sherloc");
  });
});
