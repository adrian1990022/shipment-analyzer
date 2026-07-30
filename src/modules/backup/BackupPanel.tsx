import { useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { buildBackup, importBackup, triggerDownload, validateBackup } from "./referenceBackupService";
import type { BackupImportSummary } from "../../types/backup";

// Komponent zna tylko "eksportuj/importuj plik" -- caly ksztalt JSON,
// walidacja i wersjonowanie zyja w referenceBackupService.
export function BackupPanel({ onImported }: { onImported: () => void }) {
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [summary, setSummary] = useState<BackupImportSummary | null>(null);

  async function handleExport() {
    setExporting(true);
    setErrors([]);
    try {
      const backup = await buildBackup(profile?.username ?? "nieznany");
      triggerDownload(backup);
    } catch {
      setErrors(["Nie udało się przygotować kopii zapasowej."]);
    } finally {
      setExporting(false);
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    setErrors([]);
    setSummary(null);

    const raw = await file.text();
    const result = validateBackup(raw);
    if (!result.valid || !result.data) {
      setErrors(result.errors.length > 0 ? result.errors : ["Plik jest niepoprawny."]);
      return;
    }

    if (!window.confirm("Obecna konfiguracja zostanie zastąpiona. Czy kontynuować?")) {
      return;
    }

    setImporting(true);
    try {
      const importSummary = await importBackup(result.data);
      setSummary(importSummary);
      onImported();
    } catch {
      setErrors(["Import się nie powiódł — żadne dane nie zostały zmienione (transakcja cofnięta)."]);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="card">
      <h2>Kopia zapasowa</h2>
      <p className="hint">
        Obejmuje wyłącznie dane referencyjne (trasy i sortujących) — nie zawiera przesyłek ani
        użytkowników.
      </p>

      <div className="actions" style={{ marginTop: 0 }}>
        <button type="button" className="secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? "Przygotowuję..." : "Eksportuj kopię zapasową"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          {importing ? "Importuję..." : "Importuj kopię zapasową"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />
      </div>

      {errors.length > 0 && (
        <div className="warning">
          {errors.map((err) => (
            <p key={err} className="error">
              {err}
            </p>
          ))}
        </div>
      )}

      {summary && (
        <p className="hint">
          Zaimportowano: {summary.routesCount} tras, {summary.sortersCount} sortujących,{" "}
          {summary.sorterRoutesCount} przypisań.
        </p>
      )}
    </div>
  );
}
