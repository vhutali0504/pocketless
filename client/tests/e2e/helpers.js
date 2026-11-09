import { expect } from '@playwright/test';

export const VALUES = ['4006381333931', '9780306406157', '9780201379624'];

/** Adds a card through the real UI, typing the number. Lands on /app with the new card pulled out. */
export async function addCardViaUi(page, storeName, value) {
  await page.goto('/app/add');
  await page.getByRole('button', { name: new RegExp(`^${storeName}`) }).click();
  await page.getByRole('button', { name: 'Type the number instead' }).click();
  await page.getByLabel('Card number').fill(value);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Yes, save card' }).click();
  await expect(page).toHaveURL(/\/app$/);
}
