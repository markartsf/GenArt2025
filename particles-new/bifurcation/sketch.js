// Bifurcation Cascade
// 25K particles trace the logistic map bifurcation diagram in real time.
// Each particle is assigned an r parameter value; the logistic map
// x(n+1) = r·x(n)·(1-x(n)) is iterated to reveal the attractor.
// Watch period-doubling cascade into chaos as r crosses 3.57.
//
// casberry.in compatible: PURELY FUNCTIONAL — no state needed.
// Copy particleFn body to casberry.in; replace audio?.x with addControl().
//
// Audio mapping:
//   Bass  → r-axis offset (slides diagram toward or away from chaos)
//   Mid   → Z animation speed (depth breathing)
//   RMS   → particle brightness
//   Beat  → briefly expands to full chaos range r=4.0

export const name        = 'Bifurcation Cascade';
export const description = 'Bass \u2192 r shift \u00b7 Mid \u2192 depth \u00b7 Beat \u2192 chaos burst';

// No simulation state needed — all pure math per particle
export function init() { return {}; }
export function frame() {}

export function particleFn(i, count, target, color, time, THREE, addControl, setInfo, annotate, audio, state) {
  if (i === 0) setInfo('Bifurcation Cascade', 'Bass \u2192 r shift \u00b7 Mid \u2192 depth \u00b7 Beat \u2192 chaos burst');

  const scale   = addControl('scale', 'Scale',    60, 220, 130);
  const warmup  = addControl('iter',  'Warmup',   40, 120,  70) | 0;

  const bass = audio ? audio.bass : 0.15;
  const mid  = audio ? audio.mid  : 0.10;
  const rms  = audio ? audio.rms  : 0.10;
  const beat = audio ? audio.beat : 0;

  // ── Parameter assignment ─────────────────────────────────────────────────
  // 2500 r-values × 10 attractor samples = 25 000 particles
  const ROWS = 10;
  const COLS = (count / ROWS) | 0;  // 2500

  const col = i % COLS;              // which r value
  const row = (i / COLS) | 0;       // which sample point

  // r range: [2.5, 4.0]; beat expands max toward 4.3 briefly
  const R_MIN = 2.5;
  const R_MAX = 4.0 + beat * 0.3 + bass * 0.15;
  const r = R_MIN + (col / COLS) * (R_MAX - R_MIN);

  // ── Iterate logistic map ─────────────────────────────────────────────────
  // Warmup (discarded) then collect sample at step = warmup + row
  let x = 0.5 + row * 0.001;   // slight per-row seed variation avoids lock-step
  const totalIter = warmup + row + 1;
  for (let k = 0; k < totalIter; k++) {
    x = r * x * (1 - x);
  }
  // Clamp to valid range in case of numerical edge cases
  x = Math.max(0, Math.min(1, x));

  // ── 3D layout ────────────────────────────────────────────────────────────
  const px3 = (col / COLS - 0.5) * scale * 2.2;
  const py3 = (x   - 0.5)        * scale;
  // Z: depth wave animates with time + mid, giving a "breathing" 3D effect
  const pz3 = Math.sin(row * 0.65 + time * (0.28 + mid * 1.6) + bass * 2.5) * scale * 0.38;

  target.set(px3, py3, pz3);

  // ── Color ────────────────────────────────────────────────────────────────
  // Hue: blue in stable region → red in chaos
  const chaos = Math.max(0, (r - 3.0) / 1.0);   // 0 at period-2, 1 at chaos
  const h = 0.62 - chaos * 0.56;                 // deep blue → red
  const s = 0.75 + chaos * 0.20;
  const l = 0.04 + Math.abs(x - 0.5) * 0.28 + rms * 0.12 + beat * 0.16;
  color.setHSL(Math.max(0, h), Math.min(s, 1), Math.min(l, 0.36));
}
