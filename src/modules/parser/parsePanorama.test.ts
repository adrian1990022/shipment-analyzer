import { describe, expect, it } from "vitest";
import { normalizeHeader } from "./parseWorkbook";
import { parsePanoramaRows } from "./parsePanorama";

function key(header: string) {
  return normalizeHeader(header);
}

describe("parsePanoramaRows", () => {
  it("mapuje wszystkie kolumny gdy sa obecne", () => {
    const raw = {
      [key("Shipment ID")]: "1001",
      [key("Remarks")]: "uwaga",
      [key("HWX?")]: "Y",
      [key("Last Phy Cp")]: "OK",
      [key("Last Phy Cp dt")]: "22/07/2026 10:00",
      [key("Weight (KG)/Dimension (CM)")]: "< R > < 3.05 > < 32 X 10 X 32.5 >",
      [key("Shp Calc Wgt (KG)")]: "3.05",
      [key("Shp Tot Pcs")]: "2",
      [key("Consignee Name")]: "Jan Kowalski",
      [key("Chute ID")]: "P1R01",
    };

    expect(parsePanoramaRows([raw])).toEqual([
      {
        shipmentId: "1001",
        remarks: "uwaga",
        hwx: "Y",
        lastPhyCp: "OK",
        lastPhyCpDt: "22/07/2026 10:00",
        weightDimension: "< R > < 3.05 > < 32 X 10 X 32.5 >",
        shpCalcWgt: "3.05",
        shpTotPcs: "2",
        consigneeName: "Jan Kowalski",
        chuteId: "P1R01",
      },
    ]);
  });

  it("brakujace kolumny staja sie pustymi stringami (nie undefined/crash)", () => {
    const raw = { [key("Shipment ID")]: "1001" };
    const [row] = parsePanoramaRows([raw]);
    expect(row.remarks).toBe("");
    expect(row.hwx).toBe("");
    expect(row.lastPhyCp).toBe("");
    expect(row.lastPhyCpDt).toBe("");
    expect(row.weightDimension).toBe("");
    expect(row.shpCalcWgt).toBe("");
    expect(row.shpTotPcs).toBe("");
    expect(row.consigneeName).toBe("");
    expect(row.chuteId).toBe("");
  });

  it("odrzuca wiersze bez Shipment ID (pusty lub brakujacy)", () => {
    const withEmpty = { [key("Shipment ID")]: "", [key("Chute ID")]: "P1R01" };
    const withoutKey = { [key("Chute ID")]: "P1R02" };
    expect(parsePanoramaRows([withEmpty, withoutKey])).toEqual([]);
  });

  it("puste komorki nie wywalaja parsera na wielu wierszach naraz", () => {
    const rows = [
      { [key("Shipment ID")]: "1001", [key("Remarks")]: "" },
      { [key("Shipment ID")]: "1002", [key("Remarks")]: "cos" },
    ];
    const result = parsePanoramaRows(rows);
    expect(result).toHaveLength(2);
    expect(result[0].remarks).toBe("");
    expect(result[1].remarks).toBe("cos");
  });
});
