import * as Sentry from "@sentry/node";

// Analogiczny init do src/lib/sentry.ts, ale dla Vercel Serverless
// Functions (api/*.ts) -- osobne srodowisko Node, wiec osobny pakiet
// (@sentry/node) i osobna inicjalizacja. Ta sama zmienna srodowiskowa
// VITE_SENTRY_DSN co po stronie klienta (Vercel udostepnia zmienne
// srodowiskowe zarowno buildowi Vite, jak i funkcjom serverless pod
// process.env), wiec Adrian konfiguruje jedno miejsce, nie dwa.
let initialized = false;

function ensureInit(): void {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.VITE_SENTRY_DSN;
  if (!dsn) return; // brak DSN -- monitoring wylaczony, funkcja dziala normalnie

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown",
  });
}

export interface ErrorContext {
  module: string;
  stage?: string;
}

// Jedyna funkcja w api/**, ktora wola Sentry.* bezposrednio -- taki sam
// wzorzec jak modules/monitoring/reportError.ts po stronie klienta.
// NIGDY nie przekazuj tu danych uzytkownika (login, haslo, tresc
// requestu) -- tylko {module, stage}.
export function reportError(error: unknown, context: ErrorContext): void {
  ensureInit();
  Sentry.captureException(error, {
    tags: {
      module: context.module,
      stage: context.stage ?? "unknown",
    },
  });
}
