// Wash generator — Form layer, the broad quiet underlay (plate beneath the hero).
// Emits a FEW big, soft, LOW-COVERAGE 'wash' marks in a muted, ground-tuned palette
// colour, knockout off, so the KM compositor mixes them gently into the ground —
// a soft tonal breath under the marks, not a competing field (DESIGN #4/#8).
//
// Coverage (not alpha) carries the dim: each wash is a radial coverage falloff
// (see recipeMask 'wash'), and the pigment is muted so the low-coverage tail fades
// to ground without the saturated-pigment KM speckle (PATTERNS gradient-edge note).
import { makeRng } from './rng.js';

// id 5 (#74a7fe, soft cool blue) reads as a quiet wash on warm cream; tunable in commit 4.
export const WASH = { count: 3, rFracMin: 0.26, rFracMax: 0.52, amount: 0.20, id: 5 };

// opts — schema groundwork (no committed caller uses non-defaults yet; brushstroke.composition
// will drive these; defaults reproduce prior output). On top of WASH (count/rFrac/amount/id):
// a `seed` override (a 2nd wash at a different seed lands elsewhere) + `dx,dy` fractional offset.
export function washMarks(W, H, seed, frameScale = 1, opts = {}) {
  const o = { ...WASH, dx: 0, dy: 0, ...opts };
  const rng = makeRng(o.seed ?? seed);
  const minWH = Math.min(W, H);
  const offX = o.dx * W, offY = o.dy * H;
  const marks = [];
  for (let i = 0; i < o.count; i++) {
    const r = minWH * (o.rFracMin + rng.rnd(0, o.rFracMax - o.rFracMin));
    marks.push({
      kind: 'wash', x: rng.rnd(r * 0.35, W - r * 0.35) + offX, y: rng.rnd(r * 0.35, H - r * 0.35) + offY,
      r, id: o.id, grain: 0, ko: 0, amount: o.amount, key: i,
    });
  }
  return marks;
}
