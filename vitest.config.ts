import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Osobny config od vite.config.ts (nie mieszamy z vite-plugin-pwa) --
// testy uruchamiane sa przez "vitest", nie "vite".
export default defineConfig({
  // Moduly wirtualne vite-plugin-pwa nie istnieja bez pluginu -- w testach
  // zastepcza atrapa (i tak mockowana w registerServiceWorker.test.ts).
  resolve: {
    alias: {
      "virtual:pwa-register": fileURLToPath(new URL("./src/test/pwaRegisterStub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Tylko logika biznesowa -- komponenty .tsx (UI) i App.tsx sa
      // celowo wylaczone z pokrycia. Spec: "min. 90% logiki biznesowej",
      // nie UI.
      include: [
        "src/modules/parser/**",
        "src/modules/normalizer/**",
        "src/modules/joiner/**",
        "src/modules/dateFilter/**",
        "src/modules/dedup/**",
        "src/modules/mapper/**",
        "src/modules/analyzer/**",
        "src/modules/dashboard/grouping.ts",
        "src/modules/dashboard/parseWeightDimension.ts",
        "src/modules/repository/**",
        "src/modules/backup/**",
        "src/modules/import/pipeline.ts",
        "src/modules/import/analyzeImport.ts",
        "src/modules/import/importPayload.ts",
        "src/modules/routeBase/parseRouteBase.ts",
        "src/lib/registerServiceWorker.ts",
        "src/lib/appVersion.ts",
        "src/lib/updateGuard.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.tsx"],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
        "src/modules/parser/**": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        "src/modules/mapper/**": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        "src/modules/joiner/**": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        "src/modules/dateFilter/**": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
