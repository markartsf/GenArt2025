// Accent generator — Form layer, the see-through spray/stipple top pass.
// Emits many tiny jittered 'dot' marks clustered into a few spray clouds, with
// probabilistic skip — grain is the DISTRIBUTION of discrete stamps, not a noise
// texture over strokes (PATTERNS → Owned pigment pipeline). KM-mixed over the
// opaque hero at modest per-dot coverage, the gaps between dots let the hero show
// through: the texture is see-through by sparsity, not by alpha on a mark.
//
// dotSize (base stamp radius) + amount are the accent's own levers (wired live in
// the control surface). Dots run FINER than the first grain pass (PATTERNS: it ran
// too large). All values here are placeholders the control surface overrides.
import { makeRng } from './rng.js';

export const ACCENT = {
  clouds: 6,          // a few deliberate spray clusters, not all-over noise
  perCloud: 520,      // dots attempted per cloud (before skip)
  fieldRFrac: 0.16,   // cloud radius as a fraction of min(W,H)
  dotSize: 1.4,       // base dot radius (×frameScale) — fine stipple
  dotJitter: 1.6,     // extra radius randomisation (×frameScale)
  amount: 0.55,       // per-dot KM coverage
  skip: 0.35,         // probabilistic omission → grainy distribution
  id: 4,              // muted teal accent; tunable via palette/control surface
};

export function accentMarks(W, H, seed, frameScale = 1, opts = {}) {
  const o = { ...ACCENT, ...opts };
  const rng = makeRng(seed);
  const minWH = Math.min(W, H), pad = 120 * frameScale;
  const fieldR = minWH * o.fieldRFrac;
  const marks = [];
  for (let c = 0; c < o.clouds; c++) {
    const cx = rng.rnd(pad, W - pad), cy = rng.rnd(pad, H - pad);
    for (let i = 0; i < o.perCloud; i++) {
      if (rng.rnd(0, 1) < o.skip) continue;                 // probabilistic skip = grain
      const a = rng.rnd(0, 2 * Math.PI);
      const rr = fieldR * Math.pow(rng.rnd(0, 1), 0.7);      // denser toward the centre
      const r = (o.dotSize + rng.rnd(0, o.dotJitter)) * frameScale;
      marks.push({
        kind: 'dot', x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, r,
        id: o.id, grain: 0, ko: 0, amount: o.amount, key: c + i / o.perCloud,
      });
    }
  }
  marks.sort((a, b) => a.key - b.key);
  return marks;
}
