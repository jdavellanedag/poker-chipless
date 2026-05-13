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
  test('Start Game immediately deals first hand — pot shows blinds without clicking New Hand', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: playerCtx, page: playerPage } = await joinSession(browser, code, 'Bob');

    await hostPage.getByLabel(/starting stack/i).fill('1000');
    await hostPage.getByLabel(/small blind/i).fill('10');
    await hostPage.getByLabel(/big blind/i).fill('20');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();

    // Blinds must be posted immediately — no New Hand click needed
    await expect(hostPage.getByTestId('pot')).toHaveText('30');
    await expect(playerPage.getByTestId('pot')).toHaveText('30');

    await hostCtx.close();
    await playerCtx.close();
  });

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

  test('Start Game auto-posts blinds; clicking New Hand advances to the second hand', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: playerCtx, page: playerPage } = await joinSession(browser, code, 'Bob');

    // Alice = host = player[0], Bob = player[1]
    // First hand (auto-dealt on Start Game): heads-up → Alice = button/SB (posts 10), Bob = BB (posts 20)
    await hostPage.getByLabel(/starting stack/i).fill('1000');
    await hostPage.getByLabel(/small blind/i).fill('10');
    await hostPage.getByLabel(/big blind/i).fill('20');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();

    // First hand blinds posted automatically — no New Hand click needed
    await expect(hostPage.getByTestId('pot')).toHaveText('30');
    await expect(hostPage.getByTestId('chips-Alice')).toHaveText('990'); // Alice posted SB
    await expect(hostPage.getByTestId('chips-Bob')).toHaveText('980');   // Bob posted BB

    // Host clicks New Hand → second hand: button advances to Bob (SB), Alice becomes BB
    await hostPage.getByTestId('new-hand-btn').click();

    await expect(hostPage.getByTestId('pot')).toHaveText('30');
    await expect(playerPage.getByTestId('pot')).toHaveText('30');

    // Second hand: Bob posted SB (10) from 980 → 970; Alice posted BB (20) from 990 → 970
    await expect(hostPage.getByTestId('chips-Alice')).toHaveText('970');
    await expect(playerPage.getByTestId('chips-Alice')).toHaveText('970');
    await expect(hostPage.getByTestId('chips-Bob')).toHaveText('970');
    await expect(playerPage.getByTestId('chips-Bob')).toHaveText('970');

    await hostCtx.close();
    await playerCtx.close();
  });
});
