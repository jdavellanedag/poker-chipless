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

  test('Advance Round button is not visible to host mid-round before betting is complete', async ({ browser }) => {
    // Game starts, first hand dealt — no player has acted yet, roundComplete=false
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx } = await joinSession(browser, code, 'Bob');

    await hostPage.getByLabel(/starting stack/i).fill('1000');
    await hostPage.getByLabel(/small blind/i).fill('10');
    await hostPage.getByLabel(/big blind/i).fill('20');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();
    await expect(hostPage.getByTestId('pot')).toHaveText('30');

    // Alice (SB/host) is active but hasn't acted — round is not complete
    await expect(hostPage.getByTestId('action-buttons')).toBeVisible();
    await expect(hostPage.getByTestId('advance-round-btn')).not.toBeVisible();

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

  test("winner's chip count increases on both pages after declare winner", async ({ browser }) => {
    // Pot = 40 after preflop (Alice calls 10, both at 20). Alice has 980 chips going to showdown.
    // After Alice wins pot of 40: Alice = 980 + 40 = 1020.
    const { hostCtx, hostPage, bobCtx, bobPage } = await startAndCompleteRound(browser);

    const aliceChipsBefore = Number(await hostPage.getByTestId('chips-Alice').textContent());

    await advanceToShowdown(hostPage, bobPage);
    await hostPage.getByTestId('winner-select').selectOption({ index: 0 }); // Alice
    await hostPage.getByTestId('declare-winner-btn').click();

    await expect(hostPage.getByTestId('chips-Alice')).toHaveText(String(aliceChipsBefore + 40));
    await expect(bobPage.getByTestId('chips-Alice')).toHaveText(String(aliceChipsBefore + 40));

    await hostCtx.close();
    await bobCtx.close();
  });

  test('folded player is not in winner dropdown at showdown', async ({ browser }) => {
    // 3-player: Alice(0)=button/UTG, Bob(1)=SB, Carol(2)=BB.
    // Preflop: Alice calls, Bob calls, Carol checks → roundComplete.
    // Flop: Bob checks, Carol folds, Alice checks → Carol excluded from winner dropdown.
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx, page: bobPage } = await joinSession(browser, code, 'Bob');
    const { ctx: carolCtx, page: carolPage } = await joinSession(browser, code, 'Carol');

    await hostPage.getByLabel(/starting stack/i).fill('1000');
    await hostPage.getByLabel(/small blind/i).fill('10');
    await hostPage.getByLabel(/big blind/i).fill('20');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();
    await expect(hostPage.getByTestId('pot')).toBeVisible();

    // Preflop: Alice(UTG) calls, Bob(SB) calls, Carol(BB) checks
    await hostPage.getByTestId('btn-call').click();
    await expect(bobPage.getByTestId('action-buttons')).toBeVisible();
    await bobPage.getByTestId('btn-call').click();
    await expect(carolPage.getByTestId('action-buttons')).toBeVisible();
    await carolPage.getByTestId('btn-check').click();
    await expect(hostPage.getByTestId('advance-round-btn')).toBeVisible();

    // Advance to flop: Bob acts first, Carol folds, Alice checks → roundComplete
    await hostPage.getByTestId('advance-round-btn').click();
    await expect(hostPage.getByText('flop')).toBeVisible();
    await expect(bobPage.getByTestId('action-buttons')).toBeVisible();
    await bobPage.getByTestId('btn-check').click();
    await expect(carolPage.getByTestId('action-buttons')).toBeVisible();
    await carolPage.getByTestId('btn-fold').click();
    await expect(hostPage.getByTestId('action-buttons')).toBeVisible();
    await hostPage.getByTestId('btn-check').click();
    await expect(hostPage.getByTestId('advance-round-btn')).toBeVisible();

    // Advance through turn and river (only Bob and Alice remain)
    for (const round of ['turn', 'river'] as const) {
      await hostPage.getByTestId('advance-round-btn').click();
      await expect(hostPage.getByText(round)).toBeVisible();
      await expect(bobPage.getByTestId('action-buttons')).toBeVisible();
      await bobPage.getByTestId('btn-check').click();
      await expect(hostPage.getByTestId('action-buttons')).toBeVisible();
      await hostPage.getByTestId('btn-check').click();
      await expect(hostPage.getByTestId('advance-round-btn')).toBeVisible();
    }
    await hostPage.getByTestId('advance-round-btn').click();
    await expect(hostPage.getByText('showdown')).toBeVisible();
    await expect(hostPage.getByTestId('declare-winner-panel')).toBeVisible();

    // Winner select must not contain Carol (she folded)
    const options = await hostPage.getByTestId('winner-select').locator('option').allTextContents();
    expect(options.some((o) => o.includes('Carol'))).toBe(false);
    expect(options.some((o) => o.includes('Alice'))).toBe(true);
    expect(options.some((o) => o.includes('Bob'))).toBe(true);

    await hostCtx.close();
    await bobCtx.close();
    await carolCtx.close();
  });

  test('clicking New Hand after a showdown deals the next hand with blinds posted', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx, bobPage } = await startAndCompleteRound(browser);

    // After preflop: Alice=980 chips, Bob=980 chips, pot=40
    await advanceToShowdown(hostPage, bobPage);
    await hostPage.getByTestId('winner-select').selectOption({ index: 0 }); // Alice wins
    await hostPage.getByTestId('declare-winner-btn').click();
    await expect(hostPage.getByTestId('new-hand-btn')).toBeVisible();

    // Alice won 40 chips → Alice has 980+40=1020, Bob has 980
    // Hand 2: button advances to Bob (SB), Alice (BB)
    // Bob posts SB(10) from 980 → 970; Alice posts BB(20) from 1020 → 1000; pot=30
    await hostPage.getByTestId('new-hand-btn').click();

    await expect(hostPage.getByTestId('pot')).toHaveText('30');
    await expect(bobPage.getByTestId('pot')).toHaveText('30');
    await expect(hostPage.getByTestId('chips-Alice')).toHaveText('1000');
    await expect(hostPage.getByTestId('chips-Bob')).toHaveText('970');

    await hostCtx.close();
    await bobCtx.close();
  });
});

