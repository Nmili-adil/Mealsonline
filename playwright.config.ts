import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
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
    // `next start` serves the compiled production bundle. Two explicit
    // test-only opt-ins: the POS mock and the storefront fixtures are refused
    // in production unless stated.
    command:
      "CAISSE212_ALLOW_MOCK_IN_PROD=true CAISSE212_ALLOW_STOREFRONT_FIXTURES_IN_PROD=true npm run start -- -p 3200",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
