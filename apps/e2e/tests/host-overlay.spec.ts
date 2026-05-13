import { test, expect, Browser, Page } from '@playwright/test';

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

async function startAndCompletePreflop(browser: Browser) {
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

async function checkAndAdvance(actingPage: Page, hostPage: Page, nextRound: string) {
  await actingPage.getByTestId('btn-check').click();
  const otherPage = actingPage === hostPage ? actingPage : hostPage;
  // Wait for the next player to see action buttons or advance button
  await expect(hostPage.getByTestId('round-label')).not.toHaveText(nextRound);
  // Both players check each round
  if (actingPage !== hostPage) {
    await expect(hostPage.getByTestId('action-buttons')).toBeVisible();
    await hostPage.getByTestId('btn-check').click();
  }
  await expect(hostPage.getByTestId('advance-round-btn')).toBeVisible();
}

test.describe('Host overlay — dynamic Advance Round labels', () => {
  test('after preflop completes, advance button shows "Deal Flop"', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx } = await startAndCompletePreflop(browser);

    await expect(hostPage.getByTestId('advance-round-btn')).toHaveText('Deal Flop');

    await hostCtx.close();
    await bobCtx.close();
  });

  test('advance button label progresses: Deal Turn → Deal River → Go to Showdown', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx, bobPage } = await startAndCompletePreflop(browser);

    // Advance to flop — label should now be Deal Turn
    await hostPage.getByTestId('advance-round-btn').click();
    await expect(hostPage.getByTestId('round-label')).toHaveText('flop');
    await expect(bobPage.getByTestId('action-buttons')).toBeVisible();
    await bobPage.getByTestId('btn-check').click();
    await expect(hostPage.getByTestId('action-buttons')).toBeVisible();
    await hostPage.getByTestId('btn-check').click();
    await expect(hostPage.getByTestId('advance-round-btn')).toHaveText('Deal Turn');

    // Advance to turn — label should now be Deal River
    await hostPage.getByTestId('advance-round-btn').click();
    await expect(hostPage.getByTestId('round-label')).toHaveText('turn');
    await expect(bobPage.getByTestId('action-buttons')).toBeVisible();
    await bobPage.getByTestId('btn-check').click();
    await expect(hostPage.getByTestId('action-buttons')).toBeVisible();
    await hostPage.getByTestId('btn-check').click();
    await expect(hostPage.getByTestId('advance-round-btn')).toHaveText('Deal River');

    // Advance to river — label should now be Go to Showdown
    await hostPage.getByTestId('advance-round-btn').click();
    await expect(hostPage.getByTestId('round-label')).toHaveText('river');
    await expect(bobPage.getByTestId('action-buttons')).toBeVisible();
    await bobPage.getByTestId('btn-check').click();
    await expect(hostPage.getByTestId('action-buttons')).toBeVisible();
    await hostPage.getByTestId('btn-check').click();
    await expect(hostPage.getByTestId('advance-round-btn')).toHaveText('Go to Showdown');

    await hostCtx.close();
    await bobCtx.close();
  });
});

test.describe('Host overlay — pause and resume', () => {
  test('host can pause the game; non-host sees pause banner', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx, bobPage } = await startAndCompletePreflop(browser);

    // Advance to flop so the game is active (not right after hand start)
    await hostPage.getByTestId('advance-round-btn').click();
    await expect(hostPage.getByTestId('round-label')).toHaveText('flop');

    // Host sees Pause button, not Resume
    await expect(hostPage.getByTestId('pause-btn')).toBeVisible();
    await expect(hostPage.getByTestId('resume-btn')).not.toBeVisible();

    // Non-host does not see pause banner yet
    await expect(bobPage.getByTestId('pause-banner')).not.toBeVisible();

    // Host pauses
    await hostPage.getByTestId('pause-btn').click();

    // Non-host sees banner
    await expect(bobPage.getByTestId('pause-banner')).toBeVisible();
    await expect(bobPage.getByTestId('pause-banner')).toContainText('Game paused by host');

    // Host now sees Resume instead of Pause
    await expect(hostPage.getByTestId('resume-btn')).toBeVisible();
    await expect(hostPage.getByTestId('pause-btn')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });

  test('host resumes the game; non-host banner disappears', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx, bobPage } = await startAndCompletePreflop(browser);

    await hostPage.getByTestId('advance-round-btn').click();
    await expect(hostPage.getByTestId('round-label')).toHaveText('flop');

    await hostPage.getByTestId('pause-btn').click();
    await expect(bobPage.getByTestId('pause-banner')).toBeVisible();

    await hostPage.getByTestId('resume-btn').click();
    await expect(bobPage.getByTestId('pause-banner')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });
});

test.describe('Host overlay — rebuy UI', () => {
  test('host sees rebuy section with player dropdown, amount input, and disabled button', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx, bobPage } = await startAndCompletePreflop(browser);

    await expect(hostPage.getByTestId('rebuy-player-select')).toBeVisible();
    await expect(hostPage.getByTestId('rebuy-amount-input')).toBeVisible();
    await expect(hostPage.getByTestId('rebuy-btn')).toBeDisabled();

    // Non-host does not see rebuy controls
    await expect(bobPage.getByTestId('rebuy-player-select')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });

  test('rebuy amount input defaults to starting stack', async ({ browser }) => {
    const { hostCtx, hostPage, bobCtx } = await startAndCompletePreflop(browser);

    await expect(hostPage.getByTestId('rebuy-amount-input')).toHaveValue('1000');

    await hostCtx.close();
    await bobCtx.close();
  });
});
