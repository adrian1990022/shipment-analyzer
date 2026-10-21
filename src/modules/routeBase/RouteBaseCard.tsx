import { useEffect, useState } from "react";
import { fetchRouteBaseStatus, replaceRouteBase } from "../repository/routeBaseRepository";
import { formatTimeHHmm, toLocalDateKey } from "../normalizer/normalize";
import { reportError } from "../monitoring/reportError";
import { RouteBaseError, parseRouteBaseFile, type RouteBaseValidation } from "./parseRouteBase";
import type { RouteBaseStatus } from "../../types/shipment";

type Stage =
  | { kind: "idle"; error: string | null; savedCount?: number }
  | { kind: "parsing" }
  | { kind: "reviewing"; filename: string; validation: RouteBaseValidation; error?: string }
  | { kind: "saving"; filename: string; validation: RouteBaseValidation };

// Ile pozycji listy (puste/bledne/konflikty) pokazac -- reszta jako licznik.
const LIST_LIMIT = 10;

export function formatDateTime(iso: string): string {
  const key = toLocalDateKey(iso);
  if (!key) return "—";
  const [y, m, d] = key.split("-");
  return `${d}.${m}.${y} ${formatTimeHHmm(iso)}`;
}

export function isFromToday(iso: string, now: Date = new Date()): boolean {
  return toLocalDateKey(iso) === toLocalDateKey(now.toISOString());
}

