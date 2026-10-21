import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { registerSW } = vi.hoisted(() => ({ registerSW: vi.fn() }));
vi.mock("virtual:pwa-register", () => ({ registerSW }));
const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));
vi.mock("../modules/monitoring/reportError", () => ({ reportError }));

const { registerServiceWorker, UPDATE_CHECK_INTERVAL_MS } = await import("./registerServiceWorker");
const { blockUpdates } = await import("./updateGuard");

type Options = Parameters<typeof import("virtual:pwa-register").registerSW>[0] & {
  onRegisteredSW: (swUrl: string, r: ServiceWorkerRegistration | undefined) => void;
  onRegisterError: (e: unknown) => void;
};

// Srodowisko testow to node -- minimalne atrapy navigator/document/fetch.
function setupBrowser({ online = true } = {}) {
  const listeners = new Map<string, () => void>();
  const doc = {
    visibilityState: "visible",
    addEventListener: vi.fn((type: string, fn: () => void) => listeners.set(type, fn)),
  };
  vi.stubGlobal("navigator", { serviceWorker: {}, onLine: online });
  vi.stubGlobal("document", doc);
  const fetchMock = vi.fn(async () => ({ status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return { doc, listeners, fetchMock };
}

function registered(): Options {
  return registerSW.mock.calls[0][0] as Options;
}

describe("registerServiceWorker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    registerSW.mockReset();
    reportError.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("rejestruje SW od razu (immediate)", () => {
    setupBrowser();
    registerServiceWorker();
    expect(registerSW).toHaveBeenCalledTimes(1);
    expect(registered().immediate).toBe(true);
  });

  it("przegladarka bez Service Workera -> nic nie robi", () => {
    vi.stubGlobal("navigator", {});
    registerServiceWorker();
    expect(registerSW).not.toHaveBeenCalled();
  });

  it("co 5 minut sprawdza nowe wydanie (fetch sw.js bez cache, potem update)", async () => {
    const { fetchMock } = setupBrowser();
    const update = vi.fn(async () => {});
    registerServiceWorker();
    registered().onRegisteredSW("/sw.js", { installing: null, update } as unknown as ServiceWorkerRegistration);

    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);

    expect(fetchMock).toHaveBeenCalledWith("/sw.js", expect.objectContaining({ cache: "no-store" }));
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("powrot do karty/aplikacji -> natychmiastowe sprawdzenie", async () => {
    const { listeners } = setupBrowser();
    const update = vi.fn(async () => {});
    registerServiceWorker();
    registered().onRegisteredSW("/sw.js", { installing: null, update } as unknown as ServiceWorkerRegistration);

    listeners.get("visibilitychange")!();
    await vi.advanceTimersByTimeAsync(0);

    expect(update).toHaveBeenCalledTimes(1);
  });

  it("karta ukryta -> visibilitychange nie sprawdza", async () => {
    const { listeners, doc } = setupBrowser();
    const update = vi.fn(async () => {});
    registerServiceWorker();
    registered().onRegisteredSW("/sw.js", { installing: null, update } as unknown as ServiceWorkerRegistration);

    doc.visibilityState = "hidden";
    listeners.get("visibilitychange")!();
    await vi.advanceTimersByTimeAsync(0);

    expect(update).not.toHaveBeenCalled();
  });

  it("bez sieci -> nie sprawdza (ani fetch, ani update)", async () => {
    const { fetchMock } = setupBrowser({ online: false });
    const update = vi.fn(async () => {});
    registerServiceWorker();
    registered().onRegisteredSW("/sw.js", { installing: null, update } as unknown as ServiceWorkerRegistration);

    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("nowy SW juz sie instaluje -> nie sprawdza drugi raz", async () => {
    const { fetchMock } = setupBrowser();
    const update = vi.fn(async () => {});
    registerServiceWorker();
    registered().onRegisteredSW("/sw.js", { installing: {}, update } as unknown as ServiceWorkerRegistration);

    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("blad serwera albo sieci przy pobraniu sw.js -> bez update(), bez wyjatku", async () => {
    const { fetchMock } = setupBrowser();
    const update = vi.fn(async () => {});
    registerServiceWorker();
    registered().onRegisteredSW("/sw.js", { installing: null, update } as unknown as ServiceWorkerRegistration);

    fetchMock.mockResolvedValueOnce({ status: 503 });
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(update).not.toHaveBeenCalled();
  });

  it("import w toku -> sprawdzenie odlozone i wykonane zaraz po jego koncu", async () => {
    setupBrowser();
    const update = vi.fn(async () => {});
    registerServiceWorker();
    registered().onRegisteredSW("/sw.js", { installing: null, update } as unknown as ServiceWorkerRegistration);

    const release = blockUpdates();
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);
    expect(update).not.toHaveBeenCalled();

    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("brak rejestracji -> brak sprawdzania", () => {
    setupBrowser();
    registerServiceWorker();
    registered().onRegisteredSW("/sw.js", undefined);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("blad rejestracji trafia do monitoringu", () => {
    setupBrowser();
    registerServiceWorker();
    registered().onRegisterError(new Error("boom"));
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { module: "serviceWorker", stage: "register" });
  });
});
