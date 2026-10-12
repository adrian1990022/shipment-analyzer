import { describe, expect, it } from "vitest";
import { daysInMonth, parseAttendance, type AttendanceSorterRef } from "./parseAttendance";

const sorters: AttendanceSorterRef[] = [
  { id: 1, name: "Janek", fullName: "Jan Kowalski" },
  { id: 2, name: "Żenia", fullName: "Żenia Łukaszewicz" },
  { id: 3, name: "Piotrek", fullName: "Piotr Nowak" },
  { id: 4, name: "Piotrek", fullName: "Piotr Nowak" },
  { id: 5, name: "Bez imienia", fullName: null },
];

describe("parseAttendance", () => {
  it("rozpoznaje wpisy z kolumny Excela (CRLF, spacje, wielkosc liter)", () => {
    const text = "Jan Kowalski_1\r\n  jan  KOWALSKI_2 \r\nŻenia Łukaszewicz_9\r\n\r\n";
    const result = parseAttendance(text, 2026, 10, sorters);

    expect(result.entries).toEqual([
      { sorterId: 1, day: 1 },
      { sorterId: 1, day: 2 },
      { sorterId: 2, day: 9 },
    ]);
    expect(result.lastDay).toBe(9);
    expect(result.recognized).toEqual([
      { sorterId: 1, name: "Janek", fullName: "Jan Kowalski", days: 2 },
      { sorterId: 2, name: "Żenia", fullName: "Żenia Łukaszewicz", days: 1 },
    ]);
    expect(result.invalid).toEqual([]);
  });

  it("dopuszcza spacje wokol podkreslnika i kilka kolumn (tabulatory)", () => {
    const result = parseAttendance("Jan Kowalski _ 3\tŻenia Łukaszewicz_4", 2026, 10, sorters);
    expect(result.entries).toEqual([
      { sorterId: 1, day: 3 },
      { sorterId: 2, day: 4 },
    ]);
  });

  it("polskie znaki musza sie zgadzac", () => {
    const result = parseAttendance("Zenia Lukaszewicz_1", 2026, 10, sorters);
    expect(result.entries).toEqual([]);
    expect(result.unknown).toEqual([{ fullName: "Zenia Lukaszewicz", count: 1 }]);
  });

  it("nieznane osoby i sortujacy bez imienia i nazwiska -> pominiete, policzone", () => {
    const result = parseAttendance("Anna Nowa_1\nAnna Nowa_2\nBez imienia_3", 2026, 10, sorters);
    expect(result.entries).toEqual([]);
    expect(result.unknown).toEqual([
      { fullName: "Anna Nowa", count: 2 },
      { fullName: "Bez imienia", count: 1 },
    ]);
    expect(result.lastDay).toBeNull();
  });

  it("to samo imie i nazwisko u dwoch sortujacych -> niejednoznaczne, pominiete", () => {
    const result = parseAttendance("Piotr Nowak_5", 2026, 10, sorters);
    expect(result.entries).toEqual([]);
    expect(result.ambiguous).toEqual([{ fullName: "Piotr Nowak", count: 1 }]);
  });

  it("bledne wpisy: brak dnia, dzien 0, dzien spoza miesiaca, naglowek", () => {
    const result = parseAttendance("Obecność\nJan Kowalski\nJan Kowalski_0\nJan Kowalski_31\nJan Kowalski_x", 2026, 9, sorters);
    expect(result.entries).toEqual([]);
    expect(result.invalid).toEqual(["Obecność", "Jan Kowalski", "Jan Kowalski_0", "Jan Kowalski_31", "Jan Kowalski_x"]);
  });

  it("powtorzony wpis tej samej osoby na ten sam dzien liczony raz", () => {
    const result = parseAttendance("Jan Kowalski_4\nJan Kowalski_4\njan kowalski_4", 2026, 10, sorters);
    expect(result.entries).toEqual([{ sorterId: 1, day: 4 }]);
    expect(result.duplicates).toBe(2);
  });

  it("daysInMonth uwzglednia luty w roku przestepnym", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 10)).toBe(31);
  });
});
