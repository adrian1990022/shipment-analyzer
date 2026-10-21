import { useState } from "react";
import { runImportPipeline, PipelineError } from "./pipeline";
import { saveImport } from "../repository/shipmentsRepository";
import { formatTimeHHmm } from "../normalizer/normalize";
import { RECENT_SCAN_WINDOW_MINUTES, buildScanCutoff } from "../dateFilter/filterByScanCutoff";
import { reportError } from "../monitoring/reportError";
import { AttendanceImport } from "../attendance/AttendanceImport";
import { useBlockUpdatesWhile } from "../../lib/updateGuard";
import { RouteBaseCard, formatDateTime } from "../routeBase/RouteBaseCard";
import type { ImportResult } from "../../types/shipment";

type Stage =
  | { kind: "picking"; error: string | null }
  | { kind: "analyzing" }
  | { kind: "reviewing"; result: ImportResult; error?: string }
  | { kind: "saving"; result: ImportResult }
  | { kind: "saved" };

const GROUP_LABELS: Record<string, string> = {
  P1: "P1",
  P2: "P2",
  P3: "P3",
  COY004: "COY004",
  NIEPRZYPISANE: "Nieprzypisane",
};

// Powod braku trasy na liscie nieprzypisanych w podsumowaniu.
function powod(przypisanie: string | null): string {
  return przypisanie === "nieznana_trasa" ? "trasa spoza Danych referencyjnych" : "brak numeru w bazie";
}

function currentTimeHHmm(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function ImportScreen({ onSaved }: { onSaved: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: "picking", error: null });
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  // Godzina, od ktorej liczone jest okno 15 minut wstecz (przesylki ze
  // skanem w tym oknie sa pomijane). Domyslnie biezaca godzina.
  const [cutoffTime, setCutoffTime] = useState(currentTimeHHmm);
  // Bez automatycznej aktualizacji od "Analizuj" do zapisu/odrzucenia.
  useBlockUpdatesWhile(stage.kind === "analyzing" || stage.kind === "reviewing" || stage.kind === "saving");

  async function handleAnalyze() {
    const cutoff = buildScanCutoff(cutoffTime);
    if (!cutoff) {
      setStage({ kind: "picking", error: "Wpisz poprawną godzinę (GG:MM)." });
      return;
    }
    if (!fileA || !fileB) {
      setStage({ kind: "picking", error: "Wybierz oba pliki: Panorama i Sherloc." });
      return;
    }
    setStage({ kind: "analyzing" });
    try {
      const result = await runImportPipeline(fileA, fileB, cutoff);
      setStage({ kind: "reviewing", result });
    } catch (err) {
      // PipelineError = oczekiwana walidacja (zly plik, nierozpoznane
      // naglowki) pokazywana uzytkownikowi -- nie incydent. Wszystko inne
      // to prawdziwie nieoczekiwany blad w parsowaniu/pipeline.
      if (!(err instanceof PipelineError)) {
        reportError(err, { module: "import", stage: "pipeline" });
      }
      const message = err instanceof PipelineError ? err.message : "Nie udalo sie przeanalizowac plikow.";
      setStage({ kind: "picking", error: message });
    }
  }

  async function handleAccept(result: ImportResult) {
    setStage({ kind: "saving", result });
    try {
      // Jedno wywolanie, wszystko albo nic (import_shipments, migracja
      // 0011) -- przy bledzie poprzednie dane zostaja nietkniete.
      await saveImport(result);
    } catch {
      setStage({
        kind: "reviewing",
        result,
        error: "Nie udalo sie zapisac importu. Poprzednie dane zostaly bez zmian -- sprobuj ponownie.",
      });
      return;
    }
    setStage({ kind: "saved" });
    onSaved();
  }

  function handleReject() {
    setFileA(null);
    setFileB(null);
    setStage({ kind: "picking", error: null });
  }

  return (
    <div className="screen">
      <h1>Import raportow</h1>

      {/* Baza przypisan tras (2026-10-21) -- trasy przesylek pochodza tylko
          z niej; import ponizej wymaga bazy wgranej dzisiaj. */}
      <RouteBaseCard />

      {(stage.kind === "picking" || stage.kind === "analyzing") && (
        <div className="card">
          <label className="file-field">
            <span>Godzina raportu</span>
            <input type="time" value={cutoffTime} onChange={(e) => setCutoffTime(e.target.value)} />
          </label>
          <p className="hint">
            Przesylki, ktorych ostatni skan byl w ciagu {RECENT_SCAN_WINDOW_MINUTES} minut przed ta
            godzina (albo pozniej), zostana pominiete. Wszystkie starsze -- takze z poprzednich dni --
            zostaja w raporcie.
          </p>
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
          error={stage.kind === "reviewing" ? stage.error : undefined}
          onAccept={() => handleAccept(stage.result)}
          onReject={handleReject}
        />
      )}

      {stage.kind === "saved" && (
        <div className="card">
          <p>Dane zapisane. Poprzedni import zostal zastapiony.</p>
        </div>
      )}

      {/* Lista obecnosci sortujacych (2026-10-13) -- niezalezna od importu
          raportow, wklejana z Excela. */}
      <AttendanceImport />
    </div>
  );
}

