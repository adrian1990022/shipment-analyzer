import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilderMock } from "../../test/supabaseMock";
import { routeRef } from "../../test/fixtures";

const { supabase } = vi.hoisted(() => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("../../lib/supabaseClient", () => ({ supabase }));

const { fetchRoutes, upsertRoute, deleteRoute } = await import("./routesRepository");

describe("routesRepository", () => {
  beforeEach(() => {
    supabase.from.mockReset();
  });

  describe("fetchRoutes", () => {
    it("odczytuje i mapuje wiersze", async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilderMock({
          data: [
            {
              id: 1,
              chute_id: "P1R01",
              trasa: "WAEX",
              grupa: "P1",
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          ],
        })
      );

      const result = await fetchRoutes();

      expect(supabase.from).toHaveBeenCalledWith("routes");
      expect(result).toEqual([routeRef()]);
    });

    it("blad Supabase -> funkcja rzuca", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ error: new Error("boom") }));
      await expect(fetchRoutes()).rejects.toThrow("boom");
    });
  });

  describe("upsertRoute", () => {
    it("wywoluje upsert z poprawnym payloadem", async () => {
      const builder = createQueryBuilderMock({ data: null });
      supabase.from.mockReturnValueOnce(builder);

      await upsertRoute({ chuteId: "P1R02", trasa: "WAEF", grupa: "P1" });

      expect(builder.upsert).toHaveBeenCalledWith(
        { chute_id: "P1R02", trasa: "WAEF", grupa: "P1" },
        { onConflict: "chute_id" }
      );
    });

    it("blad Supabase -> funkcja rzuca", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ error: new Error("upsert failed") }));
      await expect(upsertRoute({ chuteId: "X", trasa: "Y", grupa: "P1" })).rejects.toThrow(
        "upsert failed"
      );
    });
  });

  describe("deleteRoute", () => {
    it("kasuje po id", async () => {
      const builder = createQueryBuilderMock({ data: null });
      supabase.from.mockReturnValueOnce(builder);

      await deleteRoute(7);

      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith("id", 7);
    });

    it("blad Supabase -> funkcja rzuca", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ error: new Error("delete failed") }));
      await expect(deleteRoute(1)).rejects.toThrow("delete failed");
    });
  });
});
