import { describe, expect, it } from "vitest";
import { normalizeHeader } from "./parseWorkbook";
import { parseSherlocRows } from "./parseSherloc";

function key(header: string) {
  return normalizeHeader(header);
}

describe("parseSherlocRows", () => {
  it("mapuje wszystkie kolumny gdy sa obecne", () => {
    const raw = {
      [key("HWB No")]: "1001",
      [key("Receiver Name")]: "Jan Kowalski",
      [key("Rcvr Addr 1")]: "ul. Testowa 1",
      [key("Rcvr Postcode")]: "00-001",
      [key("Rcvr City")]: "Warszawa",
    };

    expect(parseSherlocRows([raw])).toEqual([
      {
        hwbNo: "1001",
        receiverName: "Jan Kowalski",
        rcvrAddr1: "ul. Testowa 1",
        rcvrPostcode: "00-001",
        rcvrCity: "Warszawa",
      },
    ]);
  });

  it("brakujace kolumny staja sie pustymi stringami", () => {
    const [row] = parseSherlocRows([{ [key("HWB No")]: "1001" }]);
    expect(row.receiverName).toBe("");
    expect(row.rcvrAddr1).toBe("");
    expect(row.rcvrPostcode).toBe("");
    expect(row.rcvrCity).toBe("");
  });

  it("odrzuca wiersze bez HWB No (pusty lub brakujacy)", () => {
    const withEmpty = { [key("HWB No")]: "", [key("Receiver Name")]: "X" };
    const withoutKey = { [key("Receiver Name")]: "Y" };
    expect(parseSherlocRows([withEmpty, withoutKey])).toEqual([]);
  });
});
