import { useId, useRef, useState } from "react";

// Komorka tabeli edytowalna w miejscu (ekran "Sortujacy", 2026-10-12):
// dwuklik w tekst albo stukniecie w olowek -> pole tekstowe. Enter albo
// klikniecie obok zapisuje, Esc anuluje. Olowek jest dla telefonu -- na
// iPhonie podwojne stukniecie bywa przechwytywane jako powiekszenie.
export function EditableCell({
  value,
  label,
  required = false,
  maxLength,
  suggestions,
  onSave,
  onError,
}: {
  value: string;
  // Do podpowiedzi olowka, np. "nazwę sortującego".
  label: string;
  // Wymagane = pusty tekst odrzucany (pole wraca do poprzedniej wartosci).
  required?: boolean;
  maxLength?: number;
  // Podpowiedzi przy wpisywaniu (lista przegladarki), np. litery loopow.
  suggestions?: string[];
  onSave: (next: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  // Enter zapisuje, a zaraz potem pole traci fokus (onBlur) -- bez tej
  // flagi zapis poszedlby dwa razy.
  const finishing = useRef(false);
  const listId = useId();

  function start() {
    if (saving) return;
    finishing.current = false;
    setDraft(value);
    setEditing(true);
  }

  function cancel() {
    finishing.current = true;
    setEditing(false);
  }

  async function commit() {
    if (finishing.current) return;
    finishing.current = true;
    const next = draft.trim();
    if (next === value.trim()) {
      setEditing(false);
      return;
    }
    if (required && !next) {
      onError("Nazwa sortującego nie może być pusta — przywrócono poprzednią.");
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      onError("Nie udało się zapisać zmiany — przywrócono poprzednią wartość.");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <>
        <input
          className="editable-input"
          autoFocus
          list={suggestions?.length ? listId : undefined}
          value={draft}
          maxLength={maxLength}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
        />
        {suggestions?.length ? (
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        ) : null}
      </>
    );
  }

  return (
    <div className="editable-cell" onDoubleClick={start} title="Kliknij dwukrotnie, aby edytować">
      <span className={value ? undefined : "editable-empty"}>{value || "—"}</span>
      <button type="button" className="edit-pencil" onClick={start} aria-label={`Edytuj ${label}`}>
        ✎
      </button>
    </div>
  );
}
