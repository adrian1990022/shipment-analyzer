import { useEffect, useState } from "react";
import { deleteRoute, fetchRoutes, upsertRoute } from "../repository/routesRepository";
import type { RouteRef } from "../../types/shipment";

const EMPTY_FORM = { chuteId: "", trasa: "", grupa: "P1" as "P1" | "P2" | "P3" };

export function RoutesAdmin() {
  const [routes, setRoutes] = useState<RouteRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      setRoutes(await fetchRoutes());
      setError(null);
    } catch {
      setError("Nie udalo sie wczytac danych referencyjnych.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.chuteId.trim() || !form.trasa.trim()) return;
    setSaving(true);
    try {
      await upsertRoute({
        chuteId: form.chuteId.trim(),
        trasa: form.trasa.trim(),
        grupa: form.grupa,
      });
      setForm(EMPTY_FORM);
      await reload();
    } catch {
      setError("Nie udalo sie zapisac trasy.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await deleteRoute(id);
    await reload();
  }

  return (
    <div className="screen">
      <h1>Dane referencyjne (trasy)</h1>
      <p className="hint">
        Mapowanie Chute ID → Trasa → Grupa kafelka. Chute ID = COY004 jest obslugiwane osobno i nie
        wymaga wpisu tutaj.
      </p>

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-row">
          <input
            placeholder="Chute ID"
            value={form.chuteId}
            onChange={(e) => setForm((f) => ({ ...f, chuteId: e.target.value }))}
          />
          <input
            placeholder="Trasa"
            value={form.trasa}
            onChange={(e) => setForm((f) => ({ ...f, trasa: e.target.value }))}
          />
          <select
            value={form.grupa}
            onChange={(e) => setForm((f) => ({ ...f, grupa: e.target.value as "P1" | "P2" | "P3" }))}
          >
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
          </select>
          <button type="submit" disabled={saving}>
            {saving ? "Zapisuję..." : "Zapisz"}
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
              <th>Chute ID</th>
              <th>Trasa</th>
              <th>Grupa</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
              <tr key={r.id}>
                <td>{r.chuteId}</td>
                <td>{r.trasa}</td>
                <td>{r.grupa}</td>
                <td>
                  <button className="secondary" onClick={() => handleDelete(r.id)}>
                    Usuń
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
