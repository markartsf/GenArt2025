// Rössler Bloom
// Five simultaneous Rössler strange attractors with different chaos parameters,
// each generating a 5000-point ring-buffer trail. The result is a bouquet of
// interleaved chaotic ribbons that breathe and writhe with the music.
//
// casberry.in: this viz requires ring-buffer state; for casberry.in use the
// standalone parametric version below (see commented block at bottom).
//
// Audio mapping:
//   Bass  → a param (spiral tightness, 0.2 baseline)
//   Mid   → b param (tube width, 0.2 baseline)
//   High  → c param (chaos depth, ±12% of each attractor's base)
//   RMS   → steps/frame (more energy = faster trace)

export const name        = 'R\u00f6ssler Bloom';
export const description = 'Bass \u2192 spiral \u00b7 Mid \u2192 tube \u00b7 High \u2192 chaos \u00b7 RMS \u2192 speed';

const NUM_A    = 5;
const TRAIL    = 5000;   // 5 × 5000 = 25 000 total particles
const DT       = 0.05;

// Base c params: from periodic (3.5) to chaotic (7.0)
const C_BASE = [3.5, 4.5, 5.7, 6.3, 7.0];
// Distinct hues per attractor: red, gold, green, sky, violet
const HUES   = [0.0, 0.11, 0.33, 0.57, 0.73];

export function init(count) {
  const px   = new Float32Array(NUM_A * TRAIL);
  const py   = new Float32Array(NUM_A * TRAIL);
  const pz   = new Float32Array(NUM_A * TRAIL);
  const head = new Int32Array(NUM_A);        // ring-buffer write heads
  const cx   = new Float32Array(NUM_A);      // current integrator state
  const cy   = new Float32Array(NUM_A);
  const cz   = new Float32Array(NUM_A);

  // Pre-warm each attractor so trails are populated from frame 0
  for (let a = 0; a < NUM_A; a++) {
    let x = 0.1 + a * 0.05, y = 0, z = a * 0.2;
    const c = C_BASE[a];
    for (let step = 0; step < TRAIL; step++) {
      const dx = -y - z;
      const dy = x + 0.2 * y;
      const dz = 0.2 + z * (x - c);
      x += dx * DT; y += dy * DT; z += dz * DT;
      // Hard bounds guard — Rössler is bounded for these params, but be safe
      if (!isFinite(x) || Math.abs(z) > 300) { x = 0.1 + a * 0.05; y = 0; z = 0.1; }
      px[a * TRAIL + step] = x;
      py[a * TRAIL + step] = y;
      pz[a * TRAIL + step] = z;
    }
    cx[a] = x; cy[a] = y; cz[a] = z;
    head[a] = 0;
  }

  return { px, py, pz, head, cx, cy, cz };
}

export function frame(state, time, audio) {
  const bass = audio ? audio.bass : 0.15;
  const mid  = audio ? audio.mid  : 0.10;
  const high = audio ? audio.high : 0.03;
  const rms  = audio ? audio.rms  : 0.10;

  // Steps per frame scales with energy (more music = faster trace)
  const steps = Math.max(1, Math.round(1 + rms * 9));

  for (let a = 0; a < NUM_A; a++) {
    let x = state.cx[a], y = state.cy[a], z = state.cz[a];

    // Audio modulates ODE params — keep within stable ranges
    const ac = 0.2 * (1 + bass * 0.7);
    const bc = 0.2 * (1 + mid  * 0.5);
    const cc = C_BASE[a] * (1 + high * 0.12);

    for (let s = 0; s < steps; s++) {
      const dx = -y - z;
      const dy = x + ac * y;
      const dz = bc + z * (x - cc);
      x += dx * DT; y += dy * DT; z += dz * DT;
      if (!isFinite(x) || Math.abs(z) > 300) { x = 0.1 + a * 0.05; y = 0; z = 0.1; }

      const writePos = state.head[a];
      const idx = a * TRAIL + writePos;
      state.px[idx] = x; state.py[idx] = y; state.pz[idx] = z;
      state.head[a] = (writePos + 1) % TRAIL;
    }

    state.cx[a] = x; state.cy[a] = y; state.cz[a] = z;
  }
}

export function particleFn(i, count, target, color, time, THREE, addControl, setInfo, annotate, audio, state) {
  if (i === 0) setInfo('R\u00f6ssler Bloom', 'Bass \u2192 spiral \u00b7 Mid \u2192 tube \u00b7 High \u2192 chaos \u00b7 RMS \u2192 speed');

  const scale = addControl('scale', 'Scale', 4, 25, 10);
  const rms   = audio ? audio.rms  : 0.10;
  const beat  = audio ? audio.beat : 0;

  const a        = i % NUM_A;
  const trailPos = (i / NUM_A) | 0;

  // Ring-buffer read: newest point at trailPos=0, oldest at TRAIL-1
  const readPos = (state.head[a] - trailPos - 1 + TRAIL) % TRAIL;
  const idx     = a * TRAIL + readPos;

  target.set(
    state.px[idx] * scale,
    state.py[idx] * scale,
    state.pz[idx] * scale
  );

  // Age fade: tip is bright, tail dims
  const age = trailPos / TRAIL;
  const h   = (HUES[a] + time * 0.008) % 1;
  const l   = 0.03 + (1 - age) * 0.22 + rms * 0.12 + beat * 0.16;
  color.setHSL(h, 0.88, Math.min(l, 0.38));
}
