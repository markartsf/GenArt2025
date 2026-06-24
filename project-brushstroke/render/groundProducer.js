// Ground producer — plate 0, the swappable quiet base (DESIGN #8 "quiet grounds").
// The ground is a REAL plate (an opaque RGB canvas the compositor uploads as
// cacheTex[0]), not a flat uniform — that is what makes it swappable + tunable.
//
// Default: flat cream + low-amplitude monochrome noise at neutral contrast, so fine
// marks read against it without the ground competing. Image-ready: pass an `image`
// (a runtime-loaded background plate) and it is drawn to fill, with the same quiet
// noise/contrast pass applied over it. No background plate ships in the repo — the
// image path is a runtime file-load (DESIGN #8: flat cream is the committed default).
import { CREAM } from './palette.js';
import { makeRng } from './rng.js';

export const GROUND_DEFAULTS = { noise: 0.035, contrast: 0, seed: 7, image: null };

export function buildGround(W, H, opts = {}) {
  const o = { ...GROUND_DEFAULTS, ...opts };
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (o.image) {
    // cover-fit the loaded plate, then quiet it down with the same noise/contrast pass
    const s = Math.max(W / o.image.width, H / o.image.height);
    const dw = o.image.width * s, dh = o.image.height * s;
    g.drawImage(o.image, (W - dw) / 2, (H - dh) / 2, dw, dh);
    if (o.contrast) applyContrast(g, W, H, o.contrast);
  } else {
    g.fillStyle = `rgb(${CREAM[0]},${CREAM[1]},${CREAM[2]})`;
    g.fillRect(0, 0, W, H);
  }
  if (o.noise > 0) addQuietNoise(g, W, H, o.noise, o.seed);
  return c;
}

// per-pixel monochrome jitter, seeded (runs once per ground build — full retina is fine)
function addQuietNoise(g, W, H, amt, seed) {
  const img = g.getImageData(0, 0, W, H), d = img.data, rng = makeRng(seed), a = amt * 255;
  for (let i = 0; i < d.length; i += 4) {
    const n = rng.rnd(-1, 1) * a;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

// linear contrast around mid-grey; amt < 0 softens (quiet), amt > 0 hardens
function applyContrast(g, W, H, amt) {
  const img = g.getImageData(0, 0, W, H), d = img.data, f = 1 + amt;
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = 128 + (d[i + k] - 128) * f;
  g.putImageData(img, 0, 0);
}
