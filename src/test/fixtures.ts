import type { PanoramaRow, SherlocRow } from "../types/report";
import type { RouteRef, Shipment } from "../types/shipment";

export function panoramaRow(overrides: Partial<PanoramaRow> = {}): PanoramaRow {
  return {
    shipmentId: "1001",
    remarks: "",
    hwx: "",
    lastPhyCp: "OK",
    lastPhyCpDt: "22/07/2026 10:00",
    weightDimension: "",
    shpCalcWgt: "",
    shpTotPcs: "",
    consigneeName: "Jan Kowalski",
    chuteId: "P1R01",
    ...overrides,
  };
}

export function sherlocRow(overrides: Partial<SherlocRow> = {}): SherlocRow {
  return {
    hwbNo: "1001",
    receiverName: "Jan Kowalski",
    rcvrAddr1: "ul. Testowa 1",
    rcvrPostcode: "00-001",
    rcvrCity: "Warszawa",
    ...overrides,
  };
}

export function shipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    shipmentId: "1001",
    remarks: "",
    hwx: "",
    lastPhyCp: "OK",
    lastPhyCpDt: "2026-07-22T10:00:00.000Z",
    weightDimension: "",
    shpCalcWgt: null,
    shpTotPcs: null,
    consigneeName: "Jan Kowalski",
    chuteId: "P1R01",
    receiverName: "",
    rcvrAddr1: "",
    rcvrPostcode: "",
    rcvrCity: "",
    trasa: "WAEX",
    grupa: "P1",
    sortujacy: "E",
    wystapilo: 1,
    ...overrides,
  };
}

export function routeRef(overrides: Partial<RouteRef> = {}): RouteRef {
  return {
    id: 1,
    chuteId: "P1R01",
    trasa: "WAEX",
    grupa: "P1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
