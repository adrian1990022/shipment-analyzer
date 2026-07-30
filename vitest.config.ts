import { defineConfig } from "vitest/config";

// Osobny config od vite.config.ts (nie mieszamy z vite-plugin-pwa) --
// testy uruchamiane sa przez "vitest", nie "vite".
export default defineConfig({
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
