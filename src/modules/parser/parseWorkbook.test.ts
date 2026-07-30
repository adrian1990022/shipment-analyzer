import { describe, expect, it } from "vitest";
import { buildXlsxFile } from "../../test/xlsxFixture";
import { normalizeHeader, readHeaders, readWorkbookRows } from "./parseWorkbook";

describe("normalizeHeader", () => {
  it("trims, lowercases and strips internal whitespace", () => {
    expect(normalizeHeader("Shipment ID")).toBe("shipmentid");
    expect(normalizeHeader("  Chute ID  ")).toBe("chuteid");
  });

  it("makes header variants with different spacing equal (rozne spacje w naglowku)", () => {
    // Dokladnie ta klasa bledu, ktora psula Weight/Dimension na produkcji.
    const a = normalizeHeader("Weight (KG)/Dimension (CM)");
    const b = normalizeHeader("Weight (KG) /Dimension (CM)");
    const c = normalizeHeader("Weight (KG)/ Dimension (CM)");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("is case-insensitive (rozne wielkosci liter)", () => {
    expect(normalizeHeader("CHUTE ID")).toBe(normalizeHeader("chute id"));
  });
});

describe("readWorkbookRows (prawdziwy plik .xlsx)", () => {
  it("parsuje naglowki i wiersze do znormalizowanych kluczy", async () => {
    const file = buildXlsxFile(
      ["Shipment ID", "Chute ID"],
      [
        ["1001", "P1R01"],
        ["1002", "P1R02"],
      ]
    );

    const rows = await readWorkbookRows(file);

    expect(rows).toEqual([
      { shipmentid: "1001", chuteid: "P1R01" },
      { shipmentid: "1002", chuteid: "P1R02" },
    ]);
  });

  it("rozpoznaje ten sam plik mimo roznic spacji w naglowku", async () => {
    const file = buildXlsxFile(
      ["Weight (KG) /Dimension (CM)"],
      [["< R > < 3.05 > < 32 X 10 X 32.5 >"]]
    );

    const rows = await readWorkbookRows(file);

    expect(Object.keys(rows[0])).toEqual(["weight(kg)/dimension(cm)"]);
  });

  it("puste komorki staja sie pustym stringiem, nie undefined", async () => {
    const file = buildXlsxFile(
      ["Shipment ID", "Remarks"],
      [["1001", ""]]
    );

    const rows = await readWorkbookRows(file);

    expect(rows[0].remarks).toBe("");
  });

  it("nieobslugiwany format (nierozpoznawalne bajty) zwraca [] zamiast rzucac wyjatek", async () => {
    // SheetJS jest tolerancyjny -- traktuje nierozpoznawalne bajty jako
    // CSV, wiec nie rzuca; brak sensownych danych tabelarycznych konczy
    // sie po prostu pusta lista wierszy.
    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], "broken.xlsx");
    const rows = await readWorkbookRows(file);
    expect(rows).toEqual([]);
  });
});

describe("readHeaders", () => {
  it("zwraca [] dla pustej listy wierszy", () => {
    expect(readHeaders([])).toEqual([]);
  });

  it("zwraca klucze pierwszego wiersza", () => {
    expect(readHeaders([{ a: "1", b: "2" }])).toEqual(["a", "b"]);
  });
});
