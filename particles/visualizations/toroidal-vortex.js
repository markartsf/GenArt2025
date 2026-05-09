// Toroidal Vortex — Particles flow along helical paths on a torus
// Bass → major radius breathing, Mid → flow speed, High → minor radius, Beat → scatter burst

const PHI = 1.618033988749895;

let phaseOffsets;

export function init(count) {
  phaseOffsets = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    phaseOffsets[i] = (i * PHI) % 1;   // golden ratio distribution
  }
  return { phaseOffsets };
}

export function frame() {
  // No per-frame simulation needed — all computed per-particle
}

export function particleFn(i, count, target, color, time, THREE, addControl, setInfo, annotate, audio, state) {
  if (i === 0) setInfo('Toroidal Vortex', 'Bass \u2192 size \u00b7 Mid \u2192 flow \u00b7 High \u2192 thickness \u00b7 Beat \u2192 scatter');

  const majorR   = addControl('major', 'Major Radius', 20, 120, 55);
  const minorR   = addControl('minor', 'Minor Radius', 5, 40, 18);
  const turns    = addControl('turns', 'Helix Turns', 2, 30, 12);
  const flowRate = addControl('flow', 'Flow Speed', 0.1, 3, 0.8);

  const bass = audio ? audio.bass : 0.12;
  const mid  = audio ? audio.mid  : 0.08;
  const high = audio ? audio.high : 0.03;
  const rms  = audio ? audio.rms  : 0.06;
  const beat = audio ? audio.beat : 0;

  const t = i / count;
  const phase = state.phaseOffsets[i];

  // Parametric torus with helical winding
  const theta = t * Math.PI * 2;                                     // around the ring
  const phi   = t * Math.PI * 2 * turns + time * flowRate * (1 + mid * 3) + phase * 6.2832;  // along the tube

  const R = majorR + bass * 35 + beat * 20;          // major radius breathes with bass
  const r = minorR + high * 15 + Math.sin(time * 0.3 + theta * 3) * 3;  // minor ripples

  // Torus parametric equations
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const cosPhi   = Math.cos(phi);
  const sinPhi   = Math.sin(phi);

  const x = (R + r * cosPhi) * cosTheta;
  const y = r * sinPhi;
  const z = (R + r * cosPhi) * sinTheta;

  // Beat scatter: particles briefly fly outward
  const scatter = beat * 15;
  const sx = x + Math.sin(phase * 50 + time * 3) * scatter;
  const sy = y + Math.cos(phase * 37 + time * 2.7) * scatter;
  const sz = z + Math.sin(phase * 43 + time * 3.1) * scatter;

  target.set(sx, sy, sz);

  // Color: hue follows position around ring, brightness from energy
  const h = (theta / (Math.PI * 2) + time * 0.03 + bass * 0.1) % 1;
  const s = 0.7 + high * 0.25;
  const l = 0.04 + rms * 0.12 + beat * 0.18;
  color.setHSL(((h % 1) + 1) % 1, Math.min(s, 1), Math.min(l, 0.35));
}
