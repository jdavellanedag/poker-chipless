import { test, expect, Browser, Page } from '@playwright/test';

const MOBILE = { width: 375, height: 667 };

async function createSession(browser: Browser, hostName: string, viewport = MOBILE) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByPlaceholder('Your display name (host)').fill(hostName);
  await page.getByRole('button', { name: 'Create Game' }).click();
  const code = await page.locator('p.font-mono').first().textContent();
  await expect(page.getByTestId(`player-row-${hostName}`)).toBeVisible();
  return { ctx, page, code: code! };
}

async function joinSession(browser: Browser, code: string, playerName: string, viewport = MOBILE) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Join Game' }).click();
  await page.getByPlaceholder('Session code').fill(code);
  await page.getByPlaceholder('Your display name').fill(playerName);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByTestId(`player-row-${playerName}`)).toBeVisible();
  return { ctx, page };
}

async function startGame(hostPage: Page) {
  await hostPage.getByLabel(/starting stack/i).fill('1000');
  await hostPage.getByLabel(/small blind/i).fill('10');
  await hostPage.getByLabel(/big blind/i).fill('20');
  await hostPage.getByRole('button', { name: 'Start Game' }).click();
  await expect(hostPage.getByTestId('pot')).toBeVisible();
}

// --- Tracer bullet: host panel is a collapsible bottom sheet on mobile ---

test.describe('UI Polish — host panel collapsible on mobile', () => {
  test('host panel is hidden by default on mobile, opened by toggle, closed by X button', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx } = await joinSession(browser, code, 'Bob');
    await startGame(hostPage);

    // Panel is hidden by default on mobile
    await expect(hostPage.getByTestId('host-panel-sidebar')).not.toBeVisible();

    // Toggle opens the panel
    await hostPage.getByTestId('host-panel-toggle').click();
    await expect(hostPage.getByTestId('host-panel-sidebar')).toBeVisible();

    // Close button hides the panel
    await hostPage.getByTestId('host-panel-close').click();
    await expect(hostPage.getByTestId('host-panel-sidebar')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });

  test('non-host never sees host panel toggle', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx, page: bobPage } = await joinSession(browser, code, 'Bob');
    await startGame(hostPage);

    await expect(bobPage.getByTestId('host-panel-toggle')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });
});

// --- Slice 2: no horizontal scroll at 375px ---

test.describe('UI Polish — no horizontal scroll at 375px', () => {
  test('home screen has no horizontal scroll', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: MOBILE });
    const page = await ctx.newPage();
    await page.goto('/');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(MOBILE.width);
    await ctx.close();
  });

  test('join screen has no horizontal scroll', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: MOBILE });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: 'Join Game' }).click();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(MOBILE.width);
    await ctx.close();
  });

  test('lobby screen has no horizontal scroll', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx } = await joinSession(browser, code, 'Bob');
    const scrollWidth = await hostPage.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(MOBILE.width);
    await hostCtx.close();
    await bobCtx.close();
  });

  test('game screen has no horizontal scroll', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx } = await joinSession(browser, code, 'Bob');
    await startGame(hostPage);
    const scrollWidth = await hostPage.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(MOBILE.width);
    await hostCtx.close();
    await bobCtx.close();
  });
});

// --- Slice 3: action buttons have adequate touch targets ---

test.describe('UI Polish — action button touch targets', () => {
  test('action buttons are at least 44px tall', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx } = await joinSession(browser, code, 'Bob');
    await startGame(hostPage);

    // Alice is active on preflop (SB in heads-up)
    await expect(hostPage.getByTestId('action-buttons')).toBeVisible();

    const buttons = [
      hostPage.getByTestId('btn-fold'),
      hostPage.getByTestId('btn-allin'),
    ];
    for (const btn of buttons) {
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await hostCtx.close();
    await bobCtx.close();
  });
});

// --- Slice 4 (bugfix): host panel is a fixed right sidebar on desktop ---

const DESKTOP = { width: 1024, height: 768 };

test.describe('UI Polish — host panel fixed sidebar on desktop', () => {
  test('host panel is anchored to the right edge of the viewport on desktop', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice', DESKTOP);
    const { ctx: bobCtx } = await joinSession(browser, code, 'Bob', DESKTOP);
    await startGame(hostPage);

    const sidebar = hostPage.getByTestId('host-panel-sidebar');
    await expect(sidebar).toBeVisible();

    const box = await sidebar.boundingBox();
    expect(box).not.toBeNull();
    // Right edge is flush with the viewport
    expect(box!.x + box!.width).toBeCloseTo(DESKTOP.width, 0);
    // Starts at the top of the viewport
    expect(box!.y).toBe(0);
    // Full viewport height
    expect(box!.height).toBe(DESKTOP.height);

    await hostCtx.close();
    await bobCtx.close();
  });

  test('host panel sidebar is not visible on mobile viewport', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx } = await joinSession(browser, code, 'Bob');
    await startGame(hostPage);

    await expect(hostPage.getByTestId('host-panel-sidebar')).not.toBeVisible();

    await hostCtx.close();
    await bobCtx.close();
  });
});

// --- Slice 6: disconnected player shows visual indicator in game view ---

test.describe('UI Polish — disconnected player indicator', () => {
  test('disconnected player shows visual indicator in game view', async ({ browser }) => {
    const { ctx: hostCtx, page: hostPage, code } = await createSession(browser, 'Alice');
    const { ctx: bobCtx } = await joinSession(browser, code, 'Bob');
    await startGame(hostPage);

    // Close Bob's context — server immediately marks him disconnected
    await bobCtx.close();

    // Alice's view should show a disconnected indicator for Bob
    await expect(hostPage.getByTestId('disconnected-indicator-Bob')).toBeVisible();

    await hostCtx.close();
  });
});
