// Curl Vortex Field
// 25K particles flow through an animated layered-sine curl-noise field.
// Three simultaneous noise octaves create hair-thin threads, fluid strokes,
// and wide lazy sweeps — like ink dropped into slowly churning water.
//
// casberry.in: copy particleFn body; replace audio?.x with addControl() sliders.
//
// Audio mapping:
//   Centroid → noise scale  (bass notes = wide swirls, bright highs = fine vortices)
//   Bass     → field evolution speed
//   RMS      → particle velocity
//   Beat     → turbulence burst (+high-frequency noise layer)

export const name        = 'Curl Vortex';
export const description = 'Centroid \u2192 swirl \u00b7 Bass \u2192 speed \u00b7 Beat \u2192 burst \u00b7 RMS \u2192 glow';

// ── init: pre-allocate particle positions and lifetimes ──────────────────────
export function init(count) {
  const pos      = new Float32Array(count * 3);
  const age      = new Uint16Array(count);
  const lifespan = new Uint16Array(count);

  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 240;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 240;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 240;
    age[i]      = (Math.random() * 200) | 0;
    lifespan[i] = (150 + Math.random() * 200) | 0;
  }

  return { pos, age, lifespan };
}

// ── frame: advance all particle positions using curl-like velocity field ─────
export function frame(state, time, audio) {
  const { pos, age, lifespan } = state;
  const count = pos.length / 3;

  const bass     = audio ? audio.bass     : 0.15;
  const rms      = audio ? audio.rms      : 0.10;
  const beat     = audio ? audio.beat     : 0;
  const centroid = audio ? audio.centroid : 0.35;

  // Noise scale: centroid drives from wide swirls to tight vortices
  const ns   = 0.007 + centroid * 0.020;
  // Particle speed: energy drives velocity
  const spd  = 0.55 + rms * 2.8 + beat * 3.0;
  // Field evolution: bass drives how fast the field churns
  const evol = 0.16 + bass * 1.4;
  const t    = time * evol;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const px = pos[i3], py = pos[i3 + 1], pz = pos[i3 + 2];

    // Layered-sine curl approximation (6 trig ops per particle)
    const sx = px * ns, sy = py * ns, sz = pz * ns;
    let vx = Math.cos(sy + t * 1.31)       * Math.sin(sz * 0.71 + t * 0.53);
    let vy = Math.cos(sz + t * 0.91)       * Math.sin(sx * 0.83 + t * 0.67);
    let vz = Math.cos(sx * 0.63 + t * 1.1) * Math.sin(sy        + t * 0.43);

    // Beat turbulence: inject high-frequency layer on transients
    if (beat > 0.08) {
      const tb = beat * 2.5;
      vx += Math.cos(sy * 5.1 + t * 7.3) * Math.sin(sz * 4.2) * tb;
      vy += Math.cos(sz * 4.3 + t * 5.1) * Math.sin(sx * 5.0) * tb;
      vz += Math.cos(sx * 3.2 + t * 6.1) * Math.sin(sy * 4.1) * tb;
    }

    pos[i3]     += vx * spd;
    pos[i3 + 1] += vy * spd;
    pos[i3 + 2] += vz * spd;

    age[i]++;
    const oob = Math.abs(px) > 195 || Math.abs(py) > 195 || Math.abs(pz) > 195;
    if (age[i] >= lifespan[i] || oob) {
      // Respawn at random position
      pos[i3]     = (Math.random() - 0.5) * 220;
      pos[i3 + 1] = (Math.random() - 0.5) * 220;
      pos[i3 + 2] = (Math.random() - 0.5) * 220;
      age[i] = 0;
    }
  }
}

// ── particleFn: read position from state, output color ───────────────────────
export function particleFn(i, count, target, color, time, THREE, addControl, setInfo, annotate, audio, state) {
  if (i === 0) setInfo('Curl Vortex', 'Centroid \u2192 swirl \u00b7 Bass \u2192 speed \u00b7 Beat \u2192 burst');

  const bass = audio ? audio.bass : 0.15;
  const rms  = audio ? audio.rms  : 0.10;
  const beat = audio ? audio.beat : 0;

  const i3 = i * 3;
  const px = state.pos[i3], py = state.pos[i3 + 1], pz = state.pos[i3 + 2];
  target.set(px, py, pz);

  // Hue: azimuth angle around Y axis + time drift
  const angle = Math.atan2(py, px) / (Math.PI * 2) + 0.5;
  const h = ((0.57 + angle * 0.38 + time * 0.015 + bass * 0.12) % 1 + 1) % 1;
  const s = 0.80;
  const l = 0.03 + rms * 0.16 + beat * 0.20;
  color.setHSL(h, s, Math.min(l, 0.33));
}
