import { defineConfig, devices } from "@playwright/test";

// Playwright E2E config for ATLAS OS.
//
// The app runs fully on seed data with no database, so the webServer below just
// builds and starts the Next.js app on port 3000. Locally we reuse an already
// running dev/prod server; in CI we always boot a fresh one.
const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },

  // Cross-device coverage, kept to chromium engine so CI only needs the
  // chromium download (no extra browsers).
  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Tablet Chrome",
      use: { ...devices["Galaxy Tab S9"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],

  webServer: {
    command: "npm run build && npx next start -H 127.0.0.1 -p 3000",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
