import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { VALUES, addCardViaUi } from './helpers.js';

const CSP = "style-src 'self'";

// The service worker would answer navigations itself, bypassing page.route and its header.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  // Serve every HTML document with a strict style-src, as Plan 3's CSP header will.
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    return route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': CSP } });
  });
});

test('a pulled-out barcode is black on white under a strict CSP (style-src self)', async ({ page }) => {
  const blocked = [];
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) blocked.push(msg.text());
  });

  await addCardViaUi(page, 'Clicks', VALUES[0]);
  const art = page.getByRole('img', { name: `Barcode for ${VALUES[0]}` });
  await expect(art).toBeVisible();

  // The CSP is really in force: JsBarcode's inline style attributes were refused.
  expect(blocked.length, 'CSP violations reported').toBeGreaterThan(0);

  const fills = await art.locator('svg').evaluate((svg) => ({
    background: getComputedStyle(svg.querySelector(':scope > rect')).fill,
    bars: [...svg.querySelectorAll(':scope > g')].map((g) => getComputedStyle(g).fill),
  }));
  expect(fills.background).toBe('rgb(255, 255, 255)');
  expect(fills.bars.length).toBeGreaterThan(0);
  for (const fill of fills.bars) expect(fill).toBe('rgb(0, 0, 0)');

  // And on screen: the quiet zone at the left edge is white, and the drawing has black bars.
  const png = await art.locator('svg').screenshot();
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
