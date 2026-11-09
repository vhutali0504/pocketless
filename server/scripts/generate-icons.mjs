// Renders the PWA icons and the logo from client/public/brand/pocketless-icon.svg.
// Run with `npm run icons` after any change to the icon. Dev-only: uses sharp and opentype.js.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import opentype from 'opentype.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const brand = join(root, 'client', 'public', 'brand');
const AUBERGINE = '#43144F';

const iconSvg = await readFile(join(brand, 'pocketless-icon.svg'), 'utf8');
const mark = iconSvg.match(/<g id="mark">[\s\S]*?<\/g>/)?.[0];
if (!mark) throw new Error('pocketless-icon.svg must contain <g id="mark">…</g>');

/** Full-bleed Aubergine square with the P, scaled around the centre. */
function fullBleed(scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="${AUBERGINE}"/>
  <g transform="translate(100 100) scale(${scale}) translate(-100.5 -99.5)">${mark}</g>
</svg>`;
}

async function png(svg, size, file) {
  await sharp(Buffer.from(svg), { density: Math.ceil((72 * size) / 200) * 2 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(brand, file));
  console.log(`wrote ${file}`);
}

await png(iconSvg, 192, 'icon-192.png');
await png(iconSvg, 512, 'icon-512.png');
// Maskable: the P sits well inside the central 80% safe zone (radius 80 of 200).
await png(fullBleed(0.8), 512, 'icon-maskable-512.png');
// iOS masks the corners itself and paints transparency black, so this one is full-bleed too.
await png(fullBleed(1), 180, 'apple-touch-icon-180.png');
await writeFile(join(brand, 'favicon.svg'), iconSvg);
console.log('wrote favicon.svg');

// Logo: icon plus "Pocketless" in Baloo 2 ExtraBold, converted to outlines.
const fontFile = join(root, 'node_modules', '@fontsource', 'baloo-2', 'files', 'baloo-2-latin-800-normal.woff');
const fontBuf = await readFile(fontFile);
const font = opentype.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));
const TRACK = { letterSpacing: -0.03 }; // slightly tighter than the font default, as on the brand sheet
const TEXT_HEIGHT = 100; // ascender top to baseline, in icon units (icon is 200 tall), as on the brand sheet
const probe = font.getPath('Pocketless', 0, 0, 100, TRACK).getBoundingBox();
const size = (100 * TEXT_HEIGHT) / -probe.y1;
const textX = 246;
const baseline = 134;
const word = font.getPath('Pocketless', textX, baseline, size, TRACK);
const box = word.getBoundingBox();
const width = Math.ceil(box.x2 + 4);
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 200" width="${width}" height="200" role="img" aria-label="Pocketless">
  ${iconSvg.replace(/^<svg[^>]*>|<\/svg>\s*$/g, '').trim().replace(/\n\s*/g, '\n  ')}
  <path fill="${AUBERGINE}" d="${word.toPathData(1)}"/>
</svg>
`;
await writeFile(join(brand, 'pocketless-logo.svg'), logo);
console.log('wrote pocketless-logo.svg');
