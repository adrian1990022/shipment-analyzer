import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Release Sentry = krotki SHA commita builda -- grupuje zdarzenia
// per-deploy bez potrzeby Sentry CLI/auth tokena. "unknown" poza repo
// gita (np. niektore srodowiska CI) zamiast wywalania builda.
function gitShortSha(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  define: {
    __APP_RELEASE__: JSON.stringify(gitShortSha()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
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
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
    }),
  ],
});
