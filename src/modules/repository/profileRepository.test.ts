import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilderMock } from "../../test/supabaseMock";

const { supabase } = vi.hoisted(() => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("../../lib/supabaseClient", () => ({ supabase }));

const { fetchOwnProfile, fetchAllProfiles } = await import("./profileRepository");

describe("profileRepository", () => {
  beforeEach(() => {
    supabase.from.mockReset();
  });

  describe("fetchOwnProfile", () => {
    it("zwraca profil gdy istnieje", async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilderMock({
          data: { id: "u1", username: "admin", role: "admin", created_at: "t", updated_at: "t" },
        })
      );

      const profile = await fetchOwnProfile("u1");
      expect(profile).toEqual({ id: "u1", username: "admin", role: "admin", createdAt: "t", updatedAt: "t" });
    });

    it("zwraca null gdy brak profilu", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ data: null }));
      expect(await fetchOwnProfile("brak")).toBeNull();
    });

    it("blad Supabase -> rzuca", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ error: new Error("boom") }));
      await expect(fetchOwnProfile("u1")).rejects.toThrow("boom");
    });
  });

  describe("fetchAllProfiles", () => {
    it("zwraca liste profili", async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilderMock({
          data: [{ id: "u1", username: "admin", role: "admin", created_at: "t", updated_at: "t" }],
        })
      );
      const result = await fetchAllProfiles();
      expect(result).toHaveLength(1);
    });

    it("blad Supabase -> rzuca", async () => {
      supabase.from.mockReturnValueOnce(createQueryBuilderMock({ error: new Error("boom") }));
      await expect(fetchAllProfiles()).rejects.toThrow("boom");
    });
  });
});
