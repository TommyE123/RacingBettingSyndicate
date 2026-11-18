import { expect, signIn, test, uniqueName } from '../fixtures';

test.describe('admin', () => {
  test(
    'an admin creates a competition, adds a day and enters a member',
    { tag: ['@smoke', '@admin'] },
    async ({ browser, page, data }, testInfo) => {
      const admin = await data.createUser('admin');
      const member = await data.createUser();
      const name = uniqueName('new-cup');
      await signIn(page, admin);

      await page.goto('/dashboard/admin/competitions');
      await page.getByRole('button', { name: 'New competition' }).click();
      const dialog = page.getByRole('dialog', { name: 'New competition' });
      await dialog.getByLabel('Name').fill(name);
      await dialog.getByLabel('Budget each').fill('250');
      await dialog.getByRole('button', { name: 'Create' }).click();

      await expect(page).toHaveURL(/\/dashboard\/admin\/competitions\/\d+$/);
      await expect(page.getByRole('main').getByRole('heading', { name })).toBeVisible();

      await page.getByLabel('Date').fill('2031-03-11');
      await page.getByLabel('Label (optional)').fill('Opening Day');
      await page.getByRole('button', { name: 'Add day' }).click();
      await expect(page.getByText('Opening Day')).toBeVisible();

      await page.getByRole('button', { name: new RegExp(member.displayName) }).click();
      await expect(page.getByText('1 entered. Tick everyone who is playing.')).toBeVisible();
      await expect(
        page.getByRole('button', { name: new RegExp(member.displayName) }).getByRole('checkbox')
      ).toBeChecked();

      // The member now sees the competition, entered, with its budget.
      const memberPage = await browser.newPage({ baseURL: testInfo.project.use.baseURL });
      await signIn(memberPage, member);
      await memberPage.goto('/dashboard');
      await expect(memberPage.getByRole('combobox', { name: 'Competition' })).toHaveText(name);
      await expect(memberPage.getByText('£0.00 of £250.00 staked')).toBeVisible();
      await memberPage.close();
    }
  );

  test('a member cannot reach the admin pages', { tag: ['@smoke', '@admin'] }, async ({ page, data }) => {
    const member = await data.createUser();
    await signIn(page, member);

    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'My account', exact: true })).toBeVisible();
    for (const link of ['Users', 'Competitions', 'Audit log']) {
      await expect(page.getByRole('link', { name: link, exact: true })).toHaveCount(0);
    }

    for (const path of ['/dashboard/admin/users', '/dashboard/admin/competitions', '/dashboard/admin/audit']) {
      await page.goto(path);
      await expect(page.getByText('Only admins can see this page.')).toBeVisible();
    }

    // The API refuses too, so hiding the pages is not the only protection.
    const response = await page.request.get('/api/admin/users');
    expect(response.status()).toBe(403);
  });
});
