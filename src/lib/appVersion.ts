// Wersja aplikacji do pokazania uzytkownikowi (stopka, AppVersion) --
// z metadanych builda (vite.config.ts), nie wpisywana recznie:
//   "v0.1.0 · a1b2c3d" -- wersja z package.json · krotki SHA commita.
// Po kazdym wdrozeniu SHA sie zmienia, wiec od razu widac, czy uzytkownik
// ma oczekiwane wydanie.
export function formatAppVersion(version: string, commit: string): string {
  return `v${version} · ${commit}`;
}

export const APP_VERSION_LABEL = formatAppVersion(__APP_VERSION__, __APP_RELEASE__);
