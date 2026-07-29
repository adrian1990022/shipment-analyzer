import { useEffect, useState } from "react";
import {
  createSorter,
  fetchRouteAssignmentStatus,
  replaceSorterRoutes,
  setSorterActive,
  updateSorterName,
} from "../repository/sorterRepository";
import type { SorterWithRoutes } from "../../types/sorter";

// Jasne, stonowane tla opcji w selektorze -- czerwony = trasa nalezy juz
// do innego sortujacego (mozna ja "przejac" zaznaczajac i zapisujac),
// zielony = trasa wolna.
const TAKEN_BG = "rgba(248, 113, 113, 0.22)";
const FREE_BG = "rgba(74, 222, 128, 0.22)";

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
  const isEdit = Boolean(sorter);
  const [name, setName] = useState(sorter?.name ?? "");
  const [active, setActive] = useState(sorter?.active ?? true);
  const [assignedRoutes, setAssignedRoutes] = useState<string[]>(sorter?.routes ?? []);
  const [pickedToAdd, setPickedToAdd] = useState<string[]>([]);
  const [routeStatuses, setRouteStatuses] = useState<
    { trasa: string; assignedToSorterId: number | null }[]
  >([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRouteAssignmentStatus()
      .then(setRouteStatuses)
      .catch(() => setError("Nie udalo sie wczytac listy tras."))
      .finally(() => setLoadingRoutes(false));
  }, []);

  // W trybie edycji przypisane trasy maja wlasne okienko (nizej) --
  // selektor sluzy juz tylko do dokladania/przejmowania, wiec nie
  // pokazujemy w nim tras juz przypisanych temu sortujacemu (i tak widac
  // je osobno). Pozostale trasy (wolne i cudze) zostaja pokolorowane.
  const pickerOptions = routeStatuses.filter((r) => !assignedRoutes.includes(r.trasa));

  function handlePickerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setPickedToAdd(Array.from(e.target.selectedOptions).map((o) => o.value));
  }

  function handleRemoveAssigned(route: string) {
    setAssignedRoutes((rs) => rs.filter((r) => r !== route));
  }

  function handleAddPicked() {
    if (pickedToAdd.length === 0) return;
    setAssignedRoutes((rs) => [...rs, ...pickedToAdd].sort((a, b) => a.localeCompare(b)));
    setPickedToAdd([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      // Merge na wszelki wypadek, gdyby ktos zaznaczyl cos w selektorze i
      // od razu kliknal Zapisz bez wczesniejszego "Dodaj zaznaczone".
      const finalRoutes = Array.from(new Set([...assignedRoutes, ...pickedToAdd]));
      if (sorter) {
        await updateSorterName(sorter.id, name.trim());
        await replaceSorterRoutes(sorter.id, finalRoutes);
      } else {
        await createSorter({ name: name.trim(), routes: finalRoutes });
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

      {isEdit && (
        <div className="file-field">
          <span>Przypisane trasy ({assignedRoutes.length})</span>
          {assignedRoutes.length === 0 ? (
            <p className="hint">Brak przypisanych tras.</p>
          ) : (
            <ul className="assigned-routes-list">
              {assignedRoutes.map((route) => (
                <li key={route}>
                  <span>{route}</span>
                  <button type="button" className="secondary" onClick={() => handleRemoveAssigned(route)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label className="file-field">
        <span>
          {isEdit ? "Dodaj trasy" : "Trasy"} (przytrzymaj Ctrl/Cmd, żeby zaznaczyć kilka) — na
          czerwono trasy zajęte przez innego sortującego (wybór przejmie je), na zielono wolne
        </span>
        {loadingRoutes ? (
          <p className="hint">Wczytywanie tras...</p>
        ) : pickerOptions.length === 0 ? (
          <p className="hint">Brak tras do pokazania.</p>
        ) : (
          <select multiple size={8} value={pickedToAdd} onChange={handlePickerChange}>
            {pickerOptions.map(({ trasa, assignedToSorterId }) => (
              <option
                key={trasa}
                value={trasa}
                style={{ backgroundColor: assignedToSorterId === null ? FREE_BG : TAKEN_BG }}
              >
                {trasa}
              </option>
            ))}
          </select>
        )}
        {isEdit && pickerOptions.length > 0 && (
          <button
            type="button"
            className="secondary"
            onClick={handleAddPicked}
            disabled={pickedToAdd.length === 0}
          >
            Dodaj zaznaczone
          </button>
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
