// Tuft generator — Form layer. Places many Brush marks (Teeth) into one composite.
// Geometry lifted verbatim from the M3 spikes (tuft-shader-spike / mask-ab Panel B).
//
// Emits generator-agnostic TEETH: each tooth is { s, id, grain, ko, amount }, where
//   s      = station { x, y, nx, ny, half }  (position, normal, half-length)
//   id     = palette index (→ mask.R)
//   grain  = grain amount   0..1             (→ mask.G, shader honours procedurally)
//   ko     = knockout strength 0..1          (→ mask.B, shader hard-replaces)
//   amount = coverage / KM concentration     (→ mask.A)
//
// recipeMask.buildMask consumes this flat list and knows nothing about Tuft — that
// is the seam the remaining generators repeat: emit teeth, reuse mask + compositor.
import { makeRng } from './rng.js';
import { NPAL } from './palette.js';

// Small mark scale relative to the frame (DESIGN #7): radius/weight stay small; the
// scatter spreads many fine tufts across the ground rather than filling it.
export const TUFT = { count: 11, radius: 64, spread: 1.0, jitter: 0.45, spacing: 12, weight: 9, width: 120 };

function makeTuftStations(rng, cx, cy, radius, spreadFrac) {
  const R0 = radius, fullArc = 2 * Math.PI * spreadFrac;
  const count = Math.max(3, Math.round(fullArc * R0 / TUFT.spacing));
  const out = [];
  const a0 = rng.rnd(0, 2 * Math.PI);
  for (let i = 0; i < count; i++) {
    const a = a0 + (spreadFrac >= 1 ? (i / count) * fullArc : (i / (count - 1)) * fullArc);
    const dx = Math.cos(a), dy = Math.sin(a);
    // tooth half-length frozen at build so the mark extent is deterministic per seed
    const half = (TUFT.width * 0.5) * 0.5 * (0.8 + rng.rnd(0, 0.4));
    out.push({ x: cx + dx * R0, y: cy + dy * R0, nx: dx, ny: dy, half });
  }
  return out;
}

// One scatter of tufts → a flat list of recipe-coded teeth, deterministic per seed.
// grain/ko vary per tuft (beh = t % 3) so a SINGLE plate exercises all recipe channels:
//   beh 0 → grainy   (G high)
//   beh 1 → knockout (B high)
//   beh 2 → plain    (clean KM mix)
export function tuftTeeth(W, H, seed, frameScale = 1) {
  const rng = makeRng(seed);
  const pad = 110 * frameScale;
  const teeth = [];
  for (let t = 0; t < TUFT.count; t++) {
    const cx = rng.rnd(pad, W - pad), cy = rng.rnd(pad, H - pad);
    const r = TUFT.radius * frameScale * (1 - rng.rnd(0, TUFT.jitter));
    const stations = makeTuftStations(rng, cx, cy, r, TUFT.spread);
    const beh = t % 3;
    const grain = beh === 0 ? 0.85 : 0.20;
    const ko = beh === 1 ? 0.90 : 0.0;
    for (let i = 0; i < stations.length; i++) {
      const id = (i + t) % NPAL;
      teeth.push({ s: stations[i], id, grain, ko, amount: 0.92 });
    }
  }
  return teeth;
}

// weight scales with the frame so marks stay proportionally small at any resolution
export const toothWeight = (frameScale = 1) => TUFT.weight * frameScale;
