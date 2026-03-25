import { defineConfig, devices } from "@playwright/test";

// E2E tests that call the API (e.g. login) need the backend on http://localhost:4000.
// Start it with: cd backend && npm run dev
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    // Use IPv6 loopback to avoid machines where 127.0.0.1:8080 is a different service.
    baseURL: "http://[::1]:8080",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        // Work around rare Windows Firefox session-restore crash on context close.
        firefoxUserPrefs: {
          "browser.sessionstore.resume_from_crash": false,
          "browser.sessionstore.restore_on_demand": false,
        },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://[::1]:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
