import {
  defineConfig,
  devices,
} from '@playwright/test';

export default defineConfig({
  testDir: './e2e/issue-141',

  testMatch:
    /tc102-pickup-visibility\.spec\.ts/,

  fullyParallel: false,
  workers: 1,
  retries: 0,

  timeout: 30_000,

  expect: {
    timeout: 10_000,
  },

  outputDir:
    'test-results/issue-141-tc102-artifacts',

  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder:
          'playwright-report/issue-141-tc102',
        open: 'never',
      },
    ],
  ],

  use: {
    baseURL: 'http://127.0.0.1:4173',

    viewport: {
      width: 1440,
      height: 1000,
    },

    colorScheme: 'light',

    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',

      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  webServer: {
    command:
      'npm run dev -- --host 127.0.0.1 --port 4173',

    url: 'http://127.0.0.1:4173',

    reuseExistingServer: false,

    timeout: 120_000,

    env: {
      VITE_USE_MOCKS: 'false',
      VITE_API_BASE_URL: '/api/v1',
    },
  },
});
