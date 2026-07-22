import type { DetectedReport, ReportKind } from "../../types/report";

// Kolumny, po ktorych rozpoznajemy typ raportu. Parser rozpoznaje TYLKO
// ksztalt pliku (jakie ma kolumny) -- nie wie nic o trasach ani sortujacych.
const PANORAMA_SIGNATURE = ["Shipment ID", "Chute ID"];
const SHERLOC_SIGNATURE = ["HWB No", "Receiver Name"];

function hasAll(headers: string[], required: string[]): boolean {
  const set = new Set(headers.map((h) => h.toLowerCase()));
  return required.every((col) => set.has(col.toLowerCase()));
}

export function detectReportType(headers: string[]): DetectedReport | null {
  if (hasAll(headers, PANORAMA_SIGNATURE)) {
    return { kind: "panorama", headers };
  }
  if (hasAll(headers, SHERLOC_SIGNATURE)) {
    return { kind: "sherloc", headers };
  }
  return null;
}

export function reportKindLabel(kind: ReportKind): string {
  return kind === "panorama" ? "Panorama" : "Sherloc";
}
