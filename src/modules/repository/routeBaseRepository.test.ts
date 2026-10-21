import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilderMock } from "../../test/supabaseMock";

const { supabase } = vi.hoisted(() => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("../../lib/supabaseClient", () => ({ supabase }));

const { fetchRouteBaseStatus, fetchRouteBase, replaceRouteBase } = await import("./routeBaseRepository");

const META = { uploaded_at: "2026-10-21T05:00:00.000Z", filename: "baza.xlsx", record_count: 2, zrodlo: "kurier" };

describe("routeBaseRepository", () => {
  beforeEach(() => {
    supabase.from.mockReset();
    supabase.rpc.mockReset();
  });

  it("fetchRouteBaseStatus: brak wiersza meta -> null (baza nie wgrana)", async () => {
    supabase.from.mockReturnValueOnce(createQueryBuilderMock({ data: null }));
    expect(await fetchRouteBaseStatus()).toBeNull();
  });

  it("fetchRouteBaseStatus: mapuje meta", async () => {
    supabase.from.mockReturnValueOnce(createQueryBuilderMock({ data: META }));
    expect(await fetchRouteBaseStatus()).toEqual({
      uploadedAt: META.uploaded_at,
      filename: "baza.xlsx",
      recordCount: 2,
      zrodlo: "kurier",
    });
  });

  it("fetchRouteBase: cala baza do mapy numer -> trasa", async () => {
    supabase.from
      .mockReturnValueOnce(createQueryBuilderMock({ data: META }))
      .mockReturnValueOnce(
        createQueryBuilderMock({
          data: [
            { awb: "1", route: "WAEX" },
            { awb: "2", route: "WALC" },
          ],
        })
      );

    const base = await fetchRouteBase();

    expect(base?.uploadedAt).toBe(META.uploaded_at);
    expect(Array.from(base!.routeByAwb.entries())).toEqual([
      ["1", "WAEX"],
      ["2", "WALC"],
    ]);
  });

  it("fetchRouteBase: baza nie wgrana -> null, bez pobierania rekordow", async () => {
    supabase.from.mockReturnValueOnce(createQueryBuilderMock({ data: null }));
    expect(await fetchRouteBase()).toBeNull();
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("replaceRouteBase: jedno wywolanie replace_route_assignments", async () => {
    supabase.rpc.mockResolvedValueOnce({ data: 2, error: null });

    const count = await replaceRouteBase("baza.xlsx", [
      { awb: "1", route: "WAEX" },
      { awb: "2", route: "WALC" },
    ]);

    expect(count).toBe(2);
    expect(supabase.rpc).toHaveBeenCalledWith("replace_route_assignments", {
      p_filename: "baza.xlsx",
      p_rows: [
        { awb: "1", route: "WAEX" },
        { awb: "2", route: "WALC" },
      ],
      p_zrodlo: "shipment",
    });
  });

  it("replaceRouteBase: blad bazy (np. konflikt) -> rzuca", async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error("konflikt") });
    await expect(replaceRouteBase("b.xlsx", [{ awb: "1", route: "WAEX" }])).rejects.toThrow("konflikt");
  });

  it("fetchRouteBaseStatus: blad bazy -> rzuca", async () => {
    supabase.from.mockReturnValueOnce(createQueryBuilderMock({ error: new Error("boom") }));
    await expect(fetchRouteBaseStatus()).rejects.toThrow("boom");
  });
});
