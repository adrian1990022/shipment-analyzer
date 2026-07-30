import * as Sentry from "@sentry/react";

export interface ErrorContext {
  // Nazwa modulu zglaszajacego (np. "shipmentsRepository", "import", "react").
  module: string;
  // Etap pipeline'u/operacji (np. "Parser", "Join", "Date Filter", "Mapper",
  // "fetchShipments", "render") -- opcjonalny, bo nie kazdy modul ma etapy.
  stage?: string;
}

// Jedyna funkcja w calej apce (poza src/lib/sentry.ts), ktora wola
// Sentry.* bezposrednio. Reszta kodu zglasza bledy WYLACZNIE przez nia.
//
// NIGDY nie przekazuj tu surowych obiektow domenowych (Shipment, Profile,
// User) ani ich pol -- tylko {module, stage} jako kontekst techniczny.
// Sentry.captureException zapisuje tresc bledu (message/stack), wiec
// komunikaty bledow tez nie moga zawierac Shipment ID / danych odbiorcy /
// loginow / hasel (patrz tez beforeSend w lib/sentry.ts jako dodatkowa
// obrona).
export function reportError(error: unknown, context: ErrorContext): void {
  Sentry.captureException(error, {
    tags: {
      module: context.module,
      stage: context.stage ?? "unknown",
    },
  });
}
