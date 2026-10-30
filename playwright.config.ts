import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 1,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3200",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // `next start` serves the compiled production bundle (fast, no hydration
    // races). Mock mode is normally refused in production builds, so E2E opts
    // in explicitly via CAISSE212_ALLOW_MOCK_IN_PROD.
    command: "CAISSE212_ALLOW_MOCK_IN_PROD=true npm run start -- -p 3200",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
