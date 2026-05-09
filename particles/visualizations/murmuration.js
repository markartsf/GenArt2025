// Murmuration — Flocking swarm with wave propagation
// 3 orbiting attractors, 500 groups of 50, golden-angle sphere distribution

const GS = 50;
let GN, gPhase, gSeed, gCenter, gFlat, lSinT, lCosT, lGolden, att;

export function init(count) {
  GN = (count / GS) | 0;
  gPhase  = new Float32Array(GN);
  gSeed   = new Float32Array(GN);
  gCenter = new Float32Array(GN * 3);
  gFlat   = new Float32Array(GN);
  lSinT   = new Float32Array(GS);
  lCosT   = new Float32Array(GS);
  lGolden = new Float32Array(GS);

  for (let g = 0; g < GN; g++) {
    gPhase[g] = g / GN;
    gSeed[g]  = (g * 0.618033988749895) % 1;
  }
  for (let j = 0; j < GS; j++) {
    const f = j / GS;
    lGolden[j] = f * 2.399963;
    const theta = Math.acos(1 - 2 * f);
    lSinT[j] = Math.sin(theta);
    lCosT[j] = Math.cos(theta);
  }

  att = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
  return { gPhase, gSeed, gCenter, gFlat, lSinT, lCosT, lGolden, att };
}

export function frame(state, time, audio) {
  const bass = audio ? audio.bass : 0.12;
  const mid  = audio ? audio.mid  : 0.08;
  const high = audio ? audio.high : 0.02;
  const rms  = audio ? audio.rms  : 0.06;
  const beat = audio ? audio.beat : 0;

  const speed   = 0.4 + rms * 3.5;
  const waveAmp = 5 + mid * 60;
  const ts = time * speed;
  const R  = 50 + bass * 90;

  const a = state.att;
  a[0].x = Math.cos(ts * 0.30) * R;
  a[0].y = Math.sin(ts * 0.20) * R * 0.50 + Math.cos(ts * 0.15) * 18;
  a[0].z = Math.sin(ts * 0.25) * R * 0.70;
  a[1].x = Math.cos(ts * 0.35 + 2.09) * R;
  a[1].y = Math.sin(ts * 0.22 + 2.09) * R * 0.50;
  a[1].z = Math.sin(ts * 0.28 + 2.09) * R * 0.70;
  a[2].x = Math.cos(ts * 0.28 + 4.19) * R;
  a[2].y = Math.sin(ts * 0.18 + 4.19) * R * 0.50;
  a[2].z = Math.sin(ts * 0.32 + 4.19) * R * 0.70;

  if (beat > 0.15) {
    const b = beat * 50;
    a[0].y += b; a[1].x -= b; a[2].z += b;
  }

  // Group centers
  for (let g = 0; g < GN; g++) {
    const gp = state.gPhase[g];
    const blend = gp * 6.2832;
    const w0 = 0.40 + 0.35 * Math.sin(blend + bass * 8);
    const w1 = 0.35 + 0.30 * Math.cos(blend * 1.3 + mid * 8);
    const w2 = 0.25 + 0.25 * Math.sin(blend * 0.7 + high * 8);
    const ws = w0 + w1 + w2;

    let cx = (a[0].x * w0 + a[1].x * w1 + a[2].x * w2) / ws;
    let cy = (a[0].y * w0 + a[1].y * w1 + a[2].y * w2) / ws;
    let cz = (a[0].z * w0 + a[1].z * w1 + a[2].z * w2) / ws;

    const wp = gp * 15 - ts * 2.5;
    cx += Math.sin(wp) * waveAmp;
    cy += Math.cos(wp * 0.8 + 0.5) * waveAmp * 0.6;
    cz += Math.sin(wp * 0.6 + 1.5) * waveAmp * 0.4;

    const gi = g * 3;
    state.gCenter[gi] = cx;
    state.gCenter[gi + 1] = cy;
    state.gCenter[gi + 2] = cz;
    state.gFlat[g] = 0.12 + 0.88 * Math.abs(Math.sin(time * 0.35 + gp * 3.5));
  }
}

export function particleFn(i, count, target, color, time, THREE, addControl, setInfo, annotate, audio, state) {
  if (i === 0) setInfo('Murmuration', 'Bass \u2192 cohesion \u00b7 Mid \u2192 wave \u00b7 High \u2192 scatter \u00b7 Beat \u2192 burst');

  const bass = audio ? audio.bass : 0.12;
  const high = audio ? audio.high : 0.02;
  const rms  = audio ? audio.rms  : 0.06;
  const beat = audio ? audio.beat : 0;
  const cohesion = 28 - bass * 24;
  const scatter  = 1.0 + high * 45;

  const g  = (i / GS) | 0;
  const j  = i - g * GS;
  const gi = g * 3;

  const cx = state.gCenter[gi];
  const cy = state.gCenter[gi + 1];
  const cz = state.gCenter[gi + 2];

  const phi  = state.lGolden[j] + time * 0.5 + state.gSeed[g] * 6.2832;
  const sinP = Math.sin(phi);
  const cosP = Math.cos(phi);
  const sinT = state.lSinT[j];
  const cosT = state.lCosT[j];

  const r    = cohesion * (0.3 + 0.7 * ((j + 1) / GS));
  const flat = state.gFlat[g];

  const lx = cosP * sinT * r;
  const ly = cosT * r * flat;
  const lz = sinP * sinT * r;

  const ti = i * 0.0137 + time;
  const nx = Math.sin(ti * 7.3) * scatter;
  const ny = Math.cos(ti * 5.7) * scatter * 0.7;
  const nz = Math.sin(ti * 6.1 + 1.3) * scatter * 0.8;

  target.set(cx + lx + nx, cy + ly + ny, cz + lz + nz);

  const h = (0.58 + state.gPhase[g] * 0.20 + beat * 0.12 + bass * 0.08) % 1;
  const s2 = Math.min(0.55 + high * 0.35 + beat * 0.15, 1);
  const l = Math.min(0.03 + rms * 0.14 + beat * 0.18, 0.35);
  color.setHSL(h, s2, l);
}
