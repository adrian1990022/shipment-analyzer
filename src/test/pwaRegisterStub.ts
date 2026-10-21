// Atrapa modulu "virtual:pwa-register" dla testow (alias w vitest.config.ts)
// -- prawdziwy modul generuje vite-plugin-pwa tylko w buildzie aplikacji.
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
