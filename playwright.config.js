import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'client/tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    // iPhone 14 viewport and user agent, run in Chromium: Playwright's WebKit on Windows blocks
    // navigations before the service worker sees them when offline, so the offline test cannot run there.
    { name: 'iphone-14', use: { ...devices['iPhone 14'], browserName: 'chromium' } },
  ],
});
