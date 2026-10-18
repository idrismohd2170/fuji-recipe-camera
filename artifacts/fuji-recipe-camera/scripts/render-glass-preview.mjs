// Renders the aurora backdrop and the glass lighting over mock content to a PNG, so the look
// can be judged without building an APK. Uses canvaskit-wasm (CPU), like compare-film-shader.mjs.
// The blur is NOT simulated (a flat tinted fill stands in for it), so on the phone the glass
// over real content looks softer than this.
//
//   node --no-warnings scripts/render-glass-preview.mjs <out.png> [light]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { GLASS_LIGHT_DIR, GLASS_SKSL, flattenGlassUniforms } from '../lib/glass-shader.ts';
import { AURORA_COLORS, AURORA_SKSL, flattenAuroraUniforms } from '../lib/aurora-shader.ts';

const out = process.argv[2];
if (!out) {
  console.error('usage: render-glass-preview.mjs <out.png> [time-seconds]');
  process.exit(1);
}
const time = Number(process.argv[3]) || 12;
const here = path.dirname(fileURLToPath(import.meta.url));

function findCanvasKit() {
  const store = path.join(here, '..', '..', '..', 'node_modules', '.pnpm');
  for (const entry of fs.readdirSync(store)) {
    if (entry.startsWith('canvaskit-wasm@')) {
      return path.join(store, entry, 'node_modules', 'canvaskit-wasm');
    }
  }
  throw new Error('canvaskit-wasm not found; run pnpm install first');
}
const dir = findCanvasKit();
const ck = await createRequire(path.join(dir, 'package.json'))(path.join(dir, 'bin', 'canvaskit.js'))({
  locateFile: (file) => path.join(dir, 'bin', file),
});

const W = 540;
const H = 1170;
const surface = ck.MakeSurface(W, H);
const canvas = surface.getCanvas();
canvas.clear(ck.BLACK);

const aurora = ck.RuntimeEffect.Make(AURORA_SKSL, (e) => console.log('aurora SkSL error:', e));
const glass = ck.RuntimeEffect.Make(GLASS_SKSL, (e) => console.log('glass SkSL error:', e));
if (!aurora || !glass) process.exit(1);

// 1. Aurora, full screen.
{
  const flat = flattenAuroraUniforms({ res: [W, H], time, ...AURORA_COLORS, intensity: 0.85 });
  const paint = new ck.Paint();
  paint.setShader(aurora.makeShader(flat));
  canvas.drawRect(ck.LTRBRect(0, 0, W, H), paint);
}

// 2. Mock content: cards in the app's grey.
const card = (x, y, w, h, color) => {
  const paint = new ck.Paint();
  paint.setColor(ck.parseColorString(color));
  paint.setAntiAlias(true);
  canvas.drawRRect(ck.RRectXY(ck.LTRBRect(x, y, x + w, y + h), 28, 28), paint);
};
card(24, 300, 492, 330, '#2a2118');
card(24, 650, 492, 300, '#1c2a2a');

// 3. Glass panels: a flat tinted body (stand-in for the blur) then the lighting shader.
function panel(x, y, w, h, radius, dark = true, press = 0) {
  const body = new ck.Paint();
  body.setColor(ck.parseColorString(dark ? 'rgba(38,38,40,0.42)' : 'rgba(255,255,255,0.42)'));
  body.setAntiAlias(true);
  const rrect = ck.RRectXY(ck.LTRBRect(x, y, x + w, y + h), radius, radius);
  canvas.drawRRect(rrect, body);
  const flat = flattenGlassUniforms({
    size: [w, h], radius, lightDir: GLASS_LIGHT_DIR, press, dark: dark ? 1 : 0, strength: 1,
  });
  const paint = new ck.Paint();
  paint.setShader(glass.makeShader(flat));
  canvas.save();
  canvas.translate(x, y);
  canvas.drawRect(ck.LTRBRect(0, 0, w, h), paint);
  canvas.restore();
}
panel(110, 1040, 320, 76, 38); // tab bar
panel(40, 150, 460, 80, 28); // wide bar
panel(40, 70, 120, 56, 28); // pill
panel(190, 70, 56, 56, 28); // round
panel(270, 70, 56, 56, 28, true, 1); // round, pressed
panel(360, 70, 140, 56, 28, false); // light-theme panel

const png = surface.makeImageSnapshot().encodeToBytes(ck.ImageFormat.PNG);
fs.writeFileSync(out, png);
console.log(`Wrote ${out} (${W}x${H}) at t=${time}s`);
