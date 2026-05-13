import { test, expect, Browser, Page } from '@playwright/test';

const MOBILE = { width: 375, height: 667 };

async function createSession(browser: Browser, hostName: string) {
  const ctx = await browser.newContext({ viewport: MOBILE });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByPlaceholder('Your display name (host)').fill(hostName);
  await page.getByRole('button', { name: 'Create Game' }).click();
  const code = await page.locator('p.font-mono').first().textContent();
  await expect(page.getByTestId(`player-row-${hostName}`)).toBeVisible();
  return { ctx, page, code: code! };
}

async function joinSession(browser: Browser, code: string, playerName: string) {
  const ctx = await browser.newContext({ viewport: MOBILE });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Join Game' }).click();
  await page.getByPlaceholder('Session code').fill(code);
  await page.getByPlaceholder('Your display name').fill(playerName);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByTestId(`player-row-${playerName}`)).toBeVisible();
  return { ctx, page };
}

async function startGame(hostPage: Page, extraNames: string[] = []) {
  for (const name of extraNames) {
    await expect(hostPage.getByTestId(`player-row-${name}`)).toBeVisible();
  }
  await hostPage.getByLabel(/starting stack/i).fill('1000');
  await hostPage.getByLabel(/small blind/i).fill('10');
  await hostPage.getByLabel(/big blind/i).fill('20');
  await hostPage.getByRole('button', { name: 'Start Game' }).click();
  await expect(hostPage.getByTestId('pot')).toBeVisible();
}

const EXTRA_PLAYERS = ['Bob', 'Carol', 'Dave', 'Eve', 'Frank'];

// --- Tracer: game screen outer container never produces vertical page scroll ---

test.describe('Scrollable player list — no page scroll with many players', () => {
  test('game screen scrollHeight equals viewport height with 6 players on mobile', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const joiners = [];
    for (const name of EXTRA_PLAYERS) {
      joiners.push(await joinSession(browser, code, name));
    }

    await startGame(hostPage, EXTRA_PLAYERS);

    const scrollHeight = await hostPage.evaluate(() => document.documentElement.scrollHeight);
    expect(scrollHeight).toBeLessThanOrEqual(MOBILE.height);

    await hostCtx.close();
    for (const { ctx } of joiners) await ctx.close();
  });
});

// --- Slice 2: pot and action buttons both visible in viewport simultaneously ---

test.describe('Scrollable player list — key elements in viewport', () => {
  test('pot header and action buttons are both within viewport bounds on mobile', async ({ browser }) => {
    // Use heads-up (2 players) — Alice (host/SB) acts first preflop so her action buttons show
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx } = await joinSession(browser, code, 'Bob');

    await startGame(hostPage);

    // Pot is in the viewport
    const potBox = await hostPage.getByTestId('pot').boundingBox();
    expect(potBox).not.toBeNull();
    expect(potBox!.y).toBeGreaterThanOrEqual(0);
    expect(potBox!.y + potBox!.height).toBeLessThanOrEqual(MOBILE.height);

    // Action buttons are in the viewport (Alice is SB/button, acts first in heads-up)
    await expect(hostPage.getByTestId('action-buttons')).toBeVisible();
    const actionBox = await hostPage.getByTestId('action-buttons').boundingBox();
    expect(actionBox).not.toBeNull();
    expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(MOBILE.height);

    await hostCtx.close();
    await bobCtx.close();
  });
});

// --- Slice 3: player list container scrolls internally, not the page ---

test.describe('Scrollable player list — internal scroll container', () => {
  test('player list region scrolls internally rather than producing page scroll with 6 players', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const joiners = [];
    for (const name of EXTRA_PLAYERS) {
      joiners.push(await joinSession(browser, code, name));
    }

    await startGame(hostPage, EXTRA_PLAYERS);

    // Page itself does not scroll
    const pageScrollHeight = await hostPage.evaluate(() => document.documentElement.scrollHeight);
    expect(pageScrollHeight).toBeLessThanOrEqual(MOBILE.height);

    // The scrollable player list container has more content than its visible height
    // (i.e. the list content overflows internally, not onto the page)
    const listScrollable = await hostPage.evaluate(() => {
      const list = document.querySelector('[data-testid="player-row-Alice"]')?.closest('.overflow-y-auto');
      if (!list) return false;
      return list.scrollHeight > list.clientHeight;
    });
    expect(listScrollable).toBe(true);

    await hostCtx.close();
    for (const { ctx } of joiners) await ctx.close();
  });
});
