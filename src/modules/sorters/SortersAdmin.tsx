import { useEffect, useMemo, useState } from "react";
import { deleteSorter, fetchSorters, updateSorterDetails } from "../repository/sorterRepository";
import { naturalCompare } from "../normalizer/normalize";
import type { SorterWithRoutes } from "../../types/sorter";
import { EditableCell } from "./EditableCell";

type SortKey = "name" | "fullName" | "firstRoute";

// Trasy sa juz posortowane alfabetycznie per sortujacy (patrz fetchSorters),
// wiec pierwszy element to najwczesniejsza alfabetycznie trasa.
function firstRoute(s: SorterWithRoutes): string {
  return s.routes[0] ?? "";
}

export function SortersAdmin({
  onAdd,
  onEdit,
}: {
  onAdd: () => void;
  onEdit: (sorterId: number) => void;
}) {
  const [sorters, setSorters] = useState<SorterWithRoutes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const visibleSorters = useMemo(() => {
    const sorted = [...sorters].sort((a, b) => {
      if (sortKey === "fullName") {
        // Bez imienia i nazwiska zawsze na koncu, w obu kierunkach.
        const aEmpty = !a.fullName;
        const bEmpty = !b.fullName;
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
        const cmp = naturalCompare(a.fullName ?? "", b.fullName ?? "");
        return sortAsc ? cmp : -cmp;
      }
      const cmp =
        sortKey === "name" ? naturalCompare(a.name, b.name) : naturalCompare(firstRoute(a), firstRoute(b));
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [sorters, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  async function reload() {
    setLoading(true);
    try {
      setSorters(await fetchSorters());
      setError(null);
    } catch {
      setError("Nie udalo sie wczytac listy sortujacych.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  // Edycja w tabeli (dwuklik / olowek): zapis jednego pola, potem lokalna
  // podmiana wiersza -- bez ponownego wczytywania calej listy.
  async function saveField(id: number, fields: { name?: string; fullName?: string | null }) {
    await updateSorterDetails(id, fields);
    setError(null);
    setSorters((list) =>
      list.map((s) =>
        s.id === id
          ? {
              ...s,
              ...(fields.name !== undefined ? { name: fields.name } : {}),
              ...(fields.fullName !== undefined ? { fullName: fields.fullName || null } : {}),
            }
          : s
      )
    );
  }

  async function handleDelete(id: number) {
    await deleteSorter(id);
    await reload();
  }

  return (
    <div className="screen">
      <h1>Sortujący</h1>
      <p className="hint">
        Zarządzanie listą sortujących i przypisanymi im trasami. Trasa bez przypisania nadal trafia
        do sortującego wyliczonego regułą awaryjną (3. litera trasy).
      </p>
      <p className="hint">
        Kliknij dwukrotnie nazwę lub imię i nazwisko (albo ✎), aby edytować. Enter zapisuje, Esc anuluje.
      </p>

      <button onClick={onAdd}>+ Dodaj sortującego</button>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="hint">Wczytywanie...</p>
      ) : (
        <table className="data-table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th className="sortable" onClick={() => toggleSort("name")}>
                Nazwa sortującego {sortKey === "name" && (sortAsc ? "↑" : "↓")}
              </th>
              <th className="sortable" onClick={() => toggleSort("fullName")}>
                Imię i nazwisko {sortKey === "fullName" && (sortAsc ? "↑" : "↓")}
              </th>
              <th className="sortable" onClick={() => toggleSort("firstRoute")}>
                Trasy {sortKey === "firstRoute" && (sortAsc ? "↑" : "↓")}
              </th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleSorters.map((s) => (
              <tr key={s.id}>
                <td>
                  <EditableCell
                    value={s.name}
                    label="nazwę sortującego"
                    required
                    onSave={(name) => saveField(s.id, { name })}
                    onError={setError}
                  />
                </td>
                <td>
                  <EditableCell
                    value={s.fullName ?? ""}
                    label="imię i nazwisko"
                    maxLength={100}
                    onSave={(fullName) => saveField(s.id, { fullName })}
                    onError={setError}
                  />
                </td>
                <td>
                  <span className="routes-cell">{s.routes.join(", ")}</span>
                </td>
                <td>{s.active ? "aktywny" : "nieaktywny"}</td>
                <td>
                  <div className="actions" style={{ marginTop: 0 }}>
                    <button className="secondary" onClick={() => onEdit(s.id)}>
                      Edytuj
                    </button>
                    <button className="secondary" onClick={() => handleDelete(s.id)}>
                      Usuń
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && sorters.length === 0 && <p className="hint">Brak sortujących.</p>}
    </div>
  );
}
