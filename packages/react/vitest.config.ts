import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom, because everything worth testing here needs a real DOM: the
    // roving focus that arrow keys move, the `indeterminate` property that has
    // no HTML attribute, and the click guards that keep a disabled control
    // focusable. None of that is observable by rendering to a string, which is
    // how these components were verified before this config existed.
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.tsx"],
  },
  esbuild: { jsx: "automatic" },
});
