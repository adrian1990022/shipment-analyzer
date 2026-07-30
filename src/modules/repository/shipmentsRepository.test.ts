import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilderMock } from "../../test/supabaseMock";
import { shipment } from "../../test/fixtures";

const { supabase } = vi.hoisted(() => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("../../lib/supabaseClient", () => ({ supabase }));

const { fetchShipments, replaceShipments } = await import("./shipmentsRepository");

describe("shipmentsRepository", () => {
  beforeEach(() => {
    supabase.from.mockReset();
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

  describe("replaceShipments", () => {
    const summary = {
      totalRows: 1,
      matchedRows: 1,
      unmatchedRows: 0,
      unmappedRows: 0,
      todayRows: 1,
      groupCounts: { P1: 1, P2: 0, P3: 0, COY004: 0 },
      panoramaFilename: "panorama.xlsx",
      sherlocFilename: "sherloc.xlsx",
    };

    it("zapisuje: tworzy wpis w imports, kasuje stare dane, wstawia nowe", async () => {
      supabase.from
        .mockReturnValueOnce(createQueryBuilderMock({ data: { id: 42 } })) // imports insert
        .mockReturnValueOnce(createQueryBuilderMock({ data: null })) // shipments delete
        .mockReturnValueOnce(createQueryBuilderMock({ data: null })); // shipments insert

      await replaceShipments([shipment()], summary);

      expect(supabase.from).toHaveBeenNthCalledWith(1, "imports");
      expect(supabase.from).toHaveBeenNthCalledWith(2, "shipments");
      expect(supabase.from).toHaveBeenNthCalledWith(3, "shipments");
    });

    it("pusta lista shipments -> konczy po delete, bez wywolania insert", async () => {
      supabase.from
        .mockReturnValueOnce(createQueryBuilderMock({ data: { id: 42 } }))
        .mockReturnValueOnce(createQueryBuilderMock({ data: null }));

      await replaceShipments([], summary);

      expect(supabase.from).toHaveBeenCalledTimes(2);
    });

    it("blad przy tworzeniu wpisu w imports -> rzuca, nie probuje kasowac/wstawiac", async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilderMock({ error: new Error("imports insert failed") })
      );

      await expect(replaceShipments([shipment()], summary)).rejects.toThrow("imports insert failed");
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    it("blad przy kasowaniu starych danych -> rzuca, nie wstawia nowych", async () => {
      supabase.from
        .mockReturnValueOnce(createQueryBuilderMock({ data: { id: 42 } }))
        .mockReturnValueOnce(createQueryBuilderMock({ error: new Error("delete failed") }));

      await expect(replaceShipments([shipment()], summary)).rejects.toThrow("delete failed");
      expect(supabase.from).toHaveBeenCalledTimes(2);
    });

    it("blad przy wstawianiu nowych danych -> rzuca", async () => {
      supabase.from
        .mockReturnValueOnce(createQueryBuilderMock({ data: { id: 42 } }))
        .mockReturnValueOnce(createQueryBuilderMock({ data: null }))
        .mockReturnValueOnce(createQueryBuilderMock({ error: new Error("insert failed") }));

      await expect(replaceShipments([shipment()], summary)).rejects.toThrow("insert failed");
    });

    it("dzieli wstawianie na partie po 500 wierszy", async () => {
      const manyShipments = Array.from({ length: 1200 }, (_, i) =>
        shipment({ shipmentId: String(i) })
      );
      supabase.from
        .mockReturnValueOnce(createQueryBuilderMock({ data: { id: 42 } }))
        .mockReturnValueOnce(createQueryBuilderMock({ data: null }))
        .mockReturnValueOnce(createQueryBuilderMock({ data: null }))
        .mockReturnValueOnce(createQueryBuilderMock({ data: null }))
        .mockReturnValueOnce(createQueryBuilderMock({ data: null }));

      await replaceShipments(manyShipments, summary);

      // 1 (imports) + 1 (delete) + 3 partie po <=500 = 5 wywolan .from()
      expect(supabase.from).toHaveBeenCalledTimes(5);
    });
  });
});
