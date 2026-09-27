import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: fileURLToPath(new URL("./e2e", import.meta.url)),
  outputDir: fileURLToPath(new URL("./results", import.meta.url)),
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: fileURLToPath(new URL("./report", import.meta.url)), open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4174",
    headless: true,
    locale: "zh-CN",
    colorScheme: "light",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1440, height: 1200 },
      },
    },
  ],
  webServer: {
    command: "npm run preview -- --port 4174",
    url: "http://127.0.0.1:4174/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
