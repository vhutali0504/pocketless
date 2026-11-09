import { expect, test } from '@playwright/test';

const VALUE = '4006381333931';

/** Waits for the service worker to be active, and reloads once so it controls the page. */
async function waitForServiceWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  if (!controlled) {
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  }
}

test('a saved card opens with its barcode while offline', async ({ page, context }) => {
  await page.goto('/app/add');
  await page.getByRole('button', { name: /^Clicks/ }).click();
  await page.getByRole('button', { name: 'Type the number instead' }).click();
  await page.getByLabel('Card number').fill(VALUE);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Yes, save card' }).click();
  await expect(page).toHaveURL(/\/app$/);

  await waitForServiceWorker(page);

  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: /^Clicks/ }).click();
  const barcode = page.getByRole('img', { name: `Barcode for ${VALUE}` });
  await expect(barcode).toBeVisible();
  await expect(barcode.locator('img')).toBeVisible();
});

test('the web app manifest describes an installable app scoped to /app/', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.scope).toBe('/app/');
  expect(manifest.start_url).toBe('/app/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.theme_color).toBe('#43144F');
  expect(manifest.background_color).toBe('#FFF6E6');

  const icons = manifest.icons.map((i) => `${i.sizes} ${i.purpose ?? 'any'}`);
  expect(icons).toEqual(expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']));
  for (const icon of manifest.icons) {
    const img = await request.get(icon.src);
    expect(img.status(), icon.src).toBe(200);
  }
});
