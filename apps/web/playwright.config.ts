import { defineConfig, devices } from '@playwright/test';

import { loadWebEnv } from './src/lib/env';

const { APP_ORIGIN } = loadWebEnv();

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/support/global-setup',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 4,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['./e2e/support/execution-ledger-reporter.ts']]
    : [['list'], ['html', { open: 'never' }], ['./e2e/support/execution-ledger-reporter.ts']],
  use: {
    baseURL: APP_ORIGIN,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  ...(process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          url: APP_ORIGIN,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
