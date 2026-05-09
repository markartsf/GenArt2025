// 3D Cymatics — Standing wave interference patterns
// Particles on a grid displaced by superimposed circular waves
// Bass → amplitude, Mid → speed, High → frequency, Beat → new wave burst

const GRID = 158;   // 158*158 = 24,964 particles
const SOURCES = 5;

let srcX, srcY, srcAmp, srcFreq, srcSpeed;

export function init(count) {
  srcX     = new Float32Array(SOURCES);
  srcY     = new Float32Array(SOURCES);
  srcAmp   = new Float32Array(SOURCES);
  srcFreq  = new Float32Array(SOURCES);
  srcSpeed = new Float32Array(SOURCES);

  // Seed sources in a ring
  for (let s = 0; s < SOURCES; s++) {
    const angle = (s / SOURCES) * Math.PI * 2;
    srcX[s] = Math.cos(angle) * 30;
    srcY[s] = Math.sin(angle) * 30;
    srcAmp[s]   = 8;
    srcFreq[s]  = 0.08 + s * 0.02;
    srcSpeed[s] = 2 + s * 0.5;
  }

  return { srcX, srcY, srcAmp, srcFreq, srcSpeed };
}

export function frame(state, time, audio) {
  const bass = audio ? audio.bass : 0.15;
  const mid  = audio ? audio.mid  : 0.10;
  const high = audio ? audio.high : 0.05;
  const beat = audio ? audio.beat : 0;

  for (let s = 0; s < SOURCES; s++) {
    // Sources orbit slowly, audio shifts their position
    const angle = (s / SOURCES) * Math.PI * 2 + time * 0.15;
    const r = 25 + bass * 20 + beat * 15;
    state.srcX[s] = Math.cos(angle) * r;
    state.srcY[s] = Math.sin(angle) * r;

    // Audio drives wave properties
    state.srcAmp[s]   = 5 + bass * 20 + beat * 12;
    state.srcFreq[s]  = 0.06 + high * 0.12 + s * 0.015;
    state.srcSpeed[s] = 1.5 + mid * 4 + s * 0.3;
  }
}

export function particleFn(i, count, target, color, time, THREE, addControl, setInfo, annotate, audio, state) {
  if (i === 0) setInfo('3D Cymatics', 'Bass \u2192 amplitude \u00b7 Mid \u2192 speed \u00b7 High \u2192 frequency \u00b7 Beat \u2192 burst');

  const spacing = addControl('space', 'Spacing', 0.3, 1.5, 0.65);
  const amp     = addControl('amp', 'Amplitude', 0.5, 3, 1.0);

  const gx = i % GRID;
  const gy = (i / GRID) | 0;
  const x = (gx - GRID * 0.5) * spacing;
  const z = (gy - GRID * 0.5) * spacing;

  // Superimpose circular waves from all sources
  let y = 0;
  for (let s = 0; s < SOURCES; s++) {
    const dx = x - state.srcX[s];
    const dz = z - state.srcY[s];
    const dist = Math.sqrt(dx * dx + dz * dz);
    y += state.srcAmp[s] * Math.sin(dist * state.srcFreq[s] - time * state.srcSpeed[s]) / (1 + dist * 0.03);
  }
  y *= amp;

  target.set(x, y, z);

  // Color from displacement height
  const ny = y * 0.03;
  const h = (0.55 + ny * 0.15 + time * 0.02) % 1;
  const s2 = 0.6 + Math.abs(ny) * 0.3;
  const l = 0.04 + Math.abs(ny) * 0.18 + (audio ? audio.beat * 0.15 : 0);
  color.setHSL(((h % 1) + 1) % 1, Math.min(s2, 1), Math.min(l, 0.35));
}
