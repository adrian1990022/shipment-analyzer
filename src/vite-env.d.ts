/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // Opcjonalny -- brak DSN wylacza monitoring (np. lokalny dev), apka
  // dziala normalnie. Patrz src/lib/sentry.ts.
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Wstrzykiwane przez vite.config.ts (define) z "git rev-parse --short HEAD"
// w czasie builda -- grupuje zdarzenia w Sentry per-deploy.
declare const __APP_RELEASE__: string;
