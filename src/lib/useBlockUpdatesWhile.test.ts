import { describe, expect, it, vi } from "vitest";

// useEffect wykonywany od razu (srodowisko testow to node, bez renderera) --
// sprawdzamy sam kontrakt hooka: blokada przy active, zdjecie w sprzataniu.
const cleanups: (() => void)[] = [];
vi.mock("react", () => ({
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  },
}));

const { useBlockUpdatesWhile, isUpdateBlocked } = await import("./updateGuard");

describe("useBlockUpdatesWhile", () => {
  it("active=false -> bez blokady", () => {
    useBlockUpdatesWhile(false);
    expect(isUpdateBlocked()).toBe(false);
  });

  it("active=true -> blokada, sprzatanie efektu ja zdejmuje", () => {
    useBlockUpdatesWhile(true);
    expect(isUpdateBlocked()).toBe(true);
    cleanups.pop()!();
    expect(isUpdateBlocked()).toBe(false);
  });
});
