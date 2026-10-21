/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

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

// Wstrzykiwane przez vite.config.ts (define) w czasie builda:
// __APP_RELEASE__ -- krotki SHA commita (Vercel albo git), release w Sentry
// i identyfikator wydania w stopce; __APP_VERSION__ -- "version" z package.json.
declare const __APP_RELEASE__: string;
declare const __APP_VERSION__: string;
