import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { VALUES, addCardViaUi } from './helpers.js';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Best-practice landmark rules (outside the WCAG tags): every page has one <main> and no content
// sits outside a landmark. These fail at any impact, moderate included.
const LANDMARK_RULES = ['landmark-one-main', 'region', 'landmark-no-duplicate-main'];

const summarise = (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`;

/**
 * Runs axe and fails on any serious or critical WCAG violation, or on any landmark finding,
 * listing what and where.
 */
async function expectNoSeriousViolations(page, label) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map(summarise);
  expect(bad, `axe on ${label}`).toEqual([]);

  const landmarks = await new AxeBuilder({ page }).withRules(LANDMARK_RULES).analyze();
  expect(landmarks.violations.map(summarise), `axe landmarks on ${label}`).toEqual([]);
}

for (const colorScheme of ['light', 'dark']) {
  test.describe(`axe, ${colorScheme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme });
    });

    test('/app empty', async ({ page }) => {
      await page.goto('/app');
      await expect(page.getByRole('link', { name: 'Add your first card' })).toBeVisible();
      await expectNoSeriousViolations(page, '/app empty');
    });

    test('/app with 3 cards, one pulled out', async ({ page }) => {
      await addCardViaUi(page, 'Clicks', VALUES[0]);
      await addCardViaUi(page, 'Checkers', VALUES[1]);
      await addCardViaUi(page, 'Pick n Pay', VALUES[2]);
      // Arriving from "Yes, save card" pulls the new card out.
      await expect(page.getByRole('button', { name: /^Pick n Pay/ })).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('img', { name: `Barcode for ${VALUES[2]}` })).toBeVisible();
      await expectNoSeriousViolations(page, '/app 3 cards, one out');
    });

    test('/app/add, every step', async ({ page }) => {
      await page.goto('/app/add');
      await expect(page.getByRole('heading', { name: 'Add a card' })).toBeVisible();
      await expectNoSeriousViolations(page, 'store picker');

      await page.getByRole('button', { name: /^Other store/ }).click();
      await page.getByRole('button', { name: 'Continue' }).click(); // shows both field errors
      await expect(page.getByText('Choose a colour')).toBeVisible();
      await expectNoSeriousViolations(page, 'other store form with errors');
      await page.getByRole('button', { name: 'Back' }).click();

      await page.getByRole('button', { name: /^Clicks/ }).click();
      await expect(page.getByRole('button', { name: 'Type the number instead' })).toBeVisible();
      await expectNoSeriousViolations(page, 'scan step');

      await page.getByRole('button', { name: 'Type the number instead' }).click();
      await page.getByRole('button', { name: 'Continue' }).click(); // empty: shows the error
      await expect(page.getByText('Enter the number from your card')).toBeVisible();
      await expectNoSeriousViolations(page, 'manual entry with error');

      await page.getByLabel('Card number').fill(VALUES[0]);
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByRole('button', { name: 'Yes, save card' })).toBeVisible();
      await expectNoSeriousViolations(page, 'check your card');
    });

    test('/app/cards/:id, and its delete dialog', async ({ page }) => {
      await addCardViaUi(page, 'Clicks', VALUES[0]);
      await page.getByRole('link', { name: 'Edit' }).click();
      await expect(page.getByLabel('Card name')).toBeVisible();
      await expectNoSeriousViolations(page, 'card details');

      await page.getByRole('button', { name: 'Delete card' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoSeriousViolations(page, 'delete dialog');
    });
  });
}

test('stays in light colours when the phone is in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/app');
  await expect(page.getByRole('link', { name: 'Add your first card' })).toBeVisible();
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(255, 246, 230)'); // Cream #FFF6E6
});
