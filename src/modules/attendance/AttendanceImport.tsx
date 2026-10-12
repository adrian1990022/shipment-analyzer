import { useEffect, useState } from "react";
import { fetchSorters } from "../repository/sorterRepository";
import { fetchAttendanceMonths, saveAttendanceMonth, type AttendanceMonthInfo } from "../repository/attendanceRepository";
import { parseAttendance, type AttendanceParseResult } from "./parseAttendance";

// Lista obecnosci sortujacych (2026-10-13): admin wkleja kolumne z Excela
// ("Jan Kowalski_5"), widzi podglad (rozpoznani / nieznani / bledne wpisy)
// i zapisuje CALY wybrany miesiac naraz. Kurier_appp pokazuje to
// sortujacym w kafelku "Sortujacy". Miesiac do wyboru: biezacy albo
// poprzedni (tyle trzyma baza -- retencja).

const MONTHS = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];

interface MonthOption {
  year: number;
  month: number; // 1-12
  key: string; // "RRRR-MM-01"
  label: string;
}

function monthOption(date: Date): MonthOption {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return { year, month, key: `${year}-${String(month).padStart(2, "0")}-01`, label: `${MONTHS[month - 1]} ${year}` };
}

function monthOptions(): MonthOption[] {
  const now = new Date();
  return [monthOption(now), monthOption(new Date(now.getFullYear(), now.getMonth() - 1, 1))];
}

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

type Stage =
  | { kind: "editing"; error: string | null }
  | { kind: "checking" }
  | { kind: "reviewing"; result: AttendanceParseResult; error: string | null }
  | { kind: "saving"; result: AttendanceParseResult }
  | { kind: "saved"; count: number };

export function AttendanceImport() {
  const options = monthOptions();
  const [monthKey, setMonthKey] = useState(options[0].key);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "editing", error: null });
  const [months, setMonths] = useState<AttendanceMonthInfo[]>([]);

  const selected = options.find((o) => o.key === monthKey) ?? options[0];

  function loadMonths() {
    fetchAttendanceMonths()
      .then(setMonths)
      .catch(() => setMonths([]));
  }

  useEffect(loadMonths, []);

  async function handleCheck() {
    if (!text.trim()) {
      setStage({ kind: "editing", error: "Wklej listę obecności." });
      return;
    }
    setStage({ kind: "checking" });
    try {
      const sorters = await fetchSorters();
      const result = parseAttendance(text, selected.year, selected.month, sorters);
      setStage({ kind: "reviewing", result, error: null });
    } catch {
      setStage({ kind: "editing", error: "Nie udało się wczytać listy sortujących." });
    }
  }

  async function handleSave(result: AttendanceParseResult) {
    if (result.lastDay === null) return;
    setStage({ kind: "saving", result });
    const lastDay = `${selected.year}-${String(selected.month).padStart(2, "0")}-${String(result.lastDay).padStart(2, "0")}`;
    try {
      const count = await saveAttendanceMonth(selected.key, lastDay, result.entries);
      setStage({ kind: "saved", count });
      setText("");
      loadMonths();
    } catch {
      setStage({
        kind: "reviewing",
        result,
        error: "Nie udało się zapisać. Poprzednie dane zostały bez zmian — spróbuj ponownie.",
      });
    }
  }

  const editing = stage.kind === "editing" || stage.kind === "checking";
  const uploaded = months.find((m) => m.month === selected.key);

  return (
    <div className="card">
      <h2>Lista obecności sortujących</h2>

      {editing && (
        <>
          <label className="file-field">
            <span>Miesiąc</span>
            <select value={monthKey} onChange={(e) => setMonthKey(e.target.value)}>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <p className="hint">
            {uploaded
              ? `Wgrane do ${formatDay(uploaded.lastDay)} — nowe wklejenie zastąpi cały ${selected.label}.`
              : `Za ${selected.label} nic jeszcze nie wgrano.`}
          </p>
          <label className="file-field">
            <span>Wklej kolumnę z Excela, np. „Jan Kowalski_1”, „Jan Kowalski_2”…</span>
            <textarea
              className="attendance-paste"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={"Jan Kowalski_1\nJan Kowalski_2\nAnna Nowak_1"}
            />
          </label>
          <p className="hint">
            Osoby są rozpoznawane po kolumnie „Imię i nazwisko” na ekranie Sortujący (wielkość liter bez
            znaczenia, polskie znaki muszą się zgadzać).
          </p>
          {stage.kind === "editing" && stage.error && <p className="error">{stage.error}</p>}
          <button onClick={handleCheck} disabled={stage.kind === "checking"}>
            {stage.kind === "checking" ? "Sprawdzam..." : "Sprawdź"}
          </button>
        </>
      )}

      {(stage.kind === "reviewing" || stage.kind === "saving") && (
        <AttendanceReview
          result={stage.result}
          monthLabel={selected.label}
          saving={stage.kind === "saving"}
          error={stage.kind === "reviewing" ? stage.error : null}
          onSave={() => handleSave(stage.result)}
          onBack={() => setStage({ kind: "editing", error: null })}
        />
      )}

      {stage.kind === "saved" && (
        <>
          <p>
            Zapisano {stage.count} wpisów za {selected.label}.
          </p>
          <button className="secondary" onClick={() => setStage({ kind: "editing", error: null })}>
            Wklej kolejną listę
          </button>
        </>
      )}
    </div>
  );
}

