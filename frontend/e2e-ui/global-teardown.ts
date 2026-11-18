// Runs once after the suite: deactivates the users this run created, so an instance that
// outlives the run (one started separately and reached through UI_E2E_BASE_URL) is not left
// with test accounts that can sign in. Competitions cannot be deleted through the API, and
// their names carry the run prefix.
import { request, type FullConfig } from '@playwright/test';

import { adminCredentials, signInByApi } from './fixtures';

export default async function globalTeardown(config: FullConfig): Promise<void> {
  const prefix = process.env.UI_E2E_RUN_ID;
  if (!prefix) {
    return;
  }
  const { username, password } = adminCredentials();
  const api = await request.newContext({ baseURL: config.projects[0]?.use.baseURL });
  try {
    await signInByApi(api, username, password);
    const response = await api.get('/api/admin/users');
    if (!response.ok()) {
      throw new Error(`Listing users for cleanup failed with HTTP ${response.status()}.`);
    }
    const users = (await response.json()) as { id: number; username: string; is_active: boolean }[];
    const failed: number[] = [];
    for (const user of users.filter((item) => item.username.startsWith(`${prefix}-`) && item.is_active)) {
      const patched = await api.patch(`/api/admin/users/${user.id}`, { data: { is_active: false } });
      if (!patched.ok()) {
        failed.push(user.id);
      }
    }
    if (failed.length > 0) {
      throw new Error(`Could not deactivate test users with IDs ${failed.join(', ')}.`);
    }
  } finally {
    await api.dispose();
  }
}
