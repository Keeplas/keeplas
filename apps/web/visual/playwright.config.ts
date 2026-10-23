import { defineConfig, devices } from "@playwright/test";

/**
 * Visual regression of the v2 web screens (phase 7). Each light screen is
 * pixel-diffed against its Figma PNG; dark screens, which Figma does not draw
 * (D10), against a committed baseline in ./baselines. See screens.spec.ts.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: "./test-results",
  snapshotPathTemplate: "{testDir}/baselines/{arg}{ext}",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "./report" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3100",
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "Europe/Paris",
    // Keeps the animated illustrations (<Illustration>) still between runs.
    reducedMotion: "reduce",
  },
  webServer: {
    command: "vite --config visual/vite.config.ts",
    cwd: "..",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
  },
});
