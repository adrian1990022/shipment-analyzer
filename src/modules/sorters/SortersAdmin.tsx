import { useEffect, useMemo, useState } from "react";
import { deleteSorter, fetchSorters } from "../repository/sorterRepository";
import { naturalCompare } from "../normalizer/normalize";
import type { SorterWithRoutes } from "../../types/sorter";
import { SorterForm } from "./SorterForm";

type Mode = { kind: "list" } | { kind: "add" } | { kind: "edit"; sorter: SorterWithRoutes };

export function SortersAdmin() {
  const [sorters, setSorters] = useState<SorterWithRoutes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [sortAsc, setSortAsc] = useState(true);

  const visibleSorters = useMemo(() => {
    const sorted = [...sorters].sort((a, b) => naturalCompare(a.name, b.name));
    return sortAsc ? sorted : sorted.reverse();
  }, [sorters, sortAsc]);

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

  if (mode.kind === "add") {
    return (
      <div className="screen">
        <h1>Sortujący</h1>
        <SorterForm
          onDone={() => {
            setMode({ kind: "list" });
            reload();
          }}
          onCancel={() => setMode({ kind: "list" })}
        />
      </div>
    );
  }

  if (mode.kind === "edit") {
    return (
      <div className="screen">
        <h1>Sortujący</h1>
        <SorterForm
          sorter={mode.sorter}
          onDone={() => {
            setMode({ kind: "list" });
            reload();
          }}
          onCancel={() => setMode({ kind: "list" })}
        />
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>Sortujący</h1>
      <p className="hint">
        Zarządzanie listą sortujących i przypisanymi im trasami. Trasa bez przypisania nadal trafia
        do sortującego wyliczonego regułą awaryjną (3. litera trasy).
      </p>

      <button onClick={() => setMode({ kind: "add" })}>+ Dodaj sortującego</button>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="hint">Wczytywanie...</p>
      ) : (
        <table className="data-table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th className="sortable" onClick={() => setSortAsc((v) => !v)}>
                Nazwa sortującego {sortAsc ? "↑" : "↓"}
              </th>
              <th>Liczba przypisanych tras</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleSorters.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.routes.length}</td>
                <td>{s.active ? "aktywny" : "nieaktywny"}</td>
                <td>
                  <div className="actions" style={{ marginTop: 0 }}>
                    <button className="secondary" onClick={() => setMode({ kind: "edit", sorter: s })}>
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
