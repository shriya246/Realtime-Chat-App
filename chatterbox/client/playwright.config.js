/**
 * Purpose: Optional local Playwright E2E configuration for ChatterBox.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
