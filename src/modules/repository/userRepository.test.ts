import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("../auth/authService", () => ({ getSession }));

const { createUser, changePassword, deleteUser } = await import("./userRepository");

describe("userRepository", () => {
  beforeEach(() => {
    getSession.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("createUser wysyla POST z JWT biezacej sesji", async () => {
    getSession.mockResolvedValue({ access_token: "jwt-123" });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await createUser("nowy", "haslo1234");

    expect(fetch).toHaveBeenCalledWith(
      "/api/admin-create-user",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer jwt-123" }),
        body: JSON.stringify({ username: "nowy", password: "haslo1234" }),
      })
    );
  });

  it("changePassword i deleteUser wolaja odpowiednie endpointy", async () => {
    getSession.mockResolvedValue({ access_token: "jwt-123" });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await changePassword("u1", "noweHaslo1");
    expect(fetch).toHaveBeenCalledWith("/api/admin-change-password", expect.anything());

    await deleteUser("u1");
    expect(fetch).toHaveBeenCalledWith("/api/admin-delete-user", expect.anything());
  });

  it("brak sesji -> rzuca bez wywolania fetch", async () => {
    getSession.mockResolvedValue(null);

    await expect(createUser("x", "y")).rejects.toThrow("Brak aktywnej sesji.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("odpowiedz z bledem -> rzuca z komunikatem serwera", async () => {
    getSession.mockResolvedValue({ access_token: "jwt-123" });
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Login zajety." }), { status: 400 })
    );

    await expect(createUser("zajety", "haslo1234")).rejects.toThrow("Login zajety.");
  });

  it("odpowiedz z bledem bez poprawnego JSON -> generyczny komunikat", async () => {
    getSession.mockResolvedValue({ access_token: "jwt-123" });
    vi.mocked(fetch).mockResolvedValue(new Response("not json", { status: 500 }));

    await expect(createUser("x", "y")).rejects.toThrow("Operacja się nie powiodła.");
  });
});