function ImportSummaryCard({
  result,
  saving,
  error,
  onAccept,
  onReject,
}: {
  result: ImportResult;
  error?: string;
  saving: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const { summary, shipments } = result;
  const nieprzypisane = shipments.filter((s) => s.grupa === "NIEPRZYPISANE");
  return (
    <div className="card">
      <h2>Podsumowanie importu</h2>
      <ul className="summary-list">
        <li>Plik Panorama: {summary.panoramaFilename}</li>
        <li>Plik Sherloc: {summary.sherlocFilename}</li>
        <li>Wiersze Panorama (razem): {summary.totalRows}</li>
        <li>Dopasowane do Sherloc: {summary.matchedRows}</li>
        <li>Bez dopasowania w Sherloc: {summary.unmatchedRows}</li>
        {summary.cutoffAt && (
          <li>
            Pominiete -- skan w ciagu {RECENT_SCAN_WINDOW_MINUTES} min przed godzina raportu (od{" "}
            {formatTimeHHmm(summary.cutoffAt)}): {summary.recentSkippedRows}
          </li>
        )}
        <li>Pominiete -- brak daty ostatniego skanu: {summary.noDateRows}</li>
        <li>Przesylki w raporcie: {summary.resultRows}</li>
        {summary.routeBaseUploadedAt && (
          <li>Baza przypisan tras z: {formatDateTime(summary.routeBaseUploadedAt)}</li>
        )}
        <li>Trasa z bazy przypisan: {summary.przypisanieCounts.baza}</li>
        <li>Nieprzypisane -- brak numeru w bazie: {summary.przypisanieCounts.brak_w_bazie}</li>
        <li>Nieprzypisane -- trasa spoza Danych referencyjnych: {summary.przypisanieCounts.nieznana_trasa}</li>
        <li>Z trasa, ale bez sortujacego: {summary.bezSortujacegoRows}</li>
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

      {nieprzypisane.length > 0 && (
        <details className="warning">
          <summary>
            Nieprzypisane przesylki ({nieprzypisane.length}) -- zostana zapisane i beda widoczne na kafelku
            „Nieprzypisane”
          </summary>
          <table className="mini-table">
            <thead>
              <tr>
                <th>Shipment ID</th>
                <th>Chute ID</th>
                <th>Trasa</th>
                <th>Powod</th>
              </tr>
            </thead>
            <tbody>
              {nieprzypisane.map((s) => (
                <tr key={s.shipmentId}>
                  <td className="mono">{s.shipmentId}</td>
                  <td>{s.chuteId || "—"}</td>
                  <td>{s.trasa || "—"}</td>
                  <td>{powod(s.przypisanie)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <p className="hint">
        Dane zostana zapisane dopiero po akceptacji i CALKOWICIE zastapia poprzedni import.
      </p>

      {error && <p className="error">{error}</p>}

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
