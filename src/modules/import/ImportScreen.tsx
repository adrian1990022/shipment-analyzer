import { useState } from "react";
import { runImportPipeline, PipelineError } from "./pipeline";
import { replaceShipments } from "../repository/shipmentsRepository";
import type { ImportResult } from "../../types/shipment";

type Stage =
  | { kind: "picking"; error: string | null }
  | { kind: "analyzing" }
  | { kind: "reviewing"; result: ImportResult }
  | { kind: "saving"; result: ImportResult }
  | { kind: "saved" };

const GROUP_LABELS: Record<string, string> = {
  P1: "P1",
  P2: "P2",
  P3: "P3",
  COY004: "COY004",
};

export function ImportScreen({ onSaved }: { onSaved: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: "picking", error: null });
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);

  async function handleAnalyze() {
    if (!fileA || !fileB) {
      setStage({ kind: "picking", error: "Wybierz oba pliki: Panorama i Sherloc." });
      return;
    }
    setStage({ kind: "analyzing" });
    try {
      const result = await runImportPipeline(fileA, fileB);
      setStage({ kind: "reviewing", result });
    } catch (err) {
      const message = err instanceof PipelineError ? err.message : "Nie udalo sie przeanalizowac plikow.";
      setStage({ kind: "picking", error: message });
    }
  }

  async function handleAccept(result: ImportResult) {
    setStage({ kind: "saving", result });
    try {
      await replaceShipments(result.shipments, result.summary);
      setStage({ kind: "saved" });
      onSaved();
    } catch {
      setStage({ kind: "reviewing", result });
    }
  }

  function handleReject() {
    setFileA(null);
    setFileB(null);
    setStage({ kind: "picking", error: null });
  }

  return (
    <div className="screen">
      <h1>Import raportow</h1>

      {(stage.kind === "picking" || stage.kind === "analyzing") && (
        <div className="card">
          <label className="file-field">
            <span>Plik 1</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFileA(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="file-field">
            <span>Plik 2</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFileB(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="hint">
            Kolejnosc nie ma znaczenia -- typ raportu (Panorama / Sherloc) jest rozpoznawany automatycznie po kolumnach.
          </p>
          {stage.kind === "picking" && stage.error && <p className="error">{stage.error}</p>}
          <button onClick={handleAnalyze} disabled={stage.kind === "analyzing"}>
            {stage.kind === "analyzing" ? "Analizuję..." : "Analizuj"}
          </button>
        </div>
      )}

      {(stage.kind === "reviewing" || stage.kind === "saving") && (
        <ImportSummaryCard
          result={stage.result}
          saving={stage.kind === "saving"}
          onAccept={() => handleAccept(stage.result)}
          onReject={handleReject}
        />
      )}

      {stage.kind === "saved" && (
        <div className="card">
          <p>Dane zapisane. Poprzedni import zostal zastapiony.</p>
        </div>
      )}
    </div>
  );
}

function ImportSummaryCard({
  result,
  saving,
  onAccept,
  onReject,
}: {
  result: ImportResult;
  saving: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const { summary, unmappedChuteIds } = result;
  return (
    <div className="card">
      <h2>Podsumowanie importu</h2>
      <ul className="summary-list">
        <li>Plik Panorama: {summary.panoramaFilename}</li>
        <li>Plik Sherloc: {summary.sherlocFilename}</li>
        <li>Wiersze Panorama (razem): {summary.totalRows}</li>
        <li>Dopasowane do Sherloc: {summary.matchedRows}</li>
        <li>Bez dopasowania w Sherloc: {summary.unmatchedRows}</li>
        <li>Z dzisiejsza data (Last Phy Cp dt): {summary.todayRows}</li>
        <li>Bez mapowania trasy (Chute ID spoza tabeli routes): {summary.unmappedRows}</li>
      </ul>

      <table className="mini-table">
        <thead>
          <tr>
            <th>Kafelek</th>
            <th>Liczba przesylek</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(summary.groupCounts).map(([grupa, count]) => (
            <tr key={grupa}>
              <td>{GROUP_LABELS[grupa] ?? grupa}</td>
              <td>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {unmappedChuteIds.length > 0 && (
        <div className="warning">
          <p>
            Ponizsze Chute ID nie maja przypisanej trasy w tabeli referencyjnej i zostaly pominiete w
            wyniku. Dodaj je w sekcji "Dane referencyjne", a nastepnie zaimportuj ponownie.
          </p>
          <p className="mono">{unmappedChuteIds.join(", ")}</p>
        </div>
      )}

      <p className="hint">
        Dane zostana zapisane dopiero po akceptacji i CALKOWICIE zastapia poprzedni import.
      </p>

      <div className="actions">
        <button onClick={onReject} disabled={saving} className="secondary">
          Odrzuc
        </button>
        <button onClick={onAccept} disabled={saving}>
          {saving ? "Zapisuję..." : "Zatwierdz i zapisz"}
        </button>
      </div>
    </div>
  );
}
