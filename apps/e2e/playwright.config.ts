import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Real-time socket sessions are stateful — don't parallelize between files
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Starts the production server before tests run.
  // Requires a prior `npm run build` — run `npm run test:e2e` from the repo root
  // which handles the build step automatically.
  webServer: {
    command: 'node ../server/dist/index.js',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
