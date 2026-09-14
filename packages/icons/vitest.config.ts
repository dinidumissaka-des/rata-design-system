import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Same reason as @rata/react's: what is worth testing about Icon is the
    // `label` switch between `role="img"` and `aria-hidden`, and that is an
    // accessibility-tree question, not a markup one.
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.tsx"],
  },
  esbuild: { jsx: "automatic" },
});
