import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

async function createSession(browser: Browser, hostName: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByPlaceholder('Your display name (host)').fill(hostName);
  await page.getByRole('button', { name: 'Create Game' }).click();
  const code = await page.locator('p.font-mono').first().textContent();
  // wait for lobby
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

test.describe('Waiting lobby — host controls', () => {
  test('host sees Start Game button and config fields', async ({ browser }) => {
    const { ctx, page } = await createSession(browser, 'Alice');

    await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible();
    await expect(page.getByLabel(/starting stack/i)).toBeVisible();
    await expect(page.getByLabel(/small blind/i)).toBeVisible();
    await expect(page.getByLabel(/big blind/i)).toBeVisible();

    await ctx.close();
  });

  test('non-host player sees waiting message instead of Start Game', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: playerCtx, page: playerPage } = await joinSession(browser, code, 'Bob');

    await expect(playerPage.getByText(/waiting for host/i)).toBeVisible();
    await expect(playerPage.getByRole('button', { name: 'Start Game' })).not.toBeVisible();

    await hostCtx.close();
    await playerCtx.close();
  });
});

test.describe('Waiting lobby — Start Game validation', () => {
  test('Start Game button is disabled with only 1 player', async ({ browser }) => {
    const { ctx, page } = await createSession(browser, 'Alice');

    await expect(page.getByRole('button', { name: 'Start Game' })).toBeDisabled();

    await ctx.close();
  });

  test('Start Game button is enabled once a second player joins', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: playerCtx } = await joinSession(browser, code, 'Bob');

    await expect(hostPage.getByRole('button', { name: 'Start Game' })).toBeEnabled();

    await hostCtx.close();
    await playerCtx.close();
  });
});

test.describe('Waiting lobby — game start', () => {
  test('host starts game and all clients transition to active phase', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: playerCtx, page: playerPage } = await joinSession(browser, code, 'Bob');

    await hostPage.getByLabel(/starting stack/i).fill('1000');
    await hostPage.getByLabel(/small blind/i).fill('10');
    await hostPage.getByLabel(/big blind/i).fill('20');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();

    // Both clients should leave the lobby — game screen should appear with chip counts
    await expect(hostPage.getByText(/waiting for host/i)).not.toBeVisible();
    await expect(playerPage.getByText(/waiting for host/i)).not.toBeVisible();
    await expect(hostPage.getByText('1000').first()).toBeVisible();
    await expect(playerPage.getByText('1000').first()).toBeVisible();

    await hostCtx.close();
    await playerCtx.close();
  });

  test('joining after game starts shows an error', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: playerCtx } = await joinSession(browser, code, 'Bob');

    await hostPage.getByLabel(/starting stack/i).fill('1000');
    await hostPage.getByLabel(/small blind/i).fill('10');
    await hostPage.getByLabel(/big blind/i).fill('20');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();
    // Wait for game to start
    await expect(hostPage.getByText('1000').first()).toBeVisible();

    // Late joiner — navigate manually, don't use the helper (it waits for lobby)
    const lateCtx = await browser.newContext();
    const latePage = await lateCtx.newPage();
    await latePage.goto('/');
    await latePage.getByRole('button', { name: 'Join Game' }).click();
    await latePage.getByPlaceholder('Session code').fill(code);
    await latePage.getByPlaceholder('Your display name').fill('Carol');
    await latePage.getByRole('button', { name: 'Join' }).click();

    await expect(latePage.getByText(/not accepting new players/i)).toBeVisible();

    await hostCtx.close();
    await playerCtx.close();
    await lateCtx.close();
  });
});

test.describe('Waiting lobby — player reorder', () => {
  test('host moves a player up and order updates for all clients', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: playerCtx, page: playerPage } = await joinSession(browser, code, 'Bob');

    // Bob is second — host moves him up, Alice should become second
    await hostPage.getByTestId('move-up-Bob').click();

    // Both pages should now show Bob before Alice in the list
    const hostNames = await hostPage.locator('[data-testid^="player-row"]').allTextContents();
    expect(hostNames[0]).toContain('Bob');
    expect(hostNames[1]).toContain('Alice');

    const playerNames = await playerPage.locator('[data-testid^="player-row"]').allTextContents();
    expect(playerNames[0]).toContain('Bob');
    expect(playerNames[1]).toContain('Alice');

    await hostCtx.close();
    await playerCtx.close();
  });
});
