import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilderMock } from "../../test/supabaseMock";

const { supabase } = vi.hoisted(() => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("../../lib/supabaseClient", () => ({ supabase }));

const { buildHandledKey, buildHandledMap, fetchHandledMap, setHandled, pruneShipmentActions } = await import(
  "./shipmentActionRepository"
);

describe("shipmentActionRepository", () => {
  beforeEach(() => {
    supabase.from.mockReset();
  });

  describe("buildHandledKey", () => {
    it("laczy shipmentId i shipmentDate zlozonym kluczem", () => {
      expect(buildHandledKey("1001", "2026-07-23")).toBe("1001|2026-07-23");
    });
  });

  describe("buildHandledMap", () => {
    it("automatyczne odtworzenie stanu: wiersz handled=true trafia do mapy pod zlozonym kluczem", () => {
      const map = buildHandledMap([{ shipmentId: "1001", shipmentDate: "2026-07-23", handled: true }]);
      expect(map.get(buildHandledKey("1001", "2026-07-23"))).toBe(true);
    });

    it("wiersze handled=false sa pomijane (brak w mapie == nieobsluzone)", () => {
      const map = buildHandledMap([{ shipmentId: "1001", shipmentDate: "2026-07-23", handled: false }]);
      expect(map.has(buildHandledKey("1001", "2026-07-23"))).toBe(false);
    });

    it("brak wpisu dla danej przesylki -> get zwraca undefined", () => {
      const map = buildHandledMap([{ shipmentId: "9999", shipmentDate: "2026-07-23", handled: true }]);
      expect(map.get(buildHandledKey("1001", "2026-07-23"))).toBeUndefined();
    });

    it("pusta lista wejsciowa -> pusta mapa", () => {
      expect(buildHandledMap([]).size).toBe(0);
    });
  });

  describe("fetchHandledMap", () => {
    it("odczyt handled: mapuje wiersze bazy na Map po zlozonym kluczu", async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilderMock({
          data: [
            { shipment_id: "1001", shipment_date: "2026-07-23", handled: true },
            { shipment_id: "1002", shipment_date: "2026-07-23", handled: false },
          ],
        })
      );

      const map = await fetchHandledMap();

      expect(supabase.from).toHaveBeenCalledWith("shipment_actions");
      expect(map.get(buildHandledKey("1001", "2026-07-23"))).toBe(true);
      expect(map.has(buildHandledKey("1002", "2026-07-23"))).toBe(false);
    });

    it("brak wpisow -> pusta mapa", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ data: [] }));
      const map = await fetchHandledMap();
      expect(map.size).toBe(0);
    });

    it("blad Supabase -> funkcja rzuca", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ error: new Error("boom") }));
      await expect(fetchHandledMap()).rejects.toThrow("boom");
    });
  });

  describe("setHandled", () => {
    it("zapis handled: wywoluje upsert z poprawnym payloadem i onConflict po zlozonym kluczu", async () => {
      const builder = createQueryBuilderMock({ data: null });
      supabase.from.mockReturnValueOnce(builder);

      await setHandled("1001", "2026-07-23", true);

      expect(supabase.from).toHaveBeenCalledWith("shipment_actions");
      expect(builder.upsert).toHaveBeenCalledWith(
        { shipment_id: "1001", shipment_date: "2026-07-23", handled: true },
        { onConflict: "shipment_id,shipment_date" }
      );
    });

    it("blad Supabase -> funkcja rzuca", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ error: new Error("upsert failed") }));
      await expect(setHandled("1001", "2026-07-23", true)).rejects.toThrow("upsert failed");
    });
  });

  describe("pruneShipmentActions", () => {
    it("ponowny import tego samego dnia: usuwa tylko wiersze z INNA data niz dzisiejsza", async () => {
      const builder = createQueryBuilderMock({ data: null });
      supabase.from.mockReturnValueOnce(builder);

      await pruneShipmentActions("2026-07-23");

      expect(supabase.from).toHaveBeenCalledWith("shipment_actions");
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.neq).toHaveBeenCalledWith("shipment_date", "2026-07-23");
    });

    it("import nastepnego dnia: wywolanie z nowa data usuwa wpisy sprzed niej (ten sam mechanizm, inny argument)", async () => {
      const builder = createQueryBuilderMock({ data: null });
      supabase.from.mockReturnValueOnce(builder);

      await pruneShipmentActions("2026-07-24");

      expect(builder.neq).toHaveBeenCalledWith("shipment_date", "2026-07-24");
    });

    it("blad Supabase -> funkcja rzuca", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ error: new Error("delete failed") }));
      await expect(pruneShipmentActions("2026-07-23")).rejects.toThrow("delete failed");
    });
  });
});
