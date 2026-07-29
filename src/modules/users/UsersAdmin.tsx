import { useEffect, useState } from "react";
import { fetchAllProfiles } from "../repository/profileRepository";
import { changePassword, createUser, deleteUser } from "../repository/userRepository";
import type { Profile } from "../../types/auth";

const EMPTY_FORM = { username: "", password: "" };

export function UsersAdmin() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [passwordForUserId, setPasswordForUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  async function reload() {
    setLoading(true);
    try {
      setProfiles(await fetchAllProfiles());
      setError(null);
    } catch {
      setError("Nie udalo sie wczytac listy uzytkownikow.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username.trim() || form.password.length < 8) return;
    setSaving(true);
    setError(null);
    try {
      await createUser(form.username.trim(), form.password);
      setForm(EMPTY_FORM);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udalo sie utworzyc uzytkownika.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(userId: string) {
    if (newPassword.length < 8) {
      setError("Hasło musi mieć co najmniej 8 znaków.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await changePassword(userId, newPassword);
      setPasswordForUserId(null);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udalo sie zmienic hasla.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(userId: string, username: string) {
    if (!window.confirm(`Usunąć użytkownika "${username}"? Tej operacji nie można cofnąć.`)) return;
    setError(null);
    try {
      await deleteUser(userId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udalo sie usunac uzytkownika.");
    }
  }

  return (
    <div className="screen">
      <h1>Użytkownicy</h1>
      <p className="hint">
        Nowy użytkownik zawsze dostaje rolę "user" (bez wyboru roli). Zmiana hasła działa od razu, bez
        wysyłania e-maila.
      </p>

      <form className="card" onSubmit={handleCreate}>
        <h2>+ Dodaj użytkownika</h2>
        <div className="form-row">
          <input
            placeholder="Login"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          />
          <input
            type="password"
            placeholder="Hasło (min. 8 znaków)"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          <button type="submit" disabled={saving}>
            {saving ? "Zapisuję..." : "Dodaj"}
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="hint">Wczytywanie...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Login</th>
              <th>Rola</th>
              <th>Data utworzenia</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.username}</td>
                <td>{p.role === "admin" ? "Administrator" : "Użytkownik"}</td>
                <td>{new Date(p.createdAt).toLocaleDateString("pl-PL")}</td>
                <td>
                  <div className="actions" style={{ marginTop: 0 }}>
                    <button
                      className="secondary"
                      onClick={() => {
                        setPasswordForUserId(p.id === passwordForUserId ? null : p.id);
                        setNewPassword("");
                        setError(null);
                      }}
                    >
                      Zmień hasło
                    </button>
                    <button className="secondary" onClick={() => handleDelete(p.id, p.username)}>
                      Usuń
                    </button>
                  </div>
                  {passwordForUserId === p.id && (
                    <div className="form-row" style={{ marginTop: 8 }}>
                      <input
                        type="password"
                        placeholder="Nowe hasło (min. 8 znaków)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <button type="button" disabled={saving} onClick={() => handleChangePassword(p.id)}>
                        {saving ? "Zapisuję..." : "Zapisz hasło"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && profiles.length === 0 && <p className="hint">Brak użytkowników.</p>}
    </div>
  );
}
