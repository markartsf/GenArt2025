// Cosmic Web Filaments
// 25K particles orbit 8 dark-matter halos arranged on a golden-ratio sphere.
// Particles follow exponentially-distributed orbital radii (dense cores, sparse halos)
// mimicking how galaxies cluster around dark matter overdensities.
// Filament-like bridges emerge between neighboring halos through orbital overlap.
//
// casberry.in compatible: halo positions are stored in state (init).
// To use on casberry.in: compute halo positions inline (see haloXYZ function).
//
// Audio mapping:
//   Bass  → halo gravity (orbital speed at all radii)
//   High  → orbital eccentricity (near-circular ↔ elongated)
//   Mid   → inter-halo coupling (filament density)
//   Beat  → galactic wind burst (particles scatter radially)

export const name        = 'Cosmic Web';
export const description = 'Bass \u2192 gravity \u00b7 High \u2192 orbit shape \u00b7 Beat \u2192 galactic wind';

const N_HALOS = 8;
const PHI     = 1.6180339887498949;   // golden ratio

// One distinct hue per halo (spread across spectrum)
const HALO_HUES = [0.58, 0.68, 0.78, 0.12, 0.22, 0.38, 0.48, 0.02];

export function init() {
  // Place 8 halos on a sphere via Fibonacci/golden-angle lattice
  const hx = new Float32Array(N_HALOS);
  const hy = new Float32Array(N_HALOS);
  const hz = new Float32Array(N_HALOS);
  const R  = 95;

  for (let h = 0; h < N_HALOS; h++) {
    const y     = 1 - (h / (N_HALOS - 1)) * 2;          // -1 to +1
    const r     = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = h * PHI * Math.PI * 2;
    hx[h] = Math.cos(theta) * r * R;
    hy[h] = y * R;
    hz[h] = Math.sin(theta) * r * R;
  }

  return { hx, hy, hz };
}

export function frame() {}  // all motion is computed per-particle in particleFn

export function particleFn(i, count, target, color, time, THREE, addControl, setInfo, annotate, audio, state) {
  if (i === 0) setInfo('Cosmic Web', 'Bass \u2192 gravity \u00b7 High \u2192 orbit \u00b7 Beat \u2192 galactic wind');

  const spread = addControl('spread', 'Halo Spread', 40, 160, 95);

  const bass = audio ? audio.bass : 0.15;
  const mid  = audio ? audio.mid  : 0.10;
  const high = audio ? audio.high : 0.03;
  const rms  = audio ? audio.rms  : 0.10;
  const beat = audio ? audio.beat : 0;

  // ── Assign particle to a halo ─────────────────────────────────────────────
  const h       = i % N_HALOS;
  const pIdx    = (i / N_HALOS) | 0;
  const pCount  = (count / N_HALOS) | 0;
  const t       = pIdx / pCount;                          // 0→1 within halo

  // ── Orbital radius: exponential distribution (dense core, sparse halo) ───
  // -ln(1-t) gives exp distribution; cap at 65 to keep in scene
  const orbit_r = 3 + Math.min(-Math.log(1 - t * 0.97) * 18, 65);

  // ── Orbital plane: golden-angle tilt per particle for sphere coverage ────
  const phi_tilt = pIdx * PHI * Math.PI;
  const cosTilt  = Math.cos(phi_tilt);
  const sinTilt  = Math.sin(phi_tilt);
  const cosPlane = Math.cos(phi_tilt * 0.618);
  const sinPlane = Math.sin(phi_tilt * 0.618);

  // ── Orbital speed: Kepler-like (slower at larger radius) ─────────────────
  const omega = (0.40 + bass * 0.55) / Math.sqrt(orbit_r);

  // ── Orbital eccentricity driven by high frequencies ──────────────────────
  const ecc = 0.05 + high * 0.45;   // 0 = circular, 1 = highly eccentric
  const eccX = 1 + ecc;
  const eccZ = 1 - ecc;

  // ── Orbit in tilted ellipse ──────────────────────────────────────────────
  const angle = time * omega + phi_tilt;
  // Local orbital frame
  const lx = Math.cos(angle) * orbit_r * eccX;
  const ly = Math.sin(angle) * orbit_r * eccZ * 0.6;

  // Rotate local frame to tilted world space
  const wx = lx * cosTilt - ly * sinPlane;
  const wy = lx * sinTilt * 0.5 + ly * cosPlane;
  const wz = lx * sinTilt - ly * sinPlane * 0.5;

  // ── Inter-halo coupling: slight drift toward neighbor halos ──────────────
  // Neighbors: halos (h+1) and (h+7) mod 8
  const hn  = (h + 1) % N_HALOS;
  const dx  = state.hx[hn] - state.hx[h];
  const dy  = state.hy[hn] - state.hy[h];
  const dz  = state.hz[hn] - state.hz[h];
  const frac = mid * 0.12 * (orbit_r / 65);   // filament strength scales with radius
  const filX = dx * frac, filY = dy * frac, filZ = dz * frac;

  // ── Beat galactic wind: scatter radially from halo center ────────────────
  const windScale = beat * 35;
  const nx  = wx / Math.max(1, orbit_r);
  const ny  = wy / Math.max(1, orbit_r);
  const nz  = wz / Math.max(1, orbit_r);

  // ── Scale halo positions with spread control ─────────────────────────────
  const scaleFactor = spread / 95;
  const haloX = state.hx[h] * scaleFactor;
  const haloY = state.hy[h] * scaleFactor;
  const haloZ = state.hz[h] * scaleFactor;

  target.set(
    haloX + wx + filX + nx * windScale,
    haloY + wy + filY + ny * windScale,
    haloZ + wz + filZ + nz * windScale
  );

  // ── Color: hue from halo identity, brightness from orbital energy ─────────
  const h_hue = (HALO_HUES[h] + time * 0.006) % 1;
  const coreBrightness = Math.max(0, 1 - orbit_r / 65);   // brightest at core
  const l = 0.03 + coreBrightness * 0.24 + rms * 0.10 + beat * 0.18;
  color.setHSL(h_hue, 0.80 + high * 0.15, Math.min(l, 0.36));
}
