import * as Sentry from "@sentry/react";

// Jedyny plik po stronie klienta, ktory wola Sentry.init -- reszta kodu
// zglasza bledy wylacznie przez modules/monitoring/reportError.ts (nikt
// inny nie importuje @sentry/react bezposrednio, tak jak nikt poza
// repository/* nie importuje lib/supabaseClient.ts).
//
// DSN NIE jest sekretem w stylu SUPABASE_SERVICE_ROLE_KEY -- Sentry z
// zalozenia projektuje DSN jako bezpieczny do ujawnienia w bundlu
// klienckim (pozwala tylko wysylac zdarzenia, nie czytac danych).
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // brak DSN (np. lokalny dev bez konta Sentry) -- monitoring wylaczony, apka dziala normalnie

  Sentry.init({
    dsn,
    environment: import.meta.env.PROD ? "production" : "development",
    release: __APP_RELEASE__,
    // Obrona w glab -- gdyby ktos kiedys pomylkowo przekazal do reportError
    // surowy obiekt z danymi Shipment/Profile, usun najbardziej oczywiste
    // pola zanim event opusci przegladarke. Docelowo reportError w ogole
    // nie powinien dostawac takich danych (patrz jego komentarz).
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) delete event.request.headers.authorization;
      }
      if (event.extra) {
        for (const key of Object.keys(event.extra)) {
          if (/password|shipmentId|username|address|token|login/i.test(key)) {
            delete event.extra[key];
          }
        }
      }
      return event;
    },
  });
}
