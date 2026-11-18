import { chooseCompetition, expect, signIn, test } from '../fixtures';

test.describe('standings and stats', () => {
  test(
    'the leaderboard and stats show the selected competition',
    { tag: ['@smoke', '@standings'] },
    async ({ page, data }) => {
      const member = await data.createUser();
      const rival = await data.createUser();
      const shown = await data.createCompetition({ entrants: [member, rival] });
      const other = await data.createCompetition({ entrants: [member] });
      await data.addSlip(member, shown, { day: shown.days[0], horse: 'Paper Favourite', stakePence: 2000 });
      await data.addSlip(rival, shown, { day: shown.days[0], horse: 'Paper Outsider', stakePence: 500 });
      await data.addSlip(member, other, { day: other.days[0], horse: 'Elsewhere Runner', stakePence: 700 });
      await chooseCompetition(page, shown);
      await signIn(page, member);

      await page.goto('/dashboard/leaderboard');
      await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Competition' })).toHaveText(shown.name);
      await expect(page.getByRole('row', { name: new RegExp(member.displayName) })).toContainText('£20.00');
      await expect(page.getByRole('row', { name: new RegExp(rival.displayName) })).toContainText('£5.00');
      await expect(page.getByText('Staked by everyone').locator('..')).toContainText('£25.00');

      await page.getByRole('link', { name: 'Stats' }).click();
      await expect(page.getByRole('heading', { name: 'Stats', exact: true })).toBeVisible();
      await expect(page.getByText('Biggest single stake').locator('..')).toContainText(member.displayName);
      await expect(page.getByText('Biggest single stake').locator('..')).toContainText('£20.00');

      // Switching competition switches what the pages show.
      await page.getByRole('combobox', { name: 'Competition' }).click();
      await page.getByRole('option', { name: other.name }).click();
      await page.getByRole('link', { name: 'Leaderboard' }).click();
      await expect(page.getByText('Staked by everyone').locator('..')).toContainText('£7.00');
      await expect(page.getByRole('row', { name: new RegExp(rival.displayName) })).toHaveCount(0);
    }
  );
});
