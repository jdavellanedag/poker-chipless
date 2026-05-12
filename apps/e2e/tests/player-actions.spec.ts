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
  await expect(hostPage.getByTestId('new-hand-btn')).toBeVisible();
  await hostPage.getByTestId('new-hand-btn').click();
  await expect(hostPage.getByTestId('pot')).toHaveText('30');

  return { hostCtx, hostPage, bobCtx, bobPage };
}

test.describe('Player action buttons', () => {
  test('action buttons are visible only to the active player', async ({ browser }) => {
    // Heads-up: Alice=SB/button, Bob=BB/active preflop
    const { hostCtx, hostPage, bobCtx, bobPage } = await startHandWith2Players(browser);

    // Bob is active preflop in heads-up — he should see action buttons
    await expect(bobPage.getByTestId('action-buttons')).toBeVisible();

    // Alice is not active — she should not see action buttons
    await expect(hostPage.getByTestId('action-buttons')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });

  test('"Call X" button shows the exact call amount', async ({ browser }) => {
    // Heads-up: Alice(SB)=10 posted, Bob(BB/active)=20 posted, currentBet=20.
    // Bob is active. Bob's currentBet=20, state.currentBet=20 → check option (no open raise).
    // After Bob checks, Alice must call 10 (currentBet=20, Alice.currentBet=10).
    const { hostCtx, hostPage, bobCtx, bobPage } = await startHandWith2Players(browser);

    // Bob checks (BB, no open raise against him)
    await expect(bobPage.getByTestId('btn-check')).toBeVisible();
    await bobPage.getByTestId('btn-check').click();

    // Now Alice is active and must call 10 (she posted SB=10, currentBet still 20? No—
    // after Bob checks the round is complete preflop in heads-up... actually wait:
    // Heads-up preflop: Alice=SB(10), Bob=BB(20). Bob acts first.
    // If Bob checks, preflop round is complete (SB still needs to act).
    // Actually no: heads-up preflop, BB acts first, then SB. If BB checks, SB can call/raise/fold.
    // Alice posted SB=10, currentBet=20. Alice must call 10 more.
    await expect(hostPage.getByTestId('action-buttons')).toBeVisible();
    await expect(hostPage.getByTestId('btn-call')).toHaveText('Call 10');

    await hostCtx.close();
    await bobCtx.close();
  });
});
