import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/parity',
  fullyParallel: true,
  workers: 4,
  use: { baseURL: 'http://127.0.0.1:4204', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm --filter @kbar-lit/parity-harness preview',
    url: 'http://127.0.0.1:4204',
    reuseExistingServer: false,
  },
});
