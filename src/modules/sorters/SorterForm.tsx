import { useEffect, useState } from "react";
import {
  createSorter,
  fetchAvailableRoutes,
  replaceSorterRoutes,
  setSorterActive,
  updateSorterName,
} from "../repository/sorterRepository";
import type { SorterWithRoutes } from "../../types/sorter";

export function SorterForm({
  sorter,
  onDone,
  onCancel,
}: {
  // Brak = tryb dodawania. Podany = tryb edycji.
  sorter?: SorterWithRoutes;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(sorter?.name ?? "");
  const [active, setActive] = useState(sorter?.active ?? true);
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>(sorter?.routes ?? []);
  const [availableRoutes, setAvailableRoutes] = useState<string[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailableRoutes(sorter?.id)
      .then(setAvailableRoutes)
      .catch(() => setError("Nie udalo sie wczytac listy tras."))
      .finally(() => setLoadingRoutes(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRoutesChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const values = Array.from(e.target.selectedOptions).map((o) => o.value);
    setSelectedRoutes(values);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (sorter) {
        await updateSorterName(sorter.id, name.trim());
        await replaceSorterRoutes(sorter.id, selectedRoutes);
      } else {
        await createSorter({ name: name.trim(), routes: selectedRoutes });
      }
      onDone();
    } catch {
      setError("Nie udalo sie zapisac sortujacego.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!sorter) return;
    setSaving(true);
    try {
      await setSorterActive(sorter.id, !active);
      setActive((v) => !v);
    } catch {
      setError("Nie udalo sie zmienic statusu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>{sorter ? "Edytuj sortującego" : "Dodaj sortującego"}</h2>

      <label className="file-field">
        <span>Nazwa</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Jan Kowalski" />
      </label>

      <label className="file-field">
        <span>Trasy (przytrzymaj Ctrl/Cmd, żeby zaznaczyć kilka)</span>
        {loadingRoutes ? (
          <p className="hint">Wczytywanie tras...</p>
        ) : availableRoutes.length === 0 ? (
          <p className="hint">Brak wolnych tras do przypisania.</p>
        ) : (
          <select multiple size={8} value={selectedRoutes} onChange={handleRoutesChange}>
            {availableRoutes.map((trasa) => (
              <option key={trasa} value={trasa}>
                {trasa}
              </option>
            ))}
          </select>
        )}
      </label>

      {sorter && (
        <p className="hint">
          Status: {active ? "aktywny" : "nieaktywny"} —{" "}
          <button type="button" className="secondary" onClick={handleToggleActive} disabled={saving}>
            {active ? "Dezaktywuj" : "Aktywuj"}
          </button>
        </p>
      )}

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
          Anuluj
        </button>
        <button type="submit" disabled={saving}>
          {saving ? "Zapisuję..." : "Zapisz"}
        </button>
      </div>
    </form>
  );
}
