import type { SherlocRow } from "../../types/report";

const COLUMNS = {
  hwbNo: "HWB No",
  receiverName: "Receiver Name",
  rcvrAddr1: "Rcvr Addr 1",
  rcvrPostcode: "Rcvr Postcode",
  rcvrCity: "Rcvr City",
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
