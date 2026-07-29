import { useEffect, useMemo, useState } from "react";
import { deleteSorter, fetchSorters } from "../repository/sorterRepository";
import { naturalCompare } from "../normalizer/normalize";
import type { SorterWithRoutes } from "../../types/sorter";

type SortKey = "name" | "firstRoute";

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
                <td>{s.name}</td>
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
