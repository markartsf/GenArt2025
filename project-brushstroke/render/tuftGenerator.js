// Tuft generator — Form layer. Places many Brush marks (Teeth) into one composite.
// Geometry lifted from the M3 spikes; now emits FLAT, reveal-ordered marks (the mark
// model in recipeMask.js) so the composition host can stamp them append-only.
//
// Each mark: { kind:'capsule', x,y,nx,ny,half,weight, id, grain, ko, amount, key }.
// recipeMask.stampMark consumes it and knows nothing about Tuft — that is the seam
// the remaining generators (wash, accent, later Bloom/Burst) repeat: emit marks,
// reuse the stamper + the compositor.
import { makeRng } from './rng.js';
import { NPAL } from './palette.js';

// Small mark scale relative to the frame (DESIGN #7): radius/weight stay small; the
// scatter spreads many fine tufts across the ground rather than filling it.
export const TUFT = { count: 11, radius: 64, spread: 1.0, jitter: 0.45, spacing: 12, weight: 9, width: 120 };

// One scatter of tufts → flat recipe-coded marks, deterministic per seed.
// grain/ko vary per tuft (beh = t % 3) so a single plate exercises all recipe channels:
//   beh 0 → grainy (G high) · beh 1 → knockout (B high) · beh 2 → plain (clean KM mix)
export function tuftMarks(W, H, seed, frameScale = 1) {
  const rng = makeRng(seed);
  const pad = 110 * frameScale;
  const marks = [];
  for (let t = 0; t < TUFT.count; t++) {
    const cx = rng.rnd(pad, W - pad), cy = rng.rnd(pad, H - pad);
    const r = TUFT.radius * frameScale * (1 - rng.rnd(0, TUFT.jitter));
    const fullArc = 2 * Math.PI * TUFT.spread;
    const count = Math.max(3, Math.round(fullArc * r / (TUFT.spacing * frameScale)));
    const a0 = rng.rnd(0, 2 * Math.PI);
    const beh = t % 3;
    const grain = beh === 0 ? 0.85 : 0.20;
    const ko = beh === 1 ? 0.90 : 0.0;
    for (let i = 0; i < count; i++) {
      const a = a0 + (TUFT.spread >= 1 ? (i / count) : (i / (count - 1))) * fullArc;
      const dx = Math.cos(a), dy = Math.sin(a);
      const half = (TUFT.width * frameScale * 0.5) * 0.5 * (0.8 + rng.rnd(0, 0.4));
      const id = (i + t) % NPAL;
      marks.push({
        kind: 'capsule', x: cx + dx * r, y: cy + dy * r, nx: dx, ny: dy, half,
        weight: TUFT.weight * frameScale, id, grain, ko, amount: 0.92, key: t + i / count,
      });
    }
  }
  marks.sort((a, b) => a.key - b.key);
  return marks;
}
