import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

// Playwright E2E tests MUST use DATABASE_URL_TEST.
// The standalone server is started with DATABASE_URL overridden to DATABASE_URL_TEST.
const testDbUrl = process.env.DATABASE_URL_TEST
if (!testDbUrl) {
  throw new Error(
    '❌ DATABASE_URL_TEST is not set. E2E tests refuse to run without a dedicated test database.\n' +
    '   Set DATABASE_URL_TEST in your .env or shell before running tests.'
  )
}
if (process.env.DATABASE_URL) {
  try {
    const mainUrl = new URL(process.env.DATABASE_URL);
    const testUrl = new URL(testDbUrl);
    if (mainUrl.host === testUrl.host && mainUrl.pathname === testUrl.pathname && mainUrl.username === testUrl.username) {
      throw new Error('❌ DATABASE_URL_TEST must point to a different database or host or project-ref than DATABASE_URL.');
    }
  } catch (e: any) {
    throw new Error('❌ Invalid Database URLs provided: ' + e.message);
  }
}

export default defineConfig({
  timeout: 120000,
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: testDbUrl,
      NODE_ENV: 'test',
    },
  },
});
