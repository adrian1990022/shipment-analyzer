import { useEffect, useState } from "react";
import { fetchSorterById } from "../repository/sorterRepository";
import type { SorterWithRoutes } from "../../types/sorter";
import { SorterForm } from "./SorterForm";

export function SorterEditScreen({
  sorterId,
  onDone,
  onBack,
}: {
  sorterId: number;
  onDone: () => void;
  onBack: () => void;
}) {
  const [sorter, setSorter] = useState<SorterWithRoutes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSorterById(sorterId)
      .then((s) => (s ? setSorter(s) : setError("Nie znaleziono sortującego.")))
      .catch(() => setError("Nie udalo sie wczytac sortującego."));
  }, [sorterId]);

  return (
    <div className="screen">
      <button className="back" onClick={onBack}>
        ← Sortujący
      </button>
      <h1>Sortujący</h1>
      {error && <p className="error">{error}</p>}
      {!error && !sorter && <p className="hint">Wczytywanie...</p>}
      {sorter && <SorterForm sorter={sorter} onDone={onDone} onCancel={onBack} />}
    </div>
  );
}
