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
//
// opts — schema groundwork: no committed caller exercises non-default values yet;
// brushstroke.composition (SPEC §4·3b, deferred) will drive these. With all defaults the
// output is identical to the pre-opts version. Levers (all optional):
//   seed     — override the host seed (a per-plate reseed re-randomizes placement)
//   scaleMul — own scale on top of the global frame scale (each field its own size)
//   count    — number of tuft clusters (density / open-space dial)
//   idOffset — palette rotation: shift this field's pigment ids so stacked fields overlap
//              in different colour families (the inter-plate translucency the test probes)
//   dx, dy   — fractional position offset of the whole scatter (−1..1 of W/H)
export function tuftMarks(W, H, seed, frameScale = 1, opts = {}) {
  const o = { scaleMul: 1, count: TUFT.count, idOffset: 0, dx: 0, dy: 0, ...opts };
  const rng = makeRng(o.seed ?? seed);
  const fs = frameScale * o.scaleMul;
  const offX = o.dx * W, offY = o.dy * H;
  const pad = 110 * fs;
  const marks = [];
  for (let t = 0; t < o.count; t++) {
    const cx = rng.rnd(pad, W - pad) + offX, cy = rng.rnd(pad, H - pad) + offY;
    const r = TUFT.radius * fs * (1 - rng.rnd(0, TUFT.jitter));
    const fullArc = 2 * Math.PI * TUFT.spread;
    const count = Math.max(3, Math.round(fullArc * r / (TUFT.spacing * fs)));
    const a0 = rng.rnd(0, 2 * Math.PI);
    const beh = t % 3;
    const grain = beh === 0 ? 0.85 : 0.20;
    const ko = beh === 1 ? 0.90 : 0.0;
    for (let i = 0; i < count; i++) {
      const a = a0 + (TUFT.spread >= 1 ? (i / count) : (i / (count - 1))) * fullArc;
      const dx = Math.cos(a), dy = Math.sin(a);
      const half = (TUFT.width * fs * 0.5) * 0.5 * (0.8 + rng.rnd(0, 0.4));
      const id = (i + t + o.idOffset) % NPAL;
      marks.push({
        kind: 'capsule', x: cx + dx * r, y: cy + dy * r, nx: dx, ny: dy, half,
        weight: TUFT.weight * fs, id, grain, ko, amount: 0.92, key: t + i / count,
      });
    }
  }
  marks.sort((a, b) => a.key - b.key);
  return marks;
}