test.describe('Fold-win showdown', () => {
  test('last fold enters showdown phase: Accept button appears, pot transfers on click, New Hand follows', async ({ browser }) => {
    // Heads-up: Alice(host)=SB/button, Bob=BB.
    // Alice folds → showdown entered with pot intact → host sees Accept button.
    // Host clicks Accept → Bob wins pot → New Hand button appears.
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx, page: bobPage } = await joinSession(browser, code, 'Bob');

    await hostPage.getByLabel(/starting stack/i).fill('1000');
    await hostPage.getByLabel(/small blind/i).fill('10');
    await hostPage.getByLabel(/big blind/i).fill('20');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();
    await expect(hostPage.getByTestId('pot')).toHaveText('30');

    // Alice folds → round label becomes 'showdown', pot remains 30
    await hostPage.getByTestId('btn-fold').click();
    await expect(hostPage.getByText('showdown')).toBeVisible();
    await expect(hostPage.getByTestId('pot')).toHaveText('30');

    // Only host sees Accept button; Bob does not see declare-winner-panel
    await expect(hostPage.getByTestId('declare-winner-panel')).toBeVisible();
    await expect(hostPage.getByTestId('accept-winner-btn')).toBeVisible();
    await expect(bobPage.getByTestId('declare-winner-panel')).not.toBeVisible();

    // Advance Round button must not be visible (already in showdown)
    await expect(hostPage.getByTestId('advance-round-btn')).not.toBeVisible();

    // Host accepts: pot clears, chips transfer to Bob, New Hand button appears
    await hostPage.getByTestId('accept-winner-btn').click();
    await expect(hostPage.getByTestId('pot')).toHaveText('0');
    await expect(hostPage.getByTestId('chips-Bob')).toHaveText('1010');
    await expect(hostPage.getByTestId('new-hand-btn')).toBeVisible();
    await expect(bobPage.getByTestId('new-hand-btn')).not.toBeVisible();

    // New Hand starts successfully
    await hostPage.getByTestId('new-hand-btn').click();
    await expect(hostPage.getByTestId('pot')).toHaveText('30');
    await expect(bobPage.getByTestId('pot')).toHaveText('30');

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
