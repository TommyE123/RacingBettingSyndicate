// Shared fixtures for the UI end-to-end suite. Every test sets up its own data through the
// admin API (synthetic users and competitions with unique names), so tests never depend on
// each other or on what an earlier run left behind.
import { randomBytes, randomUUID } from 'node:crypto';

import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

export { expect } from '@playwright/test';

export interface TestUser {
  id: number;
  username: string;
  displayName: string;
  password: string;
  role: 'admin' | 'member';
}

export interface TestDay {
  id: number;
  date: string;
  label: string | null;
}

export interface TestCompetition {
  id: number;
  name: string;
  budgetPence: number;
  days: TestDay[];
}

export interface CompetitionOptions {
  budgetPence?: number;
  // Labels of the days to add, one day apart from today. Defaults to one day.
  days?: string[];
  entrants?: TestUser[];
}

export interface SlipOptions {
  day: TestDay;
  horse: string;
  stakePence: number;
  raceTime?: string;
}

export interface TestData {
  createUser: (role?: 'admin' | 'member') => Promise<TestUser>;
  createCompetition: (options?: CompetitionOptions) => Promise<TestCompetition>;
  enter: (competition: TestCompetition, user: TestUser) => Promise<void>;
  addSlip: (user: TestUser, competition: TestCompetition, slip: SlipOptions) => Promise<void>;
}

// A prefix for everything this run creates, so the teardown can find the users it made.
export function runPrefix(): string {
  const prefix = process.env.UI_E2E_RUN_ID;
  if (!prefix) {
    throw new Error('UI_E2E_RUN_ID is not set; globalSetup sets it before the tests run.');
  }
  return prefix;
}

export function adminCredentials(): { username: string; password: string } {
  const username = process.env.UI_E2E_ADMIN_USERNAME;
  const password = process.env.UI_E2E_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('UI_E2E_ADMIN_USERNAME and UI_E2E_ADMIN_PASSWORD must be set; e2e-ui/run.sh sets them.');
  }
  return { username, password };
}

// Unique, readable names: the run prefix, then random letters (usernames allow 32 characters).
export function uniqueName(kind: string): string {
  return `${runPrefix()}-${kind}-${randomBytes(4).toString('hex')}`;
}

function isoDate(daysFromToday: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

async function json<T>(response: Awaited<ReturnType<APIRequestContext['get']>>, what: string): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${what} failed: HTTP ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

export async function signInByApi(request: APIRequestContext, username: string, password: string): Promise<void> {
  const response = await request.post('/api/auth/login', { data: { username, password } });
  await json(response, `Signing in as ${username}`);
}

// Signs the page's browser context in without going through the form, which the auth tests
// cover. The page and page.request share cookies.
export async function signIn(page: Page, user: TestUser): Promise<void> {
  await signInByApi(page.request, user.username, user.password);
}

// Makes the competition picker start on this competition, as if the person had chosen it.
export async function chooseCompetition(page: Page, competition: TestCompetition): Promise<void> {
  await page.addInitScript((id) => {
    globalThis.localStorage.setItem('rbs-competition-id', String(id));
  }, competition.id);
}

export async function signInWithForm(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export const test = base.extend<{ data: TestData }, { adminApi: APIRequestContext }>({
  // One signed-in admin API session per worker, used only to set up data.
  adminApi: [
    async ({ playwright }, provide, workerInfo) => {
      const request = await playwright.request.newContext({ baseURL: workerInfo.project.use.baseURL });
      const { username, password } = adminCredentials();
      await signInByApi(request, username, password);
      await provide(request);
      await request.dispose();
    },
    { scope: 'worker' },
  ],

  // The second argument is named provide, not use, so the React hooks lint rule leaves it alone.
  data: async ({ adminApi }, provide) => {
    const enter = async (competition: TestCompetition, user: TestUser): Promise<void> => {
      const response = await adminApi.put(`/api/admin/competitions/${competition.id}/entries/${user.id}`);
      expect(response.status(), `entering ${user.username}`).toBe(204);
    };

    const data: TestData = {
      createUser: async (role = 'member') => {
        const username = uniqueName(role === 'admin' ? 'a' : 'm');
        const displayName = `Test ${role === 'admin' ? 'Admin' : 'Member'} ${username.slice(-8)}`;
        const password = randomUUID();
        const created = await json<{ id: number }>(
          await adminApi.post('/api/admin/users', {
            data: { username, display_name: displayName, password, role },
          }),
          `Creating user ${username}`
        );
        return { id: created.id, username, displayName, password, role };
      },

      createCompetition: async ({ budgetPence = 50_000, days = ['Day 1'], entrants = [] } = {}) => {
        const name = uniqueName('cup');
        const created = await json<{ id: number }>(
          await adminApi.post('/api/admin/competitions', { data: { name, budget_pence: budgetPence } }),
          `Creating competition ${name}`
        );
        const competition: TestCompetition = { id: created.id, name, budgetPence, days: [] };
        for (const [index, label] of days.entries()) {
          competition.days.push(
            await json<TestDay>(
              await adminApi.post(`/api/admin/competitions/${created.id}/days`, {
                data: { date: isoDate(index), label },
              }),
              `Adding ${label} to ${name}`
            )
          );
        }
        for (const user of entrants) {
          await enter(competition, user);
        }
        return competition;
      },

      enter,

      // Entered by the admin on the member's behalf, as admins do from paper sheets.
      addSlip: async (user, competition, { day, horse, stakePence, raceTime = '14:30' }) => {
        await json(
          await adminApi.post(`/api/competitions/${competition.id}/slips`, {
            data: {
              user_id: user.id,
              day_id: day.id,
              bet_type: 'single',
              unit_stake_pence: stakePence,
              selections: [{ day_id: day.id, race_time: raceTime, horse_name: horse }],
            },
          }),
          `Adding a slip for ${user.username}`
        );
      },
    };
    await provide(data);
  },
});
