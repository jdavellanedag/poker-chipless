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

async function startHandWith2Players(browser: Browser) {
  const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
  const { ctx: bobCtx, page: bobPage } = await joinSession(browser, code, 'Bob');

  await hostPage.getByLabel(/starting stack/i).fill('1000');
  await hostPage.getByLabel(/small blind/i).fill('10');
  await hostPage.getByLabel(/big blind/i).fill('20');
  await hostPage.getByRole('button', { name: 'Start Game' }).click();
  // Start Game auto-deals the first hand — wait for blinds to be posted
  await expect(hostPage.getByTestId('pot')).toHaveText('30');

  return { hostCtx, hostPage, bobCtx, bobPage };
}

test.describe('Fold during a hand', () => {
  test('active player folds: pot awarded to winner, action buttons gone for both', async ({ browser }) => {
    // Heads-up: Alice(host)=SB/button acts first. She folds → Bob wins the pot (30).
    const { hostCtx, hostPage, bobCtx, bobPage } = await startHandWith2Players(browser);

    // Alice is active — she folds
    await hostPage.getByTestId('btn-fold').click();

    // Pot awarded to Bob: pot shows 0.
    // Bob posted BB(20) → 980, wins pot(30) → 1010.
    await expect(hostPage.getByTestId('pot')).toHaveText('0');
    await expect(hostPage.getByTestId('chips-Bob')).toHaveText('1010');
    await expect(bobPage.getByTestId('pot')).toHaveText('0');
    await expect(bobPage.getByTestId('chips-Bob')).toHaveText('1010');

    // Action buttons must not be visible for either player
    await expect(hostPage.getByTestId('action-buttons')).not.toBeVisible();
    await expect(bobPage.getByTestId('action-buttons')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });
});

test.describe('Call during a hand', () => {
  test('SB calls BB: chip counts and pot update, turn advances to BB', async ({ browser }) => {
    // Heads-up: Alice(SB/button)=active, posts 10. Bob(BB) posts 20. Pot=30.
    // Alice calls 10 more → Alice.chips=990, pot=40. Turn advances to Bob.
    const { hostCtx, hostPage, bobCtx, bobPage } = await startHandWith2Players(browser);

    await hostPage.getByTestId('btn-call').click();

    // Alice's chips reduced by the 10 call amount (she already posted SB=10, now calls 10 more)
    await expect(hostPage.getByTestId('chips-Alice')).toHaveText('990');
    // Pot grows from 30 to 40
    await expect(hostPage.getByTestId('pot')).toHaveText('40');
    // Bob is now the active player — he sees action buttons
    await expect(bobPage.getByTestId('action-buttons')).toBeVisible();
    // Alice is no longer active — her action buttons are gone
    await expect(hostPage.getByTestId('action-buttons')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });
});

test.describe('Check during a hand', () => {
  test('BB checks after SB calls: roundComplete hides action buttons for both', async ({ browser }) => {
    // Alice(SB) calls 10 → Bob(BB) can check (both at 20, no open bet).
    // After Bob checks: roundComplete=true → action-buttons hidden for both.
    const { hostCtx, hostPage, bobCtx, bobPage } = await startHandWith2Players(browser);

    // Alice (SB/host) calls to match Bob's BB
    await hostPage.getByTestId('btn-call').click();
    // Wait for Bob's action buttons to appear (turn advanced)
    await expect(bobPage.getByTestId('action-buttons')).toBeVisible();

    // Bob (BB) checks — this completes the betting round
    await bobPage.getByTestId('btn-check').click();

    // roundComplete=true → neither player should see action buttons
    await expect(hostPage.getByTestId('action-buttons')).not.toBeVisible();
    await expect(bobPage.getByTestId('action-buttons')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });
});

test.describe('Auto all-in on call', () => {
  test('player whose stack cannot cover the call sees no Call button — only All-In and Fold', async ({ browser }) => {
    // Alice starts with 15 chips. Posts SB=10, has 5 left. Call amount = BB(20) - SB_posted(10) = 10.
    // Alice.chipCount(5) <= callAmount(10) → Call is replaced by All-In.
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx } = await joinSession(browser, code, 'Bob');

    await hostPage.getByLabel(/starting stack/i).fill('15');
    await hostPage.getByLabel(/small blind/i).fill('10');
    await hostPage.getByLabel(/big blind/i).fill('20');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();
    await expect(hostPage.getByTestId('pot')).toBeVisible();

    // Alice (SB/button) is active — she can't cover the 10-chip call, so Call must be hidden
    await expect(hostPage.getByTestId('btn-call')).not.toBeVisible();
    await expect(hostPage.getByTestId('btn-allin')).toBeVisible();
    await expect(hostPage.getByTestId('btn-fold')).toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });
});

test.describe('All-in during a hand', () => {
  test('"All-In (X)" button shows the active player\'s chip count', async ({ browser }) => {
    // Heads-up: Alice(SB/button)=active after posting SB(10), leaving her with 990 chips.
    const { hostCtx, hostPage, bobCtx, bobPage } = await startHandWith2Players(browser);

    // Alice is active and has 990 chips left (posted SB=10 from 1000)
    await expect(hostPage.getByTestId('btn-allin')).toHaveText('All-In (990)');

    await hostCtx.close();
    await bobCtx.close();
  });

  test('active player goes all-in: chips reach 0, pot increases', async ({ browser }) => {
    // Alice(SB/button) goes all-in for 990. Pot was 30 (blinds) → 30 + 990 = 1020.
    const { hostCtx, hostPage, bobCtx, bobPage } = await startHandWith2Players(browser);

    await hostPage.getByTestId('btn-allin').click();

    await expect(hostPage.getByTestId('chips-Alice')).toHaveText('0');
    await expect(hostPage.getByTestId('pot')).toHaveText('1020');
    await expect(bobPage.getByTestId('chips-Alice')).toHaveText('0');
    await expect(bobPage.getByTestId('pot')).toHaveText('1020');

    await hostCtx.close();
    await bobCtx.close();
  });
});

test.describe('Raise during a hand', () => {
  test('raise input shows minimum raise amount and raise updates currentBet', async ({ browser }) => {
    // Heads-up: Alice(SB) is active. currentBet=20, lastRaiseSize=20. Min raise = 40.
    const { hostCtx, hostPage, bobCtx, bobPage } = await startHandWith2Players(browser);

    // Raise input defaults to minimum (currentBet + lastRaiseSize = 40)
    await expect(hostPage.getByTestId('raise-input')).toHaveValue('40');

    // Alice raises to 40. She had 990 chips (posted SB 10). Puts in 40 total → 960 left.
    await hostPage.getByTestId('btn-raise').click();

    await expect(hostPage.getByTestId('chips-Alice')).toHaveText('960');
    // pot was 30 (blinds) + 30 (Alice raises to 40, puts in 40 total but 10 already from SB → +30) = 60
    await expect(hostPage.getByTestId('pot')).toHaveText('60');
    // Turn advances to Bob
    await expect(bobPage.getByTestId('action-buttons')).toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });
});

test.describe('Player action buttons', () => {
  test('action buttons are visible only to the active player', async ({ browser }) => {
    // Heads-up: Alice=SB/button acts first preflop, Bob=BB
    const { hostCtx, hostPage, bobCtx, bobPage } = await startHandWith2Players(browser);

    // Alice (SB/button) is active preflop — she should see action buttons
    await expect(hostPage.getByTestId('action-buttons')).toBeVisible();

    // Bob (BB) is not active yet — he should not see action buttons
    await expect(bobPage.getByTestId('action-buttons')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });

  test('"Call X" button shows the exact amount the active player must put in', async ({ browser }) => {
    // Heads-up: Alice(SB)=10 posted, Bob(BB)=20 posted, currentBet=20.
    // Alice acts first. Alice.currentBet=10, state.currentBet=20 → call amount = 10.
    const { hostCtx, hostPage, bobCtx, bobPage } = await startHandWith2Players(browser);

    // Alice (SB) is active immediately and must call 10 to match the BB
    await expect(hostPage.getByTestId('action-buttons')).toBeVisible();
    await expect(hostPage.getByTestId('btn-call')).toHaveText('Call 10');

    await hostCtx.close();
    await bobCtx.close();
  });

  test('SB and BB badges are shown on the correct players', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx, bobPage } = await startHandWith2Players(browser);

    // Heads-up: Alice=SB/button, Bob=BB
    await expect(hostPage.getByTestId('badge-sb-Alice')).toBeVisible();
    await expect(hostPage.getByTestId('badge-bb-Bob')).toBeVisible();
    await expect(bobPage.getByTestId('badge-sb-Alice')).toBeVisible();
    await expect(bobPage.getByTestId('badge-bb-Bob')).toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });
});
