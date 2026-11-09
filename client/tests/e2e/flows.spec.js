import { expect, test } from '@playwright/test';

const VALUE = '4006381333931';

const isFocused = (locator) => locator.evaluate((el) => el === document.activeElement);

/** Presses Tab (or Shift+Tab) until `locator` has focus. Keyboard only: nothing is clicked. */
async function tabTo(page, locator, { back = false, max = 40 } = {}) {
  await expect(locator).toBeVisible();
  for (let i = 0; i < max; i += 1) {
    if (await isFocused(locator)) return;
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
  }
  await expect(locator).toBeFocused();
}

test('add, pull out, edit and delete a card with the keyboard only', async ({ page }) => {
  await page.goto('/app');
  const addLink = page.getByRole('link', { name: 'Add a card' });

  // Add: pick the store, type the number, confirm.
  await tabTo(page, addLink);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/app\/add$/);
  await tabTo(page, page.getByLabel('Search stores'));
  await page.keyboard.type('Clicks');
  await tabTo(page, page.getByRole('button', { name: /^Clicks/ }));
  await page.keyboard.press('Enter');

  await tabTo(page, page.getByRole('button', { name: 'Type the number instead' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByLabel('Card number'));
  await page.keyboard.type(VALUE);
  await page.keyboard.press('Enter'); // submits the form

  await tabTo(page, page.getByRole('button', { name: 'Yes, save card' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/app$/);

  // The new card arrives pulled out. Escape puts it back and focus lands on it.
  const card = page.getByRole('button', { name: 'Clicks, ClubCard' });
  await expect(card).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(card).toHaveAttribute('aria-expanded', 'false');
  await expect(card).toBeFocused();

  // Pull out: Enter on the card.
  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('img', { name: `Barcode for ${VALUE}` })).toBeVisible();
  // While it is out the header is inert, so Shift+Tab never reaches the "+" link.
  await page.keyboard.press('Shift+Tab');
  await expect(addLink).not.toBeFocused();
  await page.keyboard.press('Escape');
  await expect(card).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-expanded', 'true');

  // Open Edit and rename.
  await tabTo(page, page.getByRole('link', { name: 'Edit' }));
  await page.keyboard.press('Enter');
  const name = page.getByLabel('Card name');
  await tabTo(page, name);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Mom Clicks');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Saved');

  // Back to the wallet: the new name shows.
  await tabTo(page, page.getByRole('link', { name: 'Back to wallet' }), { back: true });
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/app$/);
  const renamed = page.getByRole('button', { name: 'Mom Clicks, ClubCard' });

  // Delete through the dialog.
  await tabTo(page, renamed);
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('link', { name: 'Edit' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: 'Delete card' }));
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Delete' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Your wallet is empty' })).toBeVisible();
});
