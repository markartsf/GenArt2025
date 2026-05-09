// Lorenz Attractor — 3 interleaved strange attractors
// Bass drives rho (chaos), mid drives sigma (speed), high drives beta (tightness)
// Per MEMORY.md: keep param variation to +/-15% max, DT=0.018

const DT = 0.018;
const TRAIL_LEN = 3500;    // points per attractor
const N_ATT = 3;

let trails;  // Float32Array(N_ATT * TRAIL_LEN * 3)
let heads;   // ring buffer head per attractor
let lx, ly, lz;  // current Lorenz state per attractor

export function init(count) {
  trails = new Float32Array(N_ATT * TRAIL_LEN * 3);
  heads  = new Int32Array(N_ATT);

  lx = new Float32Array(N_ATT);
  ly = new Float32Array(N_ATT);
  lz = new Float32Array(N_ATT);

  // Seed attractors at slightly different positions
  for (let a = 0; a < N_ATT; a++) {
    lx[a] = 0.1 + a * 0.5;
    ly[a] = 0.1 + a * 0.3;
    lz[a] = 0.1 + a * 0.7;
    heads[a] = 0;
  }

  return { trails, heads, lx, ly, lz };
}

export function frame(state, time, audio) {
  const bass = audio ? audio.bass : 0.15;
  const mid  = audio ? audio.mid  : 0.10;
  const high = audio ? audio.high : 0.05;
  const rms  = audio ? audio.rms  : 0.08;

  // Steps per frame scales with energy
  const steps = (3 + rms * 18) | 0;

  for (let a = 0; a < N_ATT; a++) {
    // Audio-driven params (±15% variation from classical)
    const sigma = 10   * (1 + (a === 0 ? bass : a === 1 ? mid : high) * 0.15);
    const rho   = 28   * (1 + (a === 0 ? bass : a === 1 ? mid : high) * 0.15);
    const beta  = 2.667 * (1 + (a === 2 ? high : a === 1 ? mid : bass) * 0.10);

    for (let s = 0; s < steps; s++) {
      const x = state.lx[a], y = state.ly[a], z = state.lz[a];
      const dx = sigma * (y - x) * DT;
      const dy = (x * (rho - z) - y) * DT;
      const dz = (x * y - beta * z) * DT;
      state.lx[a] = x + dx;
      state.ly[a] = y + dy;
      state.lz[a] = z + dz;

      // Write to ring buffer
      const head = state.heads[a];
      const base = (a * TRAIL_LEN + head) * 3;
      state.trails[base]     = state.lx[a];
      state.trails[base + 1] = state.ly[a];
      state.trails[base + 2] = state.lz[a];
      state.heads[a] = (head + 1) % TRAIL_LEN;
    }
  }
}

export function particleFn(i, count, target, color, time, THREE, addControl, setInfo, annotate, audio, state) {
  if (i === 0) setInfo('Lorenz Attractor', 'Bass \u2192 rho \u00b7 Mid \u2192 sigma \u00b7 High \u2192 beta \u00b7 RMS \u2192 speed');

  const scale = addControl('scale', 'Scale', 0.5, 4, 1.5);
  const rotSpeed = addControl('rot', 'Rotation', 0, 2, 0.3);

  const beat = audio ? audio.beat : 0;

  // Assign particle to attractor and trail position
  const a = (i * N_ATT / count) | 0;              // which attractor (0,1,2)
  const localIdx = i - ((a * count / N_ATT) | 0); // index within this attractor's share
  const trailPos = localIdx % TRAIL_LEN;

  // Read from ring buffer
  const head = state.heads[a];
  const idx = (head - trailPos + TRAIL_LEN) % TRAIL_LEN;
  const base = (a * TRAIL_LEN + idx) * 3;

  let px = state.trails[base]     * scale;
  let py = state.trails[base + 1] * scale;
  let pz = state.trails[base + 2] * scale;

  // Rotate around Y axis
  const angle = time * rotSpeed;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const rx = px * cosA - pz * sinA;
  const rz = px * sinA + pz * cosA;

  target.set(rx, py - 40, rz);

  // Color per attractor: bass=orange-red, mid=gold, high=violet
  const hues = [0.04, 0.12, 0.75];
  const age  = trailPos / TRAIL_LEN;
  const lum  = 0.03 + (1 - age) * 0.22 + beat * 0.18;
  color.setHSL(hues[a], 0.85 - age * 0.3, Math.min(lum, 0.38));
}
