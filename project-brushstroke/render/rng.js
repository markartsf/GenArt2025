// Deterministic seeded RNG (LCG) — verbatim mechanism from the M3 spikes.
// One stray Math.random() breaks reproducibility; keep all stochastic structure here.
export function makeRng(seed) {
  let _s = (seed >>> 0) || 1;
  const srand = () => { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296; };
  const reseed = (s) => { _s = (s >>> 0) || 1; };
  const rnd = (a = 1, b) => { if (b === undefined) { b = a; a = 0; } return a + srand() * (b - a); };
  return { srand, reseed, rnd };
}
