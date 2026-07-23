import type { SherlocRow } from "../../types/report";
import { normalizeHeader } from "./parseWorkbook";

const COLUMNS = {
  hwbNo: normalizeHeader("HWB No"),
  receiverName: normalizeHeader("Receiver Name"),
  rcvrAddr1: normalizeHeader("Rcvr Addr 1"),
  rcvrPostcode: normalizeHeader("Rcvr Postcode"),
  rcvrCity: normalizeHeader("Rcvr City"),
} as const;

export function parseSherlocRows(rawRows: Record<string, string>[]): SherlocRow[] {
  return rawRows
    .map((raw) => ({
      hwbNo: raw[COLUMNS.hwbNo] ?? "",
      receiverName: raw[COLUMNS.receiverName] ?? "",
      rcvrAddr1: raw[COLUMNS.rcvrAddr1] ?? "",
      rcvrPostcode: raw[COLUMNS.rcvrPostcode] ?? "",
      rcvrCity: raw[COLUMNS.rcvrCity] ?? "",
    }))
    .filter((row) => row.hwbNo !== "");
}
