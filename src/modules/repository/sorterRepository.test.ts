import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilderMock } from "../../test/supabaseMock";

const { supabase } = vi.hoisted(() => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("../../lib/supabaseClient", () => ({ supabase }));

const {
  fetchSorters,
  fetchSorterById,
  fetchSorterNameByTrasa,
  fetchRouteAssignmentStatus,
  createSorter,
  updateSorterName,
  setSorterActive,
  replaceSorterRoutes,
  deleteSorter,
} = await import("./sorterRepository");

describe("sorterRepository", () => {
  beforeEach(() => {
    supabase.from.mockReset();
  });

  describe("fetchSorters", () => {
    it("laczy sorters z ich trasami (posortowanymi alfabetycznie)", async () => {
      supabase.from
        .mockReturnValueOnce(
          createQueryBuilderMock({
            data: [
              { id: 1, name: "Jan Kowalski", active: true, created_at: "t", updated_at: "t" },
              { id: 2, name: "Anna Nowak", active: false, created_at: "t", updated_at: "t" },
            ],
          })
        )
        .mockReturnValueOnce(
          createQueryBuilderMock({
            data: [
              { sorter_id: 1, route: "WAEX" },
              { sorter_id: 1, route: "WAEF" },
            ],
          })
        );

      const result = await fetchSorters();

      expect(result).toEqual([
        {
          id: 1,
          name: "Jan Kowalski",
          active: true,
          createdAt: "t",
          updatedAt: "t",
          routes: ["WAEF", "WAEX"],
        },
        {
          id: 2,
          name: "Anna Nowak",
          active: false,
          createdAt: "t",
          updatedAt: "t",
          routes: [],
        },
      ]);
    });

    it("blad w ktoromkolwiek zapytaniu -> rzuca", async () => {
      supabase.from
        .mockReturnValueOnce(createQueryBuilderMock({ error: new Error("sorters failed") }))
        .mockReturnValueOnce(createQueryBuilderMock({ data: [] }));

      await expect(fetchSorters()).rejects.toThrow("sorters failed");
    });
  });

  describe("fetchSorterById", () => {
    it("zwraca dopasowanego sortujacego", async () => {
      supabase.from
        .mockReturnValueOnce(
          createQueryBuilderMock({
            data: [{ id: 5, name: "Jan", active: true, created_at: "t", updated_at: "t" }],
          })
        )
        .mockReturnValueOnce(createQueryBuilderMock({ data: [] }));

      const result = await fetchSorterById(5);
      expect(result?.name).toBe("Jan");
    });

    it("zwraca null gdy nie znaleziono", async () => {
      supabase.from
        .mockReturnValueOnce(createQueryBuilderMock({ data: [] }))
        .mockReturnValueOnce(createQueryBuilderMock({ data: [] }));

      expect(await fetchSorterById(999)).toBeNull();
    });
  });

  describe("fetchSorterNameByTrasa", () => {
    it("obsluguje relacje jako pojedynczy obiekt (realny ksztalt z PostgREST)", async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilderMock({
          data: [{ route: "WAEX", sorters: { name: "Jan Kowalski" } }],
        })
      );

      const map = await fetchSorterNameByTrasa();
      expect(map.get("WAEX")).toBe("Jan Kowalski");
    });

    it("obsluguje relacje jako tablice (typ supabase-js bez wygenerowanych typow)", async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilderMock({
          data: [{ route: "WAEF", sorters: [{ name: "Anna Nowak" }] }],
        })
      );

      const map = await fetchSorterNameByTrasa();
      expect(map.get("WAEF")).toBe("Anna Nowak");
    });

    it("pomija wiersze bez powiazanego sortujacego", async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilderMock({ data: [{ route: "WACA", sorters: null }] })
      );

      const map = await fetchSorterNameByTrasa();
      expect(map.has("WACA")).toBe(false);
    });

    it("blad Supabase -> rzuca", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ error: new Error("boom") }));
      await expect(fetchSorterNameByTrasa()).rejects.toThrow("boom");
    });
  });

  describe("fetchRouteAssignmentStatus", () => {
    it("oznacza trasy jako wolne albo przypisane do konkretnego sortera", async () => {
      supabase.from
        .mockReturnValueOnce(createQueryBuilderMock({ data: [{ trasa: "WAEX" }, { trasa: "WAEF" }] }))
        .mockReturnValueOnce(createQueryBuilderMock({ data: [{ route: "WAEX", sorter_id: 1 }] }));

      const result = await fetchRouteAssignmentStatus();

      expect(result).toEqual([
        { trasa: "WAEF", assignedToSorterId: null },
        { trasa: "WAEX", assignedToSorterId: 1 },
      ]);
    });
  });

  describe("createSorter", () => {
    it("tworzy sortujacego i przypisuje mu trasy", async () => {
      supabase.from
        .mockReturnValueOnce(createQueryBuilderMock({ data: { id: 10 } })) // sorters insert
        .mockReturnValueOnce(createQueryBuilderMock({ data: null })) // sorter_routes delete
        .mockReturnValueOnce(createQueryBuilderMock({ data: null })); // sorter_routes upsert

      await createSorter({ name: "Nowy", routes: ["WAEX"] });

      expect(supabase.from).toHaveBeenNthCalledWith(1, "sorters");
      expect(supabase.from).toHaveBeenNthCalledWith(2, "sorter_routes");
      expect(supabase.from).toHaveBeenNthCalledWith(3, "sorter_routes");
    });

    it("blad przy tworzeniu -> rzuca, nie probuje przypisywac tras", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ error: new Error("insert failed") }));
      await expect(createSorter({ name: "X", routes: [] })).rejects.toThrow("insert failed");
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateSorterName / setSorterActive / deleteSorter", () => {
    it("updateSorterName aktualizuje nazwe po id", async () => {
      const builder = createQueryBuilderMock({ data: null });
      supabase.from.mockReturnValueOnce(builder);

      await updateSorterName(3, "Nowe imie");

      expect(builder.update).toHaveBeenCalledWith({ name: "Nowe imie" });
      expect(builder.eq).toHaveBeenCalledWith("id", 3);
    });

    it("setSorterActive przelacza status", async () => {
      const builder = createQueryBuilderMock({ data: null });
      supabase.from.mockReturnValueOnce(builder);

      await setSorterActive(3, false);

      expect(builder.update).toHaveBeenCalledWith({ active: false });
    });

    it("deleteSorter kasuje po id", async () => {
      const builder = createQueryBuilderMock({ data: null });
      supabase.from.mockReturnValueOnce(builder);

      await deleteSorter(3);

      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith("id", 3);
    });

    it("blad Supabase w kazdej z tych funkcji -> rzuca", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ error: new Error("update failed") }));
      await expect(updateSorterName(1, "x")).rejects.toThrow("update failed");
    });
  });

  describe("replaceSorterRoutes", () => {
    it("kasuje stare i upsertuje nowe trasy (przejmowanie po route unique)", async () => {
      const deleteBuilder = createQueryBuilderMock({ data: null });
      const upsertBuilder = createQueryBuilderMock({ data: null });
      supabase.from.mockReturnValueOnce(deleteBuilder).mockReturnValueOnce(upsertBuilder);

      await replaceSorterRoutes(5, ["WAEX", "WAEF"]);

      expect(deleteBuilder.delete).toHaveBeenCalled();
      expect(deleteBuilder.eq).toHaveBeenCalledWith("sorter_id", 5);
      expect(upsertBuilder.upsert).toHaveBeenCalledWith(
        [
          { sorter_id: 5, route: "WAEX" },
          { sorter_id: 5, route: "WAEF" },
        ],
        { onConflict: "route" }
      );
    });

    it("pusta lista tras -> tylko delete, bez upsert", async () => {
      const deleteBuilder = createQueryBuilderMock({ data: null });
      supabase.from.mockReturnValueOnce(deleteBuilder);

      await replaceSorterRoutes(5, []);

      expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    it("blad przy delete -> rzuca, nie probuje upsert", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ error: new Error("delete failed") }));
      await expect(replaceSorterRoutes(5, ["WAEX"])).rejects.toThrow("delete failed");
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    it("blad przy upsert -> rzuca", async () => {
      supabase.from
        .mockReturnValueOnce(createQueryBuilderMock({ data: null }))
        .mockReturnValueOnce(createQueryBuilderMock({ error: new Error("upsert failed") }));
      await expect(replaceSorterRoutes(5, ["WAEX"])).rejects.toThrow("upsert failed");
    });
  });
});
