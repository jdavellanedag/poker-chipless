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

async function startAndCompleteRound(browser: Browser) {
  const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
  const { ctx: bobCtx, page: bobPage } = await joinSession(browser, code, 'Bob');

  await hostPage.getByLabel(/starting stack/i).fill('1000');
  await hostPage.getByLabel(/small blind/i).fill('10');
  await hostPage.getByLabel(/big blind/i).fill('20');
  await hostPage.getByRole('button', { name: 'Start Game' }).click();
  await expect(hostPage.getByTestId('pot')).toHaveText('30');

  // Complete preflop: Alice (SB) calls → Bob (BB) checks → roundComplete
  await hostPage.getByTestId('btn-call').click();
  await expect(bobPage.getByTestId('action-buttons')).toBeVisible();
  await bobPage.getByTestId('btn-check').click();
  await expect(hostPage.getByTestId('advance-round-btn')).toBeVisible();

  return { hostCtx, hostPage, bobCtx, bobPage };
}

test.describe('Advance Round', () => {
  test('host sees Advance Round button after betting round completes', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx, bobPage } = await startAndCompleteRound(browser);

    await expect(hostPage.getByTestId('advance-round-btn')).toBeVisible();
    await expect(bobPage.getByTestId('advance-round-btn')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });

  test('host clicks Advance Round and round label changes to flop', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx, bobPage } = await startAndCompleteRound(browser);

    await hostPage.getByTestId('advance-round-btn').click();

    await expect(hostPage.getByText('flop')).toBeVisible();
    await expect(bobPage.getByText('flop')).toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });
});

async function advanceToShowdown(hostPage: import('@playwright/test').Page, bobPage: import('@playwright/test').Page) {
  // In heads-up post-flop: Bob (non-button) acts first, then Alice (button)
  for (const round of ['flop', 'turn', 'river'] as const) {
    await hostPage.getByTestId('advance-round-btn').click();
    await expect(hostPage.getByText(round)).toBeVisible(); // wait for state to settle
    await expect(bobPage.getByTestId('action-buttons')).toBeVisible();
    await bobPage.getByTestId('btn-check').click();
    await expect(hostPage.getByTestId('action-buttons')).toBeVisible();
    await hostPage.getByTestId('btn-check').click();
    await expect(hostPage.getByTestId('advance-round-btn')).toBeVisible();
  }
  await hostPage.getByTestId('advance-round-btn').click();
  await expect(hostPage.getByText('showdown')).toBeVisible();
}

test.describe('Declare Winner at showdown', () => {
  test('host sees Declare Winner panel at showdown round, not Advance Round', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx, bobPage } = await startAndCompleteRound(browser);

    await advanceToShowdown(hostPage, bobPage);

    await expect(hostPage.getByTestId('declare-winner-panel')).toBeVisible();
    await expect(hostPage.getByTestId('advance-round-btn')).not.toBeVisible();
    await expect(bobPage.getByTestId('declare-winner-panel')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });

  test('host declares winner: pot transfers, New Hand button appears', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx, bobPage } = await startAndCompleteRound(browser);

    await advanceToShowdown(hostPage, bobPage);
    await expect(hostPage.getByTestId('declare-winner-panel')).toBeVisible();

    // Pot is 40 (Alice called 10 more during preflop setup in startAndCompleteRound)
    const potText = await hostPage.getByTestId('pot').textContent();
    expect(Number(potText)).toBeGreaterThan(0);

    // Declare Alice as winner
    await hostPage.getByTestId('winner-select').selectOption({ index: 0 });
    await hostPage.getByTestId('declare-winner-btn').click();

    // Pot clears
    await expect(hostPage.getByTestId('pot')).toHaveText('0');
    await expect(bobPage.getByTestId('pot')).toHaveText('0');

    // New Hand button appears for host only
    await expect(hostPage.getByTestId('new-hand-btn')).toBeVisible();
    await expect(bobPage.getByTestId('new-hand-btn')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });
});

test.describe('Game ends when only one player remains', () => {
  test('New Hand with one eliminated player transitions to game-over screen', async ({ browser }) => {
    // Setup: starting stack = 20 = bigBlind, so Bob (BB) posts 20 → chipCount=0 (all-in).
    // Alice (SB/button) posts 10, then calls 10 more → chipCount=0 (all-in).
    // Both all-in, advance to showdown, declare Alice winner → Bob has 0 chips → isEliminated.
    // Click New Hand → fewer than 2 active players → phase = 'ended'.
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx, page: bobPage } = await joinSession(browser, code, 'Bob');

    // Starting stack=20, BB=20: Bob (BB) posts 20 → 0 chips (all-in). Alice (SB) has 10 left.
    await hostPage.getByLabel(/starting stack/i).fill('20');
    await hostPage.getByLabel(/small blind/i).fill('10');
    await hostPage.getByLabel(/big blind/i).fill('20');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();
    await expect(hostPage.getByTestId('pot')).toHaveText('30');

    // Alice goes all-in with her remaining 10 chips → both all-in, pot=40
    await hostPage.getByTestId('btn-allin').click();
    // Both all-in — each round auto-completes; wait for round label to settle between advances
    await expect(hostPage.getByTestId('advance-round-btn')).toBeVisible();
    await hostPage.getByTestId('advance-round-btn').click(); // → flop
    await expect(hostPage.getByText('flop')).toBeVisible();
    await hostPage.getByTestId('advance-round-btn').click(); // → turn
    await expect(hostPage.getByText('turn')).toBeVisible();
    await hostPage.getByTestId('advance-round-btn').click(); // → river
    await expect(hostPage.getByText('river')).toBeVisible();
    await hostPage.getByTestId('advance-round-btn').click(); // → showdown

    await expect(hostPage.getByTestId('declare-winner-panel')).toBeVisible();

    // Declare Alice as winner → Alice gets 40 pot, Bob stays at 0 → Bob eliminated
    await hostPage.getByTestId('winner-select').selectOption({ index: 0 });
    await hostPage.getByTestId('declare-winner-btn').click();
    await expect(hostPage.getByTestId('pot')).toHaveText('0');
    await expect(hostPage.getByTestId('new-hand-btn')).toBeVisible();

    // New Hand → only Alice is not eliminated → game ends
    await hostPage.getByTestId('new-hand-btn').click();
    await expect(hostPage.getByText('Game Over')).toBeVisible();
    await expect(bobPage.getByText('Game Over')).toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });
});
