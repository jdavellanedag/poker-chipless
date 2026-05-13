import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

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

async function startGame(hostPage: Page, stack = '1000', sb = '10', bb = '20') {
  await hostPage.getByLabel(/starting stack/i).fill(stack);
  await hostPage.getByLabel(/small blind/i).fill(sb);
  await hostPage.getByLabel(/big blind/i).fill(bb);
  await hostPage.getByRole('button', { name: 'Start Game' }).click();
  await expect(hostPage.getByTestId('pot')).toBeVisible();
}

async function captureSessionStorage(page: Page) {
  return {
    code: await page.evaluate(() => sessionStorage.getItem('session_code')),
    token: await page.evaluate(() => sessionStorage.getItem('session_token')),
    name: await page.evaluate(() => sessionStorage.getItem('display_name')),
    playerId: await page.evaluate(() => sessionStorage.getItem('player_id')),
  };
}

async function newContextWithStorage(
  browser: Browser,
  storage: { code: string | null; token: string | null; name: string | null; playerId: string | null },
) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(({ code, token, name, playerId }) => {
    if (code) sessionStorage.setItem('session_code', code);
    if (token) sessionStorage.setItem('session_token', token);
    if (name) sessionStorage.setItem('display_name', name);
    if (playerId) sessionStorage.setItem('player_id', playerId);
  }, storage);
  return { ctx, page };
}

test.describe('Reconnection & Disconnect Handling', () => {
  test('host disconnect during active game shows "Waiting for host to reconnect…" banner to players', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: playerCtx, page: playerPage } = await joinSession(browser, code, 'Bob');
    await startGame(hostPage);

    await hostCtx.close();

    await expect(playerPage.getByTestId('pause-banner')).toHaveText('Waiting for host to reconnect…');

    await playerCtx.close();
  });

  test('host reconnect removes banner and restores game phase', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: playerCtx, page: playerPage } = await joinSession(browser, code, 'Bob');
    await startGame(hostPage);

    const hostStorage = await captureSessionStorage(hostPage);
    await hostCtx.close();

    await expect(playerPage.getByTestId('pause-banner')).toHaveText('Waiting for host to reconnect…');

    // Host reconnects from a new browser context using the same session token
    const { ctx: newHostCtx, page: newHostPage } = await newContextWithStorage(browser, hostStorage);
    await newHostPage.goto('/');
    await expect(newHostPage.getByTestId('pot')).toBeVisible();

    await expect(playerPage.getByTestId('pause-banner')).not.toBeVisible();

    await newHostCtx.close();
    await playerCtx.close();
  });

  test('non-host player who reloads is restored to their seat in an active game', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: playerCtx, page: playerPage } = await joinSession(browser, code, 'Bob');
    await startGame(hostPage);

    const bobStorage = await captureSessionStorage(playerPage);
    await playerCtx.close();

    // Bob reconnects in a new context (simulates browser reload)
    const { ctx: newBobCtx, page: newBobPage } = await newContextWithStorage(browser, bobStorage);
    await newBobPage.goto('/');

    // Bob should land directly in the active game, not the home screen
    await expect(newBobPage.getByTestId('pot')).toBeVisible();
    await expect(newBobPage.getByTestId('pot')).toHaveText('30');

    await hostCtx.close();
    await newBobCtx.close();
  });

  test('disconnected non-host player is auto-folded when it becomes their turn', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx, page: _bobPage } = await joinSession(browser, code, 'Bob');
    await startGame(hostPage);

    // Disconnect Bob before it becomes his turn
    await bobCtx.close();

    // Alice (host/SB in heads-up) calls the BB to pass the turn to Bob
    await expect(hostPage.getByTestId('action-buttons')).toBeVisible();
    await hostPage.getByTestId('btn-call').click();

    // Wait for the auto-fold timer (server DISCONNECT_TIMEOUT_MS=2000 in test mode + buffer)
    await hostPage.waitForTimeout(3500);

    const logText = await hostPage.getByTestId('action-log').textContent();
    expect(logText).toContain('auto-folded (disconnected)');
  }, { timeout: 15000 });
});
