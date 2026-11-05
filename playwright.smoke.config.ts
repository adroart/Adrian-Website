import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Deliberately separate from the development suite: no flag mutation, no Vite
// source imports in the browser, and never reuse a potentially stale dev server.
export default defineConfig(base, {
  testMatch: ['production.smoke.ts', 'purchase-inquiry.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  metadata: { localOnly: true },
  globalTimeout: 180_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5566',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 5566 --strictPort',
    url: 'http://127.0.0.1:5566',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
