export interface ParsedWeightDimension {
  weightKg: string;
  lengthCm: string;
  heightCm: string;
  widthCm: string;
}

// Surowa wartosc z Panoramy wyglada np. tak:
// "< R > < 3.05 > < 32 X 10 X 32.5 >"
// Drugi segment to waga (kg), trzeci to wymiary dlugosc x wysokosc x
// szerokosc (cm). Pierwszy segment (kod typu przesylki) nie jest
// wyswietlany -- nikt o niego nie prosil.
// Zwraca null, gdy format nie pasuje -- wtedy UI pokazuje surowa wartosc
// zamiast zgadywac.
export function parseWeightDimension(raw: string): ParsedWeightDimension | null {
  const segments = [...raw.matchAll(/<\s*([^<>]*?)\s*>/g)].map((m) => m[1].trim());
  if (segments.length < 3) return null;

  const weightKg = segments[1];
  const dims = segments[2].split(/x/i).map((d) => d.trim());
  if (dims.length !== 3 || !weightKg || dims.some((d) => d === "")) return null;

  const [lengthCm, heightCm, widthCm] = dims;
  return { weightKg, lengthCm, heightCm, widthCm };
}
