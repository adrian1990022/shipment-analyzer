import { describe, expect, it, vi } from "vitest";
import { blockUpdates, deferUntilUnblocked, isUpdateBlocked } from "./updateGuard";

describe("updateGuard", () => {
  it("blokada trwa, dopoki zdjeta jest ostatnia (kilka importow naraz)", () => {
    expect(isUpdateBlocked()).toBe(false);
    const releaseA = blockUpdates();
    const releaseB = blockUpdates();
    expect(isUpdateBlocked()).toBe(true);
    releaseA();
    expect(isUpdateBlocked()).toBe(true);
    releaseB();
    expect(isUpdateBlocked()).toBe(false);
  });

  it("odlozone sprawdzenie wykonuje sie raz, po zdjeciu ostatniej blokady", () => {
    const check = vi.fn();
    const releaseA = blockUpdates();
    const releaseB = blockUpdates();
    deferUntilUnblocked(check);

    releaseA();
    expect(check).not.toHaveBeenCalled();
    releaseB();
    expect(check).toHaveBeenCalledTimes(1);

    // kolejna blokada bez odlozonego sprawdzenia -- nic nie wywoluje
    blockUpdates()();
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("wielokrotne zdjecie tej samej blokady nie psuje licznika", () => {
    const releaseA = blockUpdates();
    const releaseB = blockUpdates();
    releaseA();
    releaseA();
    expect(isUpdateBlocked()).toBe(true);
    releaseB();
    expect(isUpdateBlocked()).toBe(false);
  });
});
