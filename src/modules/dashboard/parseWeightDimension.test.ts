import { describe, expect, it } from "vitest";
import { parseWeightDimension } from "./parseWeightDimension";

describe("parseWeightDimension", () => {
  it("parsuje poprawny format Panoramy", () => {
    expect(parseWeightDimension("< R > < 3.05 > < 32 X 10 X 32.5 >")).toEqual({
      weightKg: "3.05",
      lengthCm: "32",
      heightCm: "10",
      widthCm: "32.5",
    });
  });

  it("zwraca null gdy jest mniej niz 3 segmenty", () => {
    expect(parseWeightDimension("< R > < 3.05 >")).toBeNull();
  });

  it("zwraca null gdy waga jest pusta", () => {
    expect(parseWeightDimension("< R > <  > < 32 X 10 X 32.5 >")).toBeNull();
  });

  it("zwraca null gdy wymiary nie maja dokladnie 3 czesci", () => {
    expect(parseWeightDimension("< R > < 3.05 > < 32 X 10 >")).toBeNull();
  });

  it("zwraca null gdy ktorys wymiar jest pusty", () => {
    expect(parseWeightDimension("< R > < 3.05 > < 32 X  X 32.5 >")).toBeNull();
  });

  it("zwraca null dla calkowicie niepasujacego formatu", () => {
    expect(parseWeightDimension("cos zupelnie innego")).toBeNull();
  });
});
