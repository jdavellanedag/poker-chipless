import { test, expect, Browser } from '@playwright/test';

async function createSession(browser: Browser, hostName: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByPlaceholder('Your display name (host)').fill(hostName);
  await page.getByRole('button', { name: 'Create Game' }).click();
  const code = await page.locator('p.font-mono').first().textContent();
  await expect(page.getByTestId(`player-row-${hostName}`)).toBeVisible();
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
  await expect(page.getByTestId(`player-row-${playerName}`)).toBeVisible();
  return { ctx, page };
}

test.describe('Action Log', () => {
  test('log panel is visible in lobby after a player joins', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx, page: bobPage } = await joinSession(browser, code, 'Bob');

    await expect(hostPage.getByTestId('action-log')).toBeVisible();
    await expect(bobPage.getByTestId('action-log')).toBeVisible();

    // Both should see join entries
    await expect(hostPage.getByTestId('action-log')).toContainText('Alice created the session');
    await expect(hostPage.getByTestId('action-log')).toContainText('Bob joined the session');

    await hostCtx.close();
    await bobCtx.close();
  });

  test('log panel shows game-start entry and blind posts after start', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx, page: bobPage } = await joinSession(browser, code, 'Bob');

    await hostPage.getByLabel(/starting stack/i).fill('1000');
    await hostPage.getByLabel(/small blind/i).fill('10');
    await hostPage.getByLabel(/big blind/i).fill('20');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();
    await expect(hostPage.getByTestId('pot')).toHaveText('30');

    const hostLog = hostPage.getByTestId('action-log');
    await expect(hostLog).toContainText('Game started. Stack: 1000, Blinds: 10/20');
    await expect(hostLog).toContainText('posts small blind');
    await expect(hostLog).toContainText('posts big blind');

    // Bob's log matches
    const bobLog = bobPage.getByTestId('action-log');
    await expect(bobLog).toContainText('Game started. Stack: 1000, Blinds: 10/20');

    await hostCtx.close();
    await bobCtx.close();
  });

  test('log panel shows timestamps in HH:MM:SS format', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx } = await joinSession(browser, code, 'Bob');

    const logPanel = hostPage.getByTestId('action-log');
    // Timestamp pattern: two digits, colon, two digits, colon, two digits
    const firstTimestamp = logPanel.locator('.font-mono').first();
    await expect(firstTimestamp).toHaveText(/^\d{2}:\d{2}:\d{2}$/);

    await hostCtx.close();
    await bobCtx.close();
  });

  test('log panel records a full game flow: call, check, advance, fold, declare winner', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx, page: bobPage } = await joinSession(browser, code, 'Bob');

    await hostPage.getByLabel(/starting stack/i).fill('1000');
    await hostPage.getByLabel(/small blind/i).fill('10');
    await hostPage.getByLabel(/big blind/i).fill('20');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();
    await expect(hostPage.getByTestId('pot')).toHaveText('30');

    // Heads-up: Alice = button/SB, acts first preflop. Alice calls.
    await hostPage.getByTestId('btn-call').click();
    // Bob (BB) checks to complete preflop
    await expect(bobPage.getByTestId('action-buttons')).toBeVisible();
    await bobPage.getByTestId('btn-check').click();
    await expect(hostPage.getByTestId('advance-round-btn')).toBeVisible();

    // Host advances to flop
    await hostPage.getByTestId('advance-round-btn').click();

    // Flop: Bob acts first (left of button in 3+ players, but heads-up: left of button = Bob).
    // Bob folds
    await expect(bobPage.getByTestId('action-buttons')).toBeVisible();
    await bobPage.getByTestId('btn-fold').click();

    // Showdown: Alice wins by fold
    await expect(hostPage.getByTestId('action-log')).toContainText('Alice calls');
    await expect(hostPage.getByTestId('action-log')).toContainText('Bob checks');
    await expect(hostPage.getByTestId('action-log')).toContainText('--- Flop ---');
    await expect(hostPage.getByTestId('action-log')).toContainText('Bob folds');
    await expect(hostPage.getByTestId('action-log')).toContainText('Alice wins');

    // Bob's log also shows all entries (full state sync)
    await expect(bobPage.getByTestId('action-log')).toContainText('Bob folds');
    await expect(bobPage.getByTestId('action-log')).toContainText('Alice wins');

    await hostCtx.close();
    await bobCtx.close();
  });
});
