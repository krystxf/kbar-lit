import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/examples',
  fullyParallel: true,
  workers: 4,
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @kbar-lit/example-nextjs start',
      url: 'http://127.0.0.1:4201',
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @kbar-lit/example-vue preview',
      url: 'http://127.0.0.1:4202',
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @kbar-lit/example-angular preview',
      url: 'http://127.0.0.1:4203',
      reuseExistingServer: false,
    },
  ],
});
