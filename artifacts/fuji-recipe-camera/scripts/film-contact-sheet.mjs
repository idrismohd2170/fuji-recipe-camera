// Renders every recipe on a photo into one contact sheet JPEG, so a look can be judged without
// building an APK. Under each photo is a strip of colour patches (red, orange, skin, yellow,
// green, foliage, cyan, sky, blue, magenta, then dark and light grey), graded the same way.
// The first cell is the untouched original; the rest follow the order of constants/recipes.ts.
//
// Run from artifacts/fuji-recipe-camera (Node 22.18+):
//   node --no-warnings scripts/film-contact-sheet.mjs <photo.jpg> <out.jpg> [cellWidth] [id,id,...]
import fs from 'node:fs';
import jpeg from 'jpeg-js';

import { gradePixels } from '../lib/film-grade.ts';
import { recipes } from '../constants/recipes.ts';

const [input, output, widthArg, idsArg] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: film-contact-sheet.mjs <photo.jpg> <out.jpg> [cellWidth] [id,id,...]');
  process.exit(1);
}
const CELL_W = Number(widthArg) || 300;
const COLUMNS = 6;
const GAP = 6;
const STRIP_H = 34;
const wanted = idsArg ? idsArg.split(',') : null;
const list = wanted ? recipes.filter((recipe) => wanted.includes(recipe.id)) : recipes;

const decoded = jpeg.decode(fs.readFileSync(input), { useTArray: true });
const cellH = Math.round((CELL_W * decoded.height) / decoded.width);

/** Box-filter downscale of RGBA pixels. */
function downscale(src, sw, sh, dw, dh) {
  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y += 1) {
    const y0 = Math.floor((y * sh) / dh);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / dh));
    for (let x = 0; x < dw; x += 1) {
      const x0 = Math.floor((x * sw) / dw);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / dw));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) {
          const i = (yy * sw + xx) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; n += 1;
        }
      }
      const o = (y * dw + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return out;
}

const PATCHES = [
  [200, 40, 40], [230, 120, 40], [224, 172, 135], [235, 205, 50], [60, 170, 70], [80, 120, 50],
  [50, 190, 190], [110, 160, 220], [40, 70, 200], [200, 60, 170], [70, 70, 70], [190, 190, 190],
];

function makeStrip() {
  const out = new Uint8Array(CELL_W * STRIP_H * 4);
  for (let x = 0; x < CELL_W; x += 1) {
    const [r, g, b] = PATCHES[Math.min(PATCHES.length - 1, Math.floor((x * PATCHES.length) / CELL_W))];
    for (let y = 0; y < STRIP_H; y += 1) {
      const o = (y * CELL_W + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
    }
  }
  return out;
}

const photo = downscale(decoded.data, decoded.width, decoded.height, CELL_W, cellH);
const strip = makeStrip();

const cells = [{ photo, strip }];
for (const recipe of list) {
  const p = new Uint8Array(photo);
  const s = new Uint8Array(strip);
  const options = { grainSeed: 3, yieldToUi: async () => {} };
  await gradePixels(p, CELL_W, cellH, recipe.look, options);
  await gradePixels(s, CELL_W, STRIP_H, recipe.look, options);
  cells.push({ photo: p, strip: s });
}

const rows = Math.ceil(cells.length / COLUMNS);
const cellTotalH = cellH + STRIP_H;
const sheetW = COLUMNS * CELL_W + (COLUMNS + 1) * GAP;
const sheetH = rows * cellTotalH + (rows + 1) * GAP;
const sheet = new Uint8Array(sheetW * sheetH * 4);
for (let i = 3; i < sheet.length; i += 4) sheet[i] = 255;

function blit(src, w, h, dx, dy) {
  for (let y = 0; y < h; y += 1) {
    sheet.set(src.subarray(y * w * 4, (y + 1) * w * 4), ((dy + y) * sheetW + dx) * 4);
  }
}
cells.forEach((cell, index) => {
  const col = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const x = GAP + col * (CELL_W + GAP);
  const y = GAP + row * (cellTotalH + GAP);
  blit(cell.photo, CELL_W, cellH, x, y);
  blit(cell.strip, CELL_W, STRIP_H, x, y + cellH);
});

fs.writeFileSync(output, jpeg.encode({ data: sheet, width: sheetW, height: sheetH }, 90).data);
console.log(`Wrote ${output} (${sheetW}x${sheetH}). Order, left to right, top to bottom:`);
['original', ...list.map((recipe) => recipe.id)].forEach((id, index) => console.log(`${index + 1}. ${id}`));
