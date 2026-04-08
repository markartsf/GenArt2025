// Particle Storm
// 25K particles swirl through 4 orbiting vortex centers with curl-noise turbulence.
// Velocity-based physics give particles momentum and inertia.
// Mouse repels particles; beats trigger explosive bursts.
//
// Audio mapping:
//   Bass     → turbulence scale + strength (low rumble = wide chaos)
//   Mid      → swirl/rotation speed around vortex centers
//   High     → fine-detail noise layer + color temperature shift
//   Beat     → explosive radial burst from random vortex
//   RMS      → field evolution speed, particle brightness
//   Centroid → vortex pull tightness

export const name        = 'Particle Storm';
export const description = 'Bass → turbulence · Mid → swirl · Beat → burst · Mouse → repel';

const N_VORTEX   = 4;
const HALF_PI    = Math.PI * 0.5;
const TWO_PI     = Math.PI * 2;
const VORTEX_HUES = [0.75, 0.60, 0.48, 0.85]; // violet, blue, cyan-teal, magenta
const DAMPING    = 0.96;
const BOUNDS     = 250;
const SPAWN_R    = 220;
const MOUSE_R    = 60;

export function init(count) {
  const pos      = new Float32Array(count * 3);
  const vel      = new Float32Array(count * 3);
  const age      = new Uint16Array(count);
  const lifespan = new Uint16Array(count);
  const group    = new Uint8Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    pos[i3]     = (Math.random() - 0.5) * SPAWN_R;
    pos[i3 + 1] = (Math.random() - 0.5) * SPAWN_R;
    pos[i3 + 2] = (Math.random() - 0.5) * SPAWN_R;
    age[i]      = (Math.random() * 300) | 0;
    lifespan[i] = (200 + Math.random() * 300) | 0;
    group[i]    = i % N_VORTEX;
  }

  const state = {
    pos, vel, age, lifespan, group,
    mouseX: 0, mouseY: 0, mouseActive: false,
    burstTimer: 0,
    burstOX: 0, burstOY: 0, burstOZ: 0,
    // Vortex center positions (computed each frame)
    vx: new Float32Array(N_VORTEX),
    vy: new Float32Array(N_VORTEX),
    vz: new Float32Array(N_VORTEX),
    prevTime: 0,
  };

  // Mouse tracking
  const canvas = document.getElementById('canvas');
  if (canvas) {
    canvas.addEventListener('mousemove', (e) => {
      state.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      state.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      state.mouseActive = true;
    });
    canvas.addEventListener('mouseleave', () => {
      state.mouseActive = false;
    });
    canvas.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      state.mouseX = (t.clientX / window.innerWidth) * 2 - 1;
      state.mouseY = -(t.clientY / window.innerHeight) * 2 + 1;
      state.mouseActive = true;
    }, { passive: true });
    canvas.addEventListener('touchend', () => {
      state.mouseActive = false;
    });
  }

  return state;
}

