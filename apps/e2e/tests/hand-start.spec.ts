import { test, expect, Browser } from '@playwright/test';

async function createSession(browser: Browser, hostName: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByPlaceholder('Your display name (host)').fill(hostName);
  await page.getByRole('button', { name: 'Create Game' }).click();
  const code = await page.locator('p.font-mono').first().textContent();
  await expect(page.getByText(hostName)).toBeVisible();
  return { ctx, page, code: code! };
}

async function joinSession(browser: Browser, code: string, playerName: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Join Game' }).click();
  await page.getByPlaceholder('Session code').fill(code);
  await page.getByPlaceholder('Your display name').fill(playerName);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByText(playerName)).toBeVisible();
  return { ctx, page };
}

test.describe('Hand start — New Hand button', () => {
  test('host sees New Hand button after game starts', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: playerCtx } = await joinSession(browser, code, 'Bob');

    await hostPage.getByLabel(/starting stack/i).fill('1000');
    await hostPage.getByLabel(/small blind/i).fill('10');
    await hostPage.getByLabel(/big blind/i).fill('20');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();

    await expect(hostPage.getByTestId('new-hand-btn')).toBeVisible();

    await hostCtx.close();
    await playerCtx.close();
  });

  test('non-host does not see New Hand button', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: playerCtx, page: playerPage } = await joinSession(browser, code, 'Bob');

    await hostPage.getByLabel(/starting stack/i).fill('1000');
    await hostPage.getByLabel(/small blind/i).fill('10');
    await hostPage.getByLabel(/big blind/i).fill('20');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();
    await expect(hostPage.getByTestId('new-hand-btn')).toBeVisible();

    await expect(playerPage.getByTestId('new-hand-btn')).not.toBeVisible();

    await hostCtx.close();
    await playerCtx.close();
  });

  test('clicking New Hand posts blinds and both clients see updated chip counts', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: playerCtx, page: playerPage } = await joinSession(browser, code, 'Bob');

    // Alice = host = player[0], Bob = player[1]
    // Heads-up: Alice = button/SB (posts 10), Bob = BB (posts 20)
    await hostPage.getByLabel(/starting stack/i).fill('1000');
    await hostPage.getByLabel(/small blind/i).fill('10');
    await hostPage.getByLabel(/big blind/i).fill('20');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();
    await expect(hostPage.getByTestId('new-hand-btn')).toBeVisible();

    await hostPage.getByTestId('new-hand-btn').click();

    // Pot should be 30 (SB 10 + BB 20)
    await expect(hostPage.getByTestId('pot')).toHaveText('30');
    await expect(playerPage.getByTestId('pot')).toHaveText('30');

    // Alice posted SB: 1000 - 10 = 990
    await expect(hostPage.getByTestId('chips-Alice')).toHaveText('990');
    await expect(playerPage.getByTestId('chips-Alice')).toHaveText('990');

    // Bob posted BB: 1000 - 20 = 980
    await expect(hostPage.getByTestId('chips-Bob')).toHaveText('980');
    await expect(playerPage.getByTestId('chips-Bob')).toHaveText('980');

    await hostCtx.close();
    await playerCtx.close();
  });
});
