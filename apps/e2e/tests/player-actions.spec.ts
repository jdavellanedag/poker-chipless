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
