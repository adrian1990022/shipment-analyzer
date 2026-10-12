import { describe, expect, it, vi } from "vitest";
import { fetchAllPages, PAGE_SIZE } from "./fetchAllPages";

function pagedSource(total: number) {
  const all = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
  const range = vi.fn((from: number, to: number) => Promise.resolve({ data: all.slice(from, to + 1), error: null }));
  return { all, range, build: () => ({ range }) };
}

describe("fetchAllPages", () => {
  it("laczy wszystkie strony powyzej limitu 1000 wierszy", async () => {
    const src = pagedSource(2 * PAGE_SIZE + 5);
    const rows = await fetchAllPages(src.build);
    expect(rows).toEqual(src.all);
    expect(src.range).toHaveBeenCalledTimes(3);
    expect(src.range).toHaveBeenNthCalledWith(2, PAGE_SIZE, 2 * PAGE_SIZE - 1);
  });

  it("przy dokladnie pelnej stronie dopytuje o kolejna (pusta)", async () => {
    const src = pagedSource(PAGE_SIZE);
    expect(await fetchAllPages(src.build)).toHaveLength(PAGE_SIZE);
    expect(src.range).toHaveBeenCalledTimes(2);
  });

  it("przekazuje blad zapytania", async () => {
    const error = new Error("blad bazy");
    await expect(
      fetchAllPages(() => ({ range: () => Promise.resolve({ data: null, error }) }))
    ).rejects.toBe(error);
  });
});