// Karta "Baza przypisan tras" (2026-10-21) na ekranie Import: status
// aktywnej bazy + wgranie nowej (cala baza zastepuje poprzednia). Bez
// listy tysiecy rekordow -- tylko status i podsumowanie walidacji pliku.
// Sukces pokazywany dopiero po potwierdzeniu zapisu z bazy.
export function RouteBaseCard({ onSaved }: { onSaved?: () => void }) {
  const [status, setStatus] = useState<{ loading: boolean; error: string | null; data: RouteBaseStatus | null }>({
    loading: true,
    error: null,
    data: null,
  });
  const [stage, setStage] = useState<Stage>({ kind: "idle", error: null });
  const [inputKey, setInputKey] = useState(0);

  async function loadStatus() {
    setStatus((s) => ({ ...s, loading: true, error: null }));
    try {
      setStatus({ loading: false, error: null, data: await fetchRouteBaseStatus() });
    } catch {
      setStatus({ loading: false, error: "Nie udało się sprawdzić stanu bazy przypisań tras.", data: null });
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleFile(file: File | null) {
    if (!file) return;
    setStage({ kind: "parsing" });
    try {
      const validation = await parseRouteBaseFile(file);
      setStage({ kind: "reviewing", filename: file.name, validation });
    } catch (err) {
      if (!(err instanceof RouteBaseError)) reportError(err, { module: "routeBase", stage: "parse" });
      const message = err instanceof RouteBaseError ? err.message : "Nie udało się odczytać pliku.";
      setStage({ kind: "idle", error: message });
      setInputKey((k) => k + 1);
    }
  }

  async function handleSave(filename: string, validation: RouteBaseValidation) {
    setStage({ kind: "saving", filename, validation });
    try {
      const count = await replaceRouteBase(filename, validation.assignments);
      setStage({ kind: "idle", error: null, savedCount: count });
      setInputKey((k) => k + 1);
      await loadStatus();
      onSaved?.();
    } catch (err) {
      const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
      setStage({
        kind: "reviewing",
        filename,
        validation,
        error: `Nie udało się zapisać bazy — poprzednia baza została bez zmian.${detail}`,
      });
    }
  }

  function handleCancel() {
    setStage({ kind: "idle", error: null });
    setInputKey((k) => k + 1);
  }

  const busy = stage.kind === "parsing" || stage.kind === "saving";
  const base = status.data;

  return (
    <div className="card">
      <h2>Baza przypisań tras</h2>
      <p className="hint">
        Plik z kolumnami „Route” i „AWB/BkgRef”. Trasa przesyłki pochodzi wyłącznie z tej bazy (numer = Shipment ID z
        Panoramy). Każde wgranie zastępuje całą poprzednią bazę. Import przesyłek wymaga bazy wgranej dzisiaj.
      </p>

      {status.loading && <p className="hint">Sprawdzam stan bazy…</p>}
      {status.error && <p className="error">{status.error}</p>}
      {!status.loading && !status.error && !base && (
        <p className="warning">Baza przypisań tras nie została jeszcze załadowana.</p>
      )}
      {base && (
        <ul className="summary-list">
          <li>Status: Załadowana</li>
          <li>Liczba rekordów: {base.recordCount.toLocaleString("pl-PL")}</li>
          <li>
            Ostatnia aktualizacja: {formatDateTime(base.uploadedAt)} ({base.zrodlo === "kurier" ? "z aplikacji Kurier" : "z aplikacji Shipment"})
          </li>
          {base.filename && <li>Plik: {base.filename}</li>}
        </ul>
      )}
      {base && !isFromToday(base.uploadedAt) && (
        <p className="warning">Baza nie jest z dzisiaj — import przesyłek jest zablokowany do czasu wgrania dzisiejszej.</p>
      )}

      {stage.kind === "idle" && stage.savedCount !== undefined && (
        <p className="success">
          Zapisano {stage.savedCount.toLocaleString("pl-PL")} przypisań. Poprzednia baza została zastąpiona.
        </p>
      )}
      {stage.kind === "idle" && stage.error && <p className="error">{stage.error}</p>}

      {(stage.kind === "idle" || stage.kind === "parsing") && (
        <label className="file-field">
          <span>{base ? "Wgraj nową bazę" : "Wgraj bazę"}</span>
          <input
            key={inputKey}
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={busy}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
      {stage.kind === "parsing" && <p className="hint">Sprawdzam plik…</p>}

      {(stage.kind === "reviewing" || stage.kind === "saving") && (
        <RouteBaseReview
          filename={stage.filename}
          validation={stage.validation}
          saving={stage.kind === "saving"}
          error={stage.kind === "reviewing" ? stage.error : undefined}
          onSave={() => handleSave(stage.filename, stage.validation)}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

function IssueList({ items }: { items: { wiersz: number; opis: string }[] }) {
  return (
    <ul className="summary-list">
      {items.slice(0, LIST_LIMIT).map((i) => (
        <li key={i.wiersz}>
          wiersz {i.wiersz}: {i.opis}
        </li>
      ))}
      {items.length > LIST_LIMIT && <li>… i {items.length - LIST_LIMIT} więcej</li>}
    </ul>
  );
}

function RouteBaseReview({
  filename,
  validation,
  saving,
  error,
  onSave,
  onCancel,
}: {
  filename: string;
  validation: RouteBaseValidation;
  saving: boolean;
  error?: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { assignments, dataRows, duplicateRows, emptyRows, invalidRows, conflicts, canSave } = validation;
  return (
    <div>
      <h3>Sprawdzenie pliku {filename}</h3>
      <ul className="summary-list">
        <li>Wiersze z danymi: {dataRows}</li>
        <li>Przypisania do zapisania: {assignments.length}</li>
        <li>Powtórzone identyczne pary (scalone): {duplicateRows}</li>
        <li>Pominięte — pusty numer lub trasa: {emptyRows.length}</li>
        <li>Błędne wiersze (blokują zapis): {invalidRows.length}</li>
        <li>Konflikty — numer z różnymi trasami (blokują zapis): {conflicts.length}</li>
      </ul>

      {emptyRows.length > 0 && (
        <div className="warning">
          <p>Wiersze pominięte (nie są przypisaniem):</p>
          <IssueList items={emptyRows} />
        </div>
      )}
      {invalidRows.length > 0 && (
        <div className="error">
          <p>Błędne wiersze — popraw plik i wgraj ponownie:</p>
          <IssueList items={invalidRows} />
        </div>
      )}
      {conflicts.length > 0 && (
        <div className="error">
          <p>Te numery przesyłek mają w pliku różne trasy — popraw plik i wgraj ponownie:</p>
          <ul className="summary-list">
            {conflicts.slice(0, LIST_LIMIT).map((c) => (
              <li key={c.awb} className="mono">
                {c.awb}: {c.routes.join(", ")}
              </li>
            ))}
            {conflicts.length > LIST_LIMIT && <li>… i {conflicts.length - LIST_LIMIT} więcej</li>}
          </ul>
        </div>
      )}
      {assignments.length === 0 && <p className="error">Plik nie zawiera żadnego poprawnego przypisania.</p>}

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button onClick={onCancel} disabled={saving} className="secondary">
          Anuluj
        </button>
        <button onClick={onSave} disabled={saving || !canSave}>
          {saving ? "Zapisuję…" : "Zapisz bazę (zastąpi obecną)"}
        </button>
      </div>
    </div>
  );
}
