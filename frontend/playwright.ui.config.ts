// Playwright config for the UI end-to-end suite in e2e-ui/. Run it through e2e-ui/run.sh, which
// CI and the "RBS: Run UI E2E" VS Code task both use, so a CI failure reproduces locally.
import { defineConfig, devices } from '@playwright/test';

// The suite only ever targets UI_E2E_BASE_URL, never a generic variable such as BASE_URL, so a
// value left over in the environment cannot aim it at a real deployment.
const baseURL = process.env.UI_E2E_BASE_URL;
if (!baseURL) {
  throw new Error('UI_E2E_BASE_URL is not set. Run the suite with e2e-ui/run.sh, which sets it.');
}

const isCI = Boolean(process.env.CI);
const uiMode = process.env.UI_E2E_MODE === 'ui';

// Scopes are tags: "@full" (everything, the default here), "@smoke" or one area such as "@auth".
// e2e-ui/run.sh always sets it from its scope argument.
const tag = process.env.UI_E2E_TAG ?? '@full';
const grep = tag === '@full' ? undefined : new RegExp(`${tag.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}\\b`);

const browser = { ...devices['Desktop Chrome'] };

export default defineConfig({
  testDir: './e2e-ui',
  outputDir: './test-results-ui',
  globalSetup: './e2e-ui/global-setup.ts',
  globalTeardown: './e2e-ui/global-teardown.ts',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [['list'], ['github'], ['html', { open: 'never', outputFolder: './playwright-report-ui' }]]
    : [['list'], ['html', { open: 'never', outputFolder: './playwright-report-ui' }]],
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // UI mode shows every test in one list. Headless runs keep tests that change shared state in
  // "exclusive", one at a time and only after "parallel" has finished.
  projects: uiMode
    ? [{ name: 'all', testDir: './e2e-ui', grep, use: browser }]
    : [
        { name: 'parallel', testDir: './e2e-ui/parallel', grep, use: browser },
        {
          name: 'exclusive',
          testDir: './e2e-ui/exclusive',
          grep,
          use: browser,
          dependencies: ['parallel'],
          workers: 1,
        },
      ],
});
