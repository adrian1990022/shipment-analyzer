import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildXlsxFile } from "../../test/xlsxFixture";
import {
  RouteBaseError,
  canSaveRouteBase,
  parseRouteBaseFile,
  resolveAssignments,
  unresolvedConflicts,
  validateRouteBaseRows,
} from "./parseRouteBase";

function csvFile(text: string, filename = "baza.csv"): File {
  return new File([text], filename, { type: "text/csv" });
}

// Plik .xlsx z komorkami TEKSTOWYMI (typ "s") -- tak Excel zapisuje
// kolumne sformatowana jako Tekst (np. numery z zerem wiodacym).
function xlsxWithTextCells(rows: string[][]): File {
  const sheet = XLSX.utils.aoa_to_sheet(rows, { cellDates: false });
  for (const key of Object.keys(sheet)) {
    if (!key.startsWith("!")) sheet[key] = { t: "s", v: String(sheet[key].v) };
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([buffer], "baza.xlsx");
}

describe("parseRouteBaseFile", () => {
  it("1. poprawny plik -> przypisania gotowe do zapisu", async () => {
    const file = buildXlsxFile(
      ["Route", "AWB/BkgRef"],
      [
        ["WAEX", "123456789"],
        ["WALC", "987654321"],
        ["WAFB", "112233445"],
        ["WAEX", "556677889"],
      ]
    );

    const v = await parseRouteBaseFile(file);

    expect(v.assignments).toEqual([
      { awb: "123456789", route: "WAEX" },
      { awb: "987654321", route: "WALC" },
      { awb: "112233445", route: "WAFB" },
      { awb: "556677889", route: "WAEX" },
    ]);
    expect(canSaveRouteBase(v, {})).toBe(true);
  });

  it("2. inna kolejnosc kolumn + dodatkowa kolumna", async () => {
    const file = buildXlsxFile(["Inne", "AWB/BkgRef", "Route"], [["x", "123", "WAEX"]]);

    const v = await parseRouteBaseFile(file);

    expect(v.assignments).toEqual([{ awb: "123", route: "WAEX" }]);
  });

  it("3. naglowki: inna wielkosc liter i spacje", async () => {
    const file = buildXlsxFile(["  route ", "awb / bkgref"], [["waex ", " 123 "]]);

    const v = await parseRouteBaseFile(file);

    expect(v.assignments).toEqual([{ awb: "123", route: "WAEX" }]);
  });

  it("4. brak kolumny Route -> odrzucenie z przyczyna", async () => {
    const file = buildXlsxFile(["AWB/BkgRef"], [["123"]]);

    await expect(parseRouteBaseFile(file)).rejects.toThrow(RouteBaseError);
    await expect(parseRouteBaseFile(file)).rejects.toThrow(/Route/);
  });

  it("5. brak kolumny AWB/BkgRef -> odrzucenie z przyczyna", async () => {
    const file = buildXlsxFile(["Route"], [["WAEX"]]);

    await expect(parseRouteBaseFile(file)).rejects.toThrow(/AWB\/BkgRef/);
  });

  it("plik bez wierszy danych -> odrzucenie", async () => {
    const file = buildXlsxFile(["Route", "AWB/BkgRef"], []);

    await expect(parseRouteBaseFile(file)).rejects.toThrow(RouteBaseError);
  });

  it("6. puste numery i puste trasy -> pominiete, wskazane z numerem wiersza", async () => {
    const file = buildXlsxFile(
      ["Route", "AWB/BkgRef"],
      [
        ["WAEX", "1"],
        ["", "2"],
        ["WALC", ""],
      ]
    );

    const v = await parseRouteBaseFile(file);

    expect(v.assignments).toEqual([{ awb: "1", route: "WAEX" }]);
    expect(v.emptyRows.map((r) => r.wiersz)).toEqual([3, 4]);
    expect(canSaveRouteBase(v, {})).toBe(true);
  });

  it("7. zera wiodace zachowane -- komorki tekstowe xlsx", async () => {
    const file = xlsxWithTextCells([
      ["Route", "AWB/BkgRef"],
      ["WAEX", "0012345"],
    ]);

    const v = await parseRouteBaseFile(file);

    expect(v.assignments).toEqual([{ awb: "0012345", route: "WAEX" }]);
  });

  it("7. zera wiodace zachowane -- CSV", async () => {
    const v = await parseRouteBaseFile(csvFile("Route,AWB/BkgRef\nWAEX,0012345\n"));

    expect(v.assignments).toEqual([{ awb: "0012345", route: "WAEX" }]);
  });

  it("dlugi numer zapisany w xlsx jako liczba -> pelne cyfry, bez zapisu naukowego", async () => {
    const file = buildXlsxFile(["Route", "AWB/BkgRef"], [["WAEX", 123456789012]]);

    const v = await parseRouteBaseFile(file);

    expect(v.assignments).toEqual([{ awb: "123456789012", route: "WAEX" }]);
  });

  it("numer w zapisie naukowym (CSV z Excela) -> blad blokujacy", async () => {
    const v = await parseRouteBaseFile(csvFile("Route,AWB/BkgRef\nWAEX,1.23457E+11\n"));

    expect(v.invalidRows).toHaveLength(1);
    expect(canSaveRouteBase(v, {})).toBe(false);
  });

  it("8. identyczne pary scalane w jeden wpis", async () => {
    const file = buildXlsxFile(
      ["Route", "AWB/BkgRef"],
      [
        ["WAEX", "1"],
        ["waex", " 1"],
        ["WAEX", "1"],
      ]
    );

    const v = await parseRouteBaseFile(file);

    expect(v.assignments).toEqual([{ awb: "1", route: "WAEX" }]);
    expect(v.duplicateRows).toBe(2);
    expect(canSaveRouteBase(v, {})).toBe(true);
  });

  it("9. ten sam numer z roznymi trasami -> konflikt do wyboru, bez wyboru zapis zablokowany", async () => {
    const file = buildXlsxFile(
      ["Route", "AWB/BkgRef"],
      [
        ["WALC", "1"],
        ["WAEX", "1"],
        ["WAFB", "2"],
        ["WALC", "1"],
      ]
    );

    const v = await parseRouteBaseFile(file);

    expect(v.conflicts).toEqual([
      {
        awb: "1",
        options: [
          { route: "WAEX", wiersze: [3] },
          { route: "WALC", wiersze: [2, 5] },
        ],
      },
    ]);
    expect(v.assignments).toEqual([{ awb: "2", route: "WAFB" }]);
    expect(unresolvedConflicts(v, {})).toBe(1);
    expect(canSaveRouteBase(v, {})).toBe(false);
  });

  it("konflikt: wybrana trasa trafia do zapisu", async () => {
    const v = validateRouteBaseRows([
      { route: "WAEX", "awb/bkgref": "1" },
      { route: "WALC", "awb/bkgref": "1" },
      { route: "WAFB", "awb/bkgref": "2" },
    ]);

    expect(canSaveRouteBase(v, { "1": "WALC" })).toBe(true);
    expect(resolveAssignments(v, { "1": "WALC" })).toEqual([
      { awb: "2", route: "WAFB" },
      { awb: "1", route: "WALC" },
    ]);
  });

  it("konflikt: Pomin -> przesylka poza baza, zapis mozliwy", () => {
    const v = validateRouteBaseRows([
      { route: "WAEX", "awb/bkgref": "1" },
      { route: "WALC", "awb/bkgref": "1" },
      { route: "WAFB", "awb/bkgref": "2" },
    ]);

    expect(unresolvedConflicts(v, { "1": null })).toBe(0);
    expect(canSaveRouteBase(v, { "1": null })).toBe(true);
    expect(resolveAssignments(v, { "1": null })).toEqual([{ awb: "2", route: "WAFB" }]);
  });

  it("konflikt: wybor spoza tras z pliku nie liczy sie jako rozstrzygniecie", () => {
    const v = validateRouteBaseRows([
      { route: "WAEX", "awb/bkgref": "1" },
      { route: "WALC", "awb/bkgref": "1" },
    ]);

    expect(unresolvedConflicts(v, { "1": "WAZZ" })).toBe(1);
    expect(resolveAssignments(v, { "1": "WAZZ" })).toEqual([]);
    expect(canSaveRouteBase(v, { "1": "WAZZ" })).toBe(false);
  });

  it("same konflikty, wszystkie pominiete -> nic do zapisania", () => {
    const v = validateRouteBaseRows([
      { route: "WAEX", "awb/bkgref": "1" },
      { route: "WALC", "awb/bkgref": "1" },
    ]);

    expect(canSaveRouteBase(v, { "1": null })).toBe(false);
  });

  it("powtorzony wiersz naglowka w srodku pliku -> pominiety (realny plik DISCO)", async () => {
    const file = buildXlsxFile(
      ["Route", "AWB/BkgRef"],
      [
        ["WAEX", "1"],
        ["ROUTE", "AWB/BKGREF"],
        ["Route", "AWB / BkgRef"],
        ["WALC", "2"],
      ]
    );

    const v = await parseRouteBaseFile(file);

    expect(v.headerRows).toBe(2);
    expect(v.dataRows).toBe(2);
    expect(v.assignments).toEqual([
      { awb: "1", route: "WAEX" },
      { awb: "2", route: "WALC" },
    ]);
  });

  it("10. duzy zbior (6000 rekordow)", async () => {
    const rows = Array.from({ length: 6000 }, (_, i) => [`WA${String.fromCharCode(65 + (i % 26))}X`, String(1000000000 + i)]);
    const file = buildXlsxFile(["Route", "AWB/BkgRef"], rows);

    const v = await parseRouteBaseFile(file);

    expect(v.assignments).toHaveLength(6000);
    expect(canSaveRouteBase(v, {})).toBe(true);
  });
});

describe("validateRouteBaseRows", () => {
  it("calkiem puste wiersze sa ignorowane (nie licza sie jako dane)", () => {
    const v = validateRouteBaseRows([
      { route: "WAEX", "awb/bkgref": "1" },
      { route: "", "awb/bkgref": "" },
    ]);

    expect(v.dataRows).toBe(1);
    expect(v.emptyRows).toEqual([]);
  });

  it("za dluga trasa / numer -> bledy blokujace", () => {
    const v = validateRouteBaseRows([
      { route: "X".repeat(17), "awb/bkgref": "1" },
      { route: "WAEX", "awb/bkgref": "9".repeat(65) },
    ]);

    expect(v.invalidRows.map((r) => r.wiersz)).toEqual([2, 3]);
    expect(canSaveRouteBase(v, {})).toBe(false);
  });

  it("brak jakiegokolwiek poprawnego przypisania -> nie mozna zapisac", () => {
    const v = validateRouteBaseRows([{ route: "", "awb/bkgref": "1" }]);

    expect(canSaveRouteBase(v, {})).toBe(false);
  });
});
