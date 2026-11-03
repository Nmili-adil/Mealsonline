import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    conditions: ["react-server", "node", "import", "module", "default"],
    alias: {
      // In the Node test environment there is no React Server Components
      // runtime; resolve the marker package to its no-op build.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: "file:./test.db",
      CAISSE212_MODE: "mock",
      CAISSE212_STOREFRONT_MODE: "fixtures",
      CAISSE212_STOREFRONT_SLUG: "mealsonline",
      CAISSE212_STOREFRONT_ORDERING_ENABLED: "true",
      AUTH_SECRET: "test-secret",
      CAISSE212_WEBHOOK_SECRET: "test-webhook-secret",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
  },
});
