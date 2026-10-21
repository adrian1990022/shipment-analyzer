import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Krotki SHA commita builda -- identyfikator wydania widoczny w stopce
// (AppVersion) i release w Sentry (grupuje zdarzenia per-deploy). Na Vercelu
// z VERCEL_GIT_COMMIT_SHA (zmienna systemowa builda), lokalnie z gita;
// "unknown" poza repo zamiast wywalania builda.
function commitShortSha(): string {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha) return vercelSha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

// Wersja aplikacji -- jedno zrodlo: "version" w package.json.
const appVersion: string = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

export default defineConfig({
  define: {
    __APP_RELEASE__: JSON.stringify(commitShortSha()),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    VitePWA({
      // autoUpdate (2026-10-21): nowy Service Worker przejmuje strone od
      // razu (skipWaiting + clientsClaim), a registerSW przeladowuje ja po
      // jego aktywacji. Rejestracja wylacznie w src/lib/registerServiceWorker.ts
      // (injectRegister: false -- bez drugiego, wstrzykiwanego registerSW.js).
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Shipment Analyzer",
        short_name: "Shipment",
        description: "Codzienna analiza błędów sortowania przesyłek",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        // JAWNIE (2026-10-21): plugin dopisuje je sam tylko przy
        // wstrzykiwanej rejestracji -- z injectRegister: false nowy SW
        // czekalby w nieskonczonosc i autoUpdate nigdy nie przeladowalby
        // strony (zlapane testem w prawdziwym Chrome).
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
    }),
  ],
});
