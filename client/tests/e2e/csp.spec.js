import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { VALUES, addCardViaUi } from './helpers.js';

// Plan 3's CSP: no inline styles; the barcode picture is a data: image.
const CSP = "style-src 'self'; img-src 'self' data:";

// The service worker would answer navigations itself, bypassing page.route and its header.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  // Serve every HTML document with a strict CSP, as Plan 3's header will.
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    return route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': CSP } });
  });
});

test('a pulled-out barcode is black on white under a strict CSP', async ({ page }) => {
  await addCardViaUi(page, 'Clicks', VALUES[0]);

  // The CSP is really in force: an inline style attribute is refused.
  const inlineStyleApplied = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.setAttribute('style', 'color: rgb(1, 2, 3)');
    document.body.append(probe);
    const applied = getComputedStyle(probe).color === 'rgb(1, 2, 3)';
    probe.remove();
    return applied;
  });
  expect(inlineStyleApplied, 'inline styles must be blocked by the CSP').toBe(false);

  const picture = page.getByRole('img', { name: `Barcode for ${VALUES[0]}` }).locator('img');
  await expect(picture).toBeVisible();
  await expect.poll(() => picture.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);

  // On screen: the quiet zone at the left edge is white, and the drawing has black bars.
  const png = await picture.screenshot();
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => {
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const midY = Math.floor(info.height / 2);
  expect(pixel(2, midY)).toEqual([255, 255, 255]);
  expect(pixel(2, 2)).toEqual([255, 255, 255]);
  let black = 0;
  let white = 0;
  for (let x = 0; x < info.width; x += 1) {
    const [r, g, b] = pixel(x, midY);
    if (r < 32 && g < 32 && b < 32) black += 1;
    else if (r > 223 && g > 223 && b > 223) white += 1;
  }
  expect(black, 'black pixels across the middle').toBeGreaterThan(info.width * 0.2);
  expect(white, 'white pixels across the middle').toBeGreaterThan(info.width * 0.2);
});
