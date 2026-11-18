import { expect, signInWithForm, test } from '../fixtures';

test.describe('signing in and out', () => {
  test('a member signs in and signs out', { tag: ['@smoke', '@auth'] }, async ({ page, data }) => {
    const member = await data.createUser();

    await signInWithForm(page, member.username, member.password);

    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole('button', { name: 'Account menu' }).click();
    const menu = page.getByRole('presentation').filter({ has: page.getByRole('menuitem', { name: 'Sign out' }) });
    await expect(menu).toContainText(member.displayName);
    await expect(menu).toContainText(`@${member.username}`);
    await menu.getByRole('menuitem', { name: 'Sign out' }).click();

    await expect(page).toHaveURL(/\/auth\/sign-in$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    // The session is gone, not just hidden: the dashboard sends the visitor back to sign in.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
  });

  test('a wrong password is refused', { tag: ['@smoke', '@auth'] }, async ({ page, data }) => {
    const member = await data.createUser();

    await signInWithForm(page, member.username, `${member.password}-wrong`);

    await expect(page.getByRole('alert').filter({ hasText: 'Wrong username or password' })).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
  });
});