export function frame(state, time, audio) {
  const { pos, vel, age, lifespan, group, vx, vy, vz } = state;
  const count = pos.length / 3;

  const bass     = audio ? audio.bass     : 0.15;
  const mid      = audio ? audio.mid      : 0.10;
  const high     = audio ? audio.high     : 0.05;
  const rms      = audio ? audio.rms      : 0.10;
  const beat     = audio ? audio.beat     : 0;
  const centroid = audio ? audio.centroid : 0.35;

  // Delta time (capped to prevent huge jumps)
  const dt = Math.min(time - (state.prevTime || time), 0.05);
  state.prevTime = time;
  if (dt <= 0) return;

  // ── Controls (read once per frame) ─────────────────────────────────────
  // These will be populated by particleFn on first call; use defaults here
  const turbMult    = state._turbulence   || 1.0;
  const vortexR     = state._vortexRadius || 40;
  const mouseForce  = state._mouseForce   || 2.0;

  // ── Compute vortex centers ─────────────────────────────────────────────
  const orbitSpeed = 0.15 + mid * 0.35;
  for (let k = 0; k < N_VORTEX; k++) {
    const angle = time * orbitSpeed + k * HALF_PI;
    vx[k] = Math.cos(angle) * vortexR;
    vy[k] = Math.sin(time * 0.7 + k * 1.3) * 25;
    vz[k] = Math.sin(angle) * vortexR;
  }

  // ── Turbulence parameters ──────────────────────────────────────────────
  const ns   = 0.005 + bass * 0.015;      // noise scale
  const tStr = (0.3 + bass * 2.0) * turbMult;  // turbulence strength
  const evol = 0.16 + rms * 1.4;          // field evolution speed
  const t    = time * evol;

  // ── Swirl strength ─────────────────────────────────────────────────────
  const swirlStr = 0.3 + mid * 1.5;

  // ── Vortex pull ────────────────────────────────────────────────────────
  const pullStr = 0.01 + centroid * 0.04;

  // ── Mouse world position ───────────────────────────────────────────────
  const mwx = state.mouseX * 120;
  const mwy = state.mouseY * 120;

  // ── Beat burst ─────────────────────────────────────────────────────────
  if (beat > 0.3 && state.burstTimer < 0.1) {
    const bk = (Math.random() * N_VORTEX) | 0;
    state.burstOX = vx[bk];
    state.burstOY = vy[bk];
    state.burstOZ = vz[bk];
    state.burstTimer = 1.0;
  }
  const burstActive = state.burstTimer > 0.05;
  const burstStr    = state.burstTimer * 40;
  state.burstTimer *= 0.90;

  // ── Per-particle integration ───────────────────────────────────────────
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const px = pos[i3], py = pos[i3 + 1], pz = pos[i3 + 2];
    const g  = group[i];

    // Radial vector from vortex to particle
    const rx = px - vx[g];
    const ry = py - vy[g];
    const rz = pz - vz[g];

    // Force accumulator
    let fx = 0, fy = 0, fz = 0;

    // 1. Vortex pull (toward assigned center)
    fx -= rx * pullStr;
    fy -= ry * pullStr;
    fz -= rz * pullStr;

    // 2. Tangential swirl (cross product of radial with Y-axis)
    //    (rx, ry, rz) x (0, 1, 0) = (rz, 0, -rx)
    const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz) + 0.001;
    const swirlScale = swirlStr / rLen;
    fx += rz * swirlScale;
    fz -= rx * swirlScale;
    // Add slight vertical swirl component
    fy += (rz * 0.3 - ry * 0.1) * swirlScale;

    // 3. Curl noise turbulence (layered sine)
    const sx = px * ns, sy = py * ns, sz = pz * ns;
    fx += (Math.cos(sy + t * 1.31) * Math.sin(sz * 0.71 + t * 0.53)) * tStr;
    fy += (Math.cos(sz + t * 0.91) * Math.sin(sx * 0.83 + t * 0.67)) * tStr;
    fz += (Math.cos(sx * 0.63 + t * 1.1) * Math.sin(sy + t * 0.43)) * tStr;

    // High-frequency detail layer
    if (high > 0.15) {
      const hStr = high * 1.5 * turbMult;
      fx += Math.cos(sy * 3.1 + t * 4.3) * Math.sin(sz * 2.7) * hStr;
      fy += Math.cos(sz * 2.8 + t * 3.1) * Math.sin(sx * 3.2) * hStr;
      fz += Math.cos(sx * 2.5 + t * 3.7) * Math.sin(sy * 2.9) * hStr;
    }

    // 4. Mouse repulsion
    if (state.mouseActive) {
      const mdx = px - mwx;
      const mdy = py - mwy;
      const mdz = pz; // mouse at z=0
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy + mdz * mdz) + 0.1;
      if (mDist < MOUSE_R) {
        const mForce = mouseForce * (1 - mDist / MOUSE_R) * 8;
        fx += (mdx / mDist) * mForce;
        fy += (mdy / mDist) * mForce;
        fz += (mdz / mDist) * mForce;
      }
    }

    // 5. Beat burst
    if (burstActive) {
      const bx = px - state.burstOX;
      const by = py - state.burstOY;
      const bz = pz - state.burstOZ;
      const bDist = Math.sqrt(bx * bx + by * by + bz * bz) + 0.1;
      if (bDist < 80) {
        const bForce = burstStr * (1 - bDist / 80);
        fx += (bx / bDist) * bForce;
        fy += (by / bDist) * bForce;
        fz += (bz / bDist) * bForce;
      }
    }

    // ── Velocity integration with damping ────────────────────────────────
    vel[i3]     = (vel[i3]     + fx * dt) * DAMPING;
    vel[i3 + 1] = (vel[i3 + 1] + fy * dt) * DAMPING;
    vel[i3 + 2] = (vel[i3 + 2] + fz * dt) * DAMPING;

    pos[i3]     += vel[i3];
    pos[i3 + 1] += vel[i3 + 1];
    pos[i3 + 2] += vel[i3 + 2];

    // ── Lifecycle ────────────────────────────────────────────────────────
    age[i]++;
    const oob = Math.abs(pos[i3]) > BOUNDS ||
                Math.abs(pos[i3 + 1]) > BOUNDS ||
                Math.abs(pos[i3 + 2]) > BOUNDS;

    if (age[i] >= lifespan[i] || oob) {
      // Respawn near a random vortex center
      const rg = (Math.random() * N_VORTEX) | 0;
      group[i] = rg;
      pos[i3]     = vx[rg] + (Math.random() - 0.5) * 20;
      pos[i3 + 1] = vy[rg] + (Math.random() - 0.5) * 20;
      pos[i3 + 2] = vz[rg] + (Math.random() - 0.5) * 20;
      vel[i3] = vel[i3 + 1] = vel[i3 + 2] = 0;
      age[i] = 0;
      lifespan[i] = (200 + Math.random() * 300) | 0;
    }
  }
}

export function particleFn(i, count, target, color, time, THREE, addControl, setInfo, annotate, audio, state) {
  // Read controls (once, on first particle)
  if (i === 0) {
    setInfo('Particle Storm', 'Bass → turbulence · Mid → swirl · Beat → burst · Mouse → repel');
    state._turbulence   = addControl('turbulence',   'Turbulence',   0, 3, 1.0);
    state._vortexRadius = addControl('vortexRadius', 'Vortex Spread', 20, 80, 40);
    state._mouseForce   = addControl('mouseForce',   'Mouse Force',  0, 5, 2.0);
  }

  const bass = audio ? audio.bass : 0.15;
  const high = audio ? audio.high : 0.05;
  const rms  = audio ? audio.rms  : 0.10;
  const beat = audio ? audio.beat : 0;

  const i3 = i * 3;
  target.set(state.pos[i3], state.pos[i3 + 1], state.pos[i3 + 2]);

  // Color based on vortex group + audio
  const g = state.group[i];
  const baseHue = VORTEX_HUES[g];
  const h = ((baseHue + time * 0.01 + bass * 0.08) % 1 + 1) % 1;
  const s = 0.85 + high * 0.10;

  // Age fade: brightest when young, fading toward end of life
  const ageFrac = state.age[i] / state.lifespan[i];
  const ageFade = 0.20 * (1 - ageFrac);
  const l = Math.min(0.02 + ageFade + rms * 0.14 + beat * 0.22, 0.40);

  color.setHSL(h, Math.min(s, 1), l);
}
