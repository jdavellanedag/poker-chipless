import { test, expect } from '@playwright/test';

test.describe('Session creation', () => {
  test('host creates a session and sees a 6-character code', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Your display name (host)').fill('Alice');
    await page.getByRole('button', { name: 'Create Game' }).click();

    const code = page.locator('p.font-mono');
    await expect(code).toBeVisible();
    await expect(code).toHaveText(/^[A-Z0-9]{6}$/);
  });

  test('host lands in lobby with their name visible after creating session', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Your display name (host)').fill('Alice');
    await page.getByRole('button', { name: 'Create Game' }).click();

    // Host transitions directly to the lobby screen
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible();
  });

  test('empty display name shows validation error', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create Game' }).click();

    await expect(page.getByText('Display name cannot be empty')).toBeVisible();
  });
});

test.describe('Session join flow', () => {
  test('player joins and both see each other in the lobby', async ({ browser }) => {
    // Host creates session
    const hostCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    await hostPage.goto('/');
    await hostPage.getByPlaceholder('Your display name (host)').fill('Alice');
    await hostPage.getByRole('button', { name: 'Create Game' }).click();

    const code = await hostPage.locator('p.font-mono').first().textContent();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);

    // Player joins with the code
    const playerCtx = await browser.newContext();
    const playerPage = await playerCtx.newPage();
    await playerPage.goto('/');
    await playerPage.getByRole('button', { name: 'Join Game' }).click();
    await playerPage.getByPlaceholder('Session code').fill(code!);
    await playerPage.getByPlaceholder('Your display name').fill('Bob');
    await playerPage.getByRole('button', { name: 'Join' }).click();

    // Both land in the lobby and see each other
    await expect(hostPage.getByText('Bob')).toBeVisible();
    await expect(playerPage.getByText('Alice')).toBeVisible();

    await hostCtx.close();
    await playerCtx.close();
  });

  test('wrong session code shows error', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Join Game' }).click();
    await page.getByPlaceholder('Session code').fill('XXXXXX');
    await page.getByPlaceholder('Your display name').fill('Bob');
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page.getByText(/session not found/i)).toBeVisible();
  });

  test('empty display name on join screen shows validation error', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Join Game' }).click();
    await page.getByPlaceholder('Session code').fill('ABCDEF');
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page.getByText('Display name cannot be empty')).toBeVisible();
  });

  test('host badge is visible for the host player in the lobby', async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    await hostPage.goto('/');
    await hostPage.getByPlaceholder('Your display name (host)').fill('Alice');
    await hostPage.getByRole('button', { name: 'Create Game' }).click();

    // The host sees their own "host" badge in the lobby
    await expect(hostPage.getByText('host')).toBeVisible();

    await hostCtx.close();
  });

  test('reconnection token is stored in sessionStorage after joining', async ({ browser }) => {
    // Host creates session
    const hostCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    await hostPage.goto('/');
    await hostPage.getByPlaceholder('Your display name (host)').fill('Alice');
    await hostPage.getByRole('button', { name: 'Create Game' }).click();

    const code = await hostPage.locator('p.font-mono').first().textContent();

    // Player joins and checks sessionStorage
    const playerCtx = await browser.newContext();
    const playerPage = await playerCtx.newPage();
    await playerPage.goto('/');
    await playerPage.getByRole('button', { name: 'Join Game' }).click();
    await playerPage.getByPlaceholder('Session code').fill(code!);
    await playerPage.getByPlaceholder('Your display name').fill('Bob');
    await playerPage.getByRole('button', { name: 'Join' }).click();

    // Wait for lobby to confirm join completed
    await expect(playerPage.getByText('Alice')).toBeVisible();

    const token = await playerPage.evaluate(() => sessionStorage.getItem('session_token'));
    expect(token).toMatch(/^[0-9a-f-]{36}$/); // UUID format

    await hostCtx.close();
    await playerCtx.close();
  });
});
