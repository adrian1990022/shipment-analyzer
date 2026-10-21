import { useEffect } from "react";

// Blokada automatycznej aktualizacji na czas importu (2026-10-21, decyzja
// Adriana): dopoki import jest w toku (analiza -> podsumowanie -> zapis),
// registerServiceWorker NIE sprawdza nowego wydania -- przeladowanie nie
// skasuje przeanalizowanego importu ani nie przerwie zapisu. Odlozone
// sprawdzenie wykonuje sie zaraz po zakonczeniu ostatniego importu.
// Blokujemy SPRAWDZANIE, nie samo przeladowanie: nowy SW przejmujacy stara
// strone bez przeladowania psulby doladowywane pliki (np. xlsx).

let blockers = 0;
let deferredCheck: (() => void) | null = null;

export function isUpdateBlocked(): boolean {
  return blockers > 0;
}

// Zapamietuje sprawdzenie do wykonania po zdjeciu ostatniej blokady.
export function deferUntilUnblocked(check: () => void): void {
  deferredCheck = check;
}

// Zaklada blokade; zwraca funkcje, ktora ja zdejmuje (bezpieczna do
// wielokrotnego wywolania).
export function blockUpdates(): () => void {
  blockers += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    blockers -= 1;
    if (blockers === 0 && deferredCheck) {
      const check = deferredCheck;
      deferredCheck = null;
      check();
    }
  };
}

// Dla komponentow importu: blokada, dopoki active === true.
export function useBlockUpdatesWhile(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return blockUpdates();
  }, [active]);
}