function AttendanceReview({
  result,
  monthLabel,
  saving,
  error,
  onSave,
  onBack,
}: {
  result: AttendanceParseResult;
  monthLabel: string;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onBack: () => void;
}) {
  const nothing = result.entries.length === 0;
  return (
    <>
      <ul className="summary-list">
        <li>Miesiąc: {monthLabel}</li>
        <li>Rozpoznane wpisy: {result.entries.length}</li>
        <li>Rozpoznane osoby: {result.recognized.length}</li>
        <li>Dane do dnia: {result.lastDay ?? "—"}</li>
        {result.duplicates > 0 && <li>Powtórzone wpisy (liczone raz): {result.duplicates}</li>}
      </ul>

      {result.recognized.length > 0 && (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Imię i nazwisko</th>
              <th>Sortujący</th>
              <th>Dni</th>
            </tr>
          </thead>
          <tbody>
            {result.recognized.map((r) => (
              <tr key={r.sorterId}>
                <td>{r.fullName}</td>
                <td>{r.name}</td>
                <td>{r.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {result.unknown.length > 0 && (
        <div className="warning">
          <p>
            Nie rozpoznano (nikt na ekranie Sortujący nie ma takiego imienia i nazwiska) — te wpisy nie
            zostaną zapisane. Uzupełnij „Imię i nazwisko” i wklej ponownie:
          </p>
          <p className="mono">{result.unknown.map((u) => `${u.fullName} (${u.count})`).join(", ")}</p>
        </div>
      )}

      {result.ambiguous.length > 0 && (
        <div className="warning">
          <p>To samo imię i nazwisko ma kilku sortujących — wpisy pominięte:</p>
          <p className="mono">{result.ambiguous.map((a) => `${a.fullName} (${a.count})`).join(", ")}</p>
        </div>
      )}

      {result.invalid.length > 0 && (
        <div className="warning">
          <p>Błędne wpisy (brak „_dzień” albo dzień spoza miesiąca) — pominięte:</p>
          <p className="mono">{result.invalid.slice(0, 30).join(", ")}{result.invalid.length > 30 ? ", …" : ""}</p>
        </div>
      )}

      <p className="hint">Zapis CAŁKOWICIE zastąpi dotychczasową listę obecności za {monthLabel}.</p>
      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button className="secondary" onClick={onBack} disabled={saving}>
          Wróć
        </button>
        <button onClick={onSave} disabled={saving || nothing}>
          {saving ? "Zapisuję..." : "Zapisz"}
        </button>
      </div>
    </>
  );
}
