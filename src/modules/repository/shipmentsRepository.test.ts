import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilderMock } from "../../test/supabaseMock";
import { shipment } from "../../test/fixtures";

const { supabase } = vi.hoisted(() => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("../../lib/supabaseClient", () => ({ supabase }));

const { fetchShipments, saveImport } = await import("./shipmentsRepository");

describe("shipmentsRepository", () => {
  beforeEach(() => {
    supabase.from.mockReset();
    supabase.rpc.mockReset();
  });

  describe("fetchShipments", () => {
    it("odczytuje i mapuje wiersze z snake_case na camelCase", async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilderMock({
          data: [
            {
              id: 1,
              shipment_id: "1001",
              remarks: null,
              hwx: null,
              last_phy_cp: "OK",
              last_phy_cp_dt: "2026-07-22T10:00:00.000Z",
              weight_dimension: null,
              shp_calc_wgt: 3.05,
              shp_tot_pcs: 2,
              consignee_name: "Jan Kowalski",
              chute_id: "P1R01",
              receiver_name: null,
              rcvr_addr1: null,
              rcvr_postcode: null,
              rcvr_city: null,
              trasa: "WAEX",
              grupa: "P1",
              sortujacy: "E",
              wystapilo: 1,
              przypisanie: "baza",
              import_id: 5,
            },
          ],
        })
      );

      const result = await fetchShipments();

      expect(supabase.from).toHaveBeenCalledWith("shipments");
      expect(result).toEqual([
        shipment({
          remarks: "",
          hwx: "",
          weightDimension: "",
          shpCalcWgt: 3.05,
          shpTotPcs: 2,
          receiverName: "",
          rcvrAddr1: "",
          rcvrPostcode: "",
          rcvrCity: "",
        }),
      ]);
    });

    it("pusta tabela -> pusta lista", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ data: null }));
      expect(await fetchShipments()).toEqual([]);
    });

    it("blad Supabase -> funkcja rzuca", async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilderMock({ error: new Error("select failed") })
      );
      await expect(fetchShipments()).rejects.toThrow("select failed");
    });
  });

  describe("saveImport", () => {
    const summary = {
      totalRows: 1,
      matchedRows: 1,
      unmatchedRows: 0,
      unmappedRows: 0,
      resultRows: 1,
      recentSkippedRows: 0,
      noDateRows: 0,
      cutoffAt: null,
      groupCounts: { P1: 1, P2: 0, P3: 0, COY004: 0, NIEPRZYPISANE: 0 },
      przypisanieCounts: { baza: 1, brak_w_bazie: 0, nieznana_trasa: 0 },
      bezSortujacegoRows: 0,
      routeBaseUploadedAt: null,
      panoramaFilename: "panorama.xlsx",
      sherlocFilename: "sherloc.xlsx",
    };

    it("zapisuje JEDNYM wywolaniem funkcji bazy import_shipments i zwraca id importu", async () => {
      supabase.rpc.mockResolvedValueOnce({ data: 42, error: null });

      const id = await saveImport({ summary, shipments: [shipment()] });

      expect(id).toBe(42);
      expect(supabase.from).not.toHaveBeenCalled();
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      const [fn, args] = supabase.rpc.mock.calls[0];
      expect(fn).toBe("import_shipments");
      expect(args.p_import.panorama_filename).toBe("panorama.xlsx");
      expect(args.p_import.today_rows).toBe(1);
      expect(args.p_shipments).toHaveLength(1);
      expect(args.p_shipments[0].shipment_id).toBe(shipment().shipmentId);
      expect(args.p_prune_before).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("blad bazy -> funkcja rzuca", async () => {
      supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error("rpc failed") });
      await expect(saveImport({ summary, shipments: [] })).rejects.toThrow("rpc failed");
    });
  });
});
