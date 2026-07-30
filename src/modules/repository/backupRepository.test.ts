import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabase } = vi.hoisted(() => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("../../lib/supabaseClient", () => ({ supabase }));

const { replaceReferenceData } = await import("./backupRepository");

const backup = {
  appVersion: "1.0.0",
  schemaVersion: 1,
  createdAt: "2026-07-30T00:00:00.000Z",
  createdBy: "admin",
  routes: [],
  sorters: [],
  sorterRoutes: [],
};

describe("backupRepository.replaceReferenceData", () => {
  beforeEach(() => {
    supabase.rpc.mockReset();
  });

  it("wola RPC replace_reference_data z backupem jako payload", async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null });

    await replaceReferenceData(backup);

    expect(supabase.rpc).toHaveBeenCalledWith("replace_reference_data", { payload: backup });
  });

  it("blad z RPC (np. cofnieta transakcja) -> funkcja rzuca", async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error("constraint violation") });

    await expect(replaceReferenceData(backup)).rejects.toThrow("constraint violation");
  });
});
