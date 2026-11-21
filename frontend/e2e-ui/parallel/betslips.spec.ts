import { chooseCompetition, expect, signIn, test } from '../fixtures';

test.describe('bet slips', () => {
  test(
    'a member enters a bet slip, sees it, and the budget goes down',
    { tag: ['@smoke', '@betslips'] },
    async ({ page, data }) => {
      const member = await data.createUser();
      const competition = await data.createCompetition({ budgetPence: 50_000, entrants: [member] });
      await chooseCompetition(page, competition);
      await signIn(page, member);

      await page.goto('/dashboard/bets/new');
      await expect(page.getByRole('heading', { name: 'Add a bet' })).toBeVisible();
      await page.getByRole('textbox', { name: 'Time' }).fill('3:30');
      await page.getByRole('textbox', { name: 'Horse' }).fill('Synthetic Sprinter');
      await page.getByRole('textbox', { name: 'Stake per bet' }).fill('12.50');
      await page.getByRole('button', { name: 'Save bet' }).click();

      await expect(page.getByText('Saved: £12.50 Single for £12.50')).toBeVisible();

      await page.goto('/dashboard/bets');
      const slip = page.getByRole('row', { name: /Synthetic Sprinter/ });
      await expect(slip).toBeVisible();
      await expect(slip).toContainText(member.displayName);
      await expect(slip).toContainText('£12.50');

      await page.goto('/dashboard');
      await expect(page.getByText('£12.50 of £500.00 staked')).toBeVisible();
      await expect(page.getByRole('heading', { name: '£487.50' })).toBeVisible();
    }
  );
});
