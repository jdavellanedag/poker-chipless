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

/**
 * Start a 2-player game where both go all-in preflop, then host declares
 * the winner. Returns with the hand in post-showdown state (phase: active,
 * pot distributed). Stack: 100 chips each, blinds 50/100 forces all-in.
 */
async function startAndGoAllIn(browser: Browser) {
  const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
  const { ctx: bobCtx, page: bobPage } = await joinSession(browser, code, 'Bob');

  // 100 chip stack with 50/100 blinds — BB is already all-in, SB must go all-in to call
  await hostPage.getByLabel(/starting stack/i).fill('100');
  await hostPage.getByLabel(/small blind/i).fill('50');
  await hostPage.getByLabel(/big blind/i).fill('100');
  await hostPage.getByRole('button', { name: 'Start Game' }).click();

  // Heads-up: Alice is dealer/SB, Bob is BB. Bob is all-in with 100 chips.
  // Alice (SB) posted 50, needs to go all-in (call remaining 50) or fold.
  // Alice goes all-in.
  await expect(hostPage.getByTestId('action-buttons')).toBeVisible();
  await hostPage.getByTestId('btn-allin').click();

  // Round complete (both all-in). Advance to showdown.
  await expect(hostPage.getByTestId('advance-round-btn')).toBeVisible();
  await hostPage.getByTestId('advance-round-btn').click(); // flop
  await expect(hostPage.getByTestId('advance-round-btn')).toBeVisible();
  await hostPage.getByTestId('advance-round-btn').click(); // turn
  await expect(hostPage.getByTestId('advance-round-btn')).toBeVisible();
  await hostPage.getByTestId('advance-round-btn').click(); // river
  await expect(hostPage.getByTestId('advance-round-btn')).toBeVisible();
  await hostPage.getByTestId('advance-round-btn').click(); // showdown

  return { hostCtx, hostPage, bobCtx, bobPage };
}

test.describe('Player elimination', () => {
  test('eliminated player row shows "Eliminated" badge after host declares winner', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx, bobPage } = await startAndGoAllIn(browser);

    // Host declares Alice as winner (Bob gets eliminated)
    await expect(hostPage.getByTestId('winner-select')).toBeVisible();
    await hostPage.getByTestId('winner-select').selectOption({ index: 0 });
    await hostPage.getByTestId('declare-winner-btn').click();

    // Bob's row should now show "Eliminated" badge
    await expect(hostPage.getByTestId('badge-eliminated-Bob')).toBeVisible();
    await expect(bobPage.getByTestId('badge-eliminated-Bob')).toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });

  test('elimination log entry appears after winner is declared', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx } = await startAndGoAllIn(browser);

    await expect(hostPage.getByTestId('winner-select')).toBeVisible();
    await hostPage.getByTestId('winner-select').selectOption({ index: 0 });
    await hostPage.getByTestId('declare-winner-btn').click();

    await expect(hostPage.getByTestId('action-log')).toContainText('Bob has been eliminated');

    await hostCtx.close();
    await bobCtx.close();
  });
});

test.describe('Rebuy', () => {
  test('host can rebuy for an eliminated player; chip count updates and log reflects it', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx } = await startAndGoAllIn(browser);

    // Alice wins, Bob is eliminated
    await hostPage.getByTestId('winner-select').selectOption({ index: 0 });
    await hostPage.getByTestId('declare-winner-btn').click();
    await expect(hostPage.getByTestId('badge-eliminated-Bob')).toBeVisible();

    // Host rebuys Bob for 500
    await hostPage.getByTestId('rebuy-player-select').selectOption({ label: 'Bob (0 chips, eliminated)' });
    await hostPage.getByTestId('rebuy-amount-input').fill('500');
    await hostPage.getByTestId('rebuy-btn').click();

    // Bob's chip count should be 500
    await expect(hostPage.getByTestId('chips-Bob')).toHaveText('500');
    // Log shows rebuy entry
    await expect(hostPage.getByTestId('action-log')).toContainText('Bob re-buys for 500 chips');
    // Eliminated badge gone
    await expect(hostPage.getByTestId('badge-eliminated-Bob')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });
});

test.describe('Game over', () => {
  test('when the last player standing clicks New Hand, game transitions to ended with "Game over — Alice wins!" log', async ({ browser }) => {
    // 2 players: Alice (host) and Bob. Stack=100, blinds=50/100.
    // Bob (BB) is all-in immediately. Alice (SB/button heads-up) goes all-in.
    // Advance to showdown → declare Alice winner → Bob eliminated.
    // New Hand → fewer than 2 active players → phase:ended.
    // Game Over screen shows "Game over — Alice wins!".
    const { hostCtx, hostPage, bobCtx, bobPage } = await startAndGoAllIn(browser);

    // Only 1 eligible winner (Alice, since we'll pick index 0)
    await expect(hostPage.getByTestId('winner-select')).toBeVisible();
    await hostPage.getByTestId('winner-select').selectOption({ index: 0 });
    await hostPage.getByTestId('declare-winner-btn').click();

    // Bob is eliminated — New Hand should end the game
    await expect(hostPage.getByTestId('new-hand-btn')).toBeVisible();
    await hostPage.getByTestId('new-hand-btn').click();

    // Both clients see Game Over screen
    await expect(hostPage.getByRole('heading', { name: 'Game Over' })).toBeVisible({ timeout: 5000 });
    await expect(bobPage.getByRole('heading', { name: 'Game Over' })).toBeVisible({ timeout: 5000 });

    // "Game over — Alice wins!" message visible on screen (surfaced from last log entry)
    await expect(hostPage.getByText('Game over — Alice wins!')).toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });
});
