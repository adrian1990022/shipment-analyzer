import { registerSW } from "virtual:pwa-register";
import { reportError } from "../modules/monitoring/reportError";

// Co ile sprawdzac, czy jest nowe wydanie, gdy aplikacja jest dlugo otwarta.
export const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Jedyne miejsce rejestracji Service Workera (2026-10-21). Tryb autoUpdate
// (vite.config.ts): nowy SW przejmuje strone od razu, a registerSW
// PRZELADOWUJE ja po jego aktywacji -- uzytkownik dostaje nowe wydanie bez
// recznego odswiezania. Przegladarka sama sprawdza SW tylko przy nawigacji,
// a ta aplikacja to jedna strona -- dlatego sprawdzamy tez:
//   - co UPDATE_CHECK_INTERVAL_MS (aplikacja otwarta caly dzien),
//   - po powrocie do karty/aplikacji (telefon wybudzony, PWA z tla).
// Bez sieci nie sprawdzamy (unikamy bledow; offline dziala jak dotad).
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      const checkForUpdate = async () => {
        if (registration.installing || !navigator.onLine) return;
        try {
          // Najpierw sam plik SW bez pamieci podrecznej -- przy braku sieci
          // albo bledzie serwera nie wolamy update() (rzucalby wyjatek).
          const response = await fetch(swUrl, { cache: "no-store", headers: { "cache-control": "no-cache" } });
          if (response.status === 200) await registration.update();
        } catch {
          // chwilowy brak sieci -- sprobujemy przy kolejnym sprawdzeniu
        }
      };

      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
    },
    onRegisterError(error) {
      reportError(error, { module: "serviceWorker", stage: "register" });
    },
  });
}
