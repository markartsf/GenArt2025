// 4D Tesseract Breathing
// 25K particles distributed across the 32 edges of a 4D hypercube (tesseract).
// The hypercube rotates simultaneously in three 4D planes (XW, ZW, XY).
// Perspective projection from 4D→3D creates the classic nested-cube silhouette
// that morphs continuously as the 4D rotation unfolds.
//
// casberry.in compatible: this viz is PURELY FUNCTIONAL — no state needed.
// Copy particleFn body to casberry.in; replace audio?.x with addControl().
//
// Audio mapping:
//   Bass  → XW rotation speed (primary spin)
//   High  → ZW rotation speed (secondary spin, creates "breathing")
//   Mid   → XY rotation speed (in-plane roll)
//   Beat  → projection distance pulse (sudden depth shift)

export const name        = '4D Tesseract';
export const description = 'Bass \u2192 XW spin \u00b7 High \u2192 ZW breath \u00b7 Mid \u2192 roll \u00b7 Beat \u2192 depth';

// frame() precomputes rotation matrix entries once per frame,
// saving 6 sin/cos calls per particle (150K ops/frame saved).
export function init() {
  return { cosXW: 1, sinXW: 0, cosZW: 1, sinZW: 0, cosXY: 1, sinXY: 0, projD: 3.5 };
}

export function frame(state, time, audio) {
  const bass = audio ? audio.bass : 0.15;
  const mid  = audio ? audio.mid  : 0.10;
  const high = audio ? audio.high : 0.03;
  const beat = audio ? audio.beat : 0;

  const xwAngle = time * (0.22 + bass * 0.45);
  const zwAngle = time * (0.15 + high * 0.28);
  const xyAngle = time * (0.09 + mid  * 0.18);

  state.cosXW = Math.cos(xwAngle); state.sinXW = Math.sin(xwAngle);
  state.cosZW = Math.cos(zwAngle); state.sinZW = Math.sin(zwAngle);
  state.cosXY = Math.cos(xyAngle); state.sinXY = Math.sin(xyAngle);

  // Beat pulses the 4D projection distance for a sudden depth snap
  state.projD = 3.5 - beat * 1.2;
}

// casberry.in-compatible particleFn ─────────────────────────────────────────
export function particleFn(i, count, target, color, time, THREE, addControl, setInfo, annotate, audio, state) {
  if (i === 0) setInfo('4D Tesseract', 'Bass \u2192 XW spin \u00b7 High \u2192 ZW breath \u00b7 Beat \u2192 depth pulse');

  const scale = addControl('scale', 'Scale', 40, 180, 90);

  const bass = audio ? audio.bass : 0.15;
  const rms  = audio ? audio.rms  : 0.10;
  const beat = audio ? audio.beat : 0;

  // ── Decode edge index ────────────────────────────────────────────────────
  // A tesseract has 32 edges: 4 axes × 8 vertex pairs per axis.
  // We parametrize by distributing count particles evenly across 32 edges.
  const ePerEdge = (count / 32) | 0;
  const edgeIdx  = Math.min((i / ePerEdge) | 0, 31);
  const t        = (i % ePerEdge) / ePerEdge;  // position along edge [0,1]

  // Which 4D axis this edge runs along (0=X, 1=Y, 2=Z, 3=W)
  const axis = (edgeIdx / 8) | 0;
  // Which of the 8 vertex pairs on this axis
  const vidx = edgeIdx % 8;

  // Map 3-bit vidx → 4-bit vertex index with bit 'axis' forced to 0
  // (insert a 0 at bit position 'axis' in vidx)
  const lo = vidx & ((1 << axis) - 1);
  const hi = vidx >> axis;
  const va = lo | (hi << (axis + 1));

  // 4D coordinates: the edge runs from va to va|(1<<axis)
  // Only the 'axis' coordinate varies (from -1 to +1); others are ±1 fixed.
  const x4 = axis === 0 ? t * 2 - 1 : (((va >> 0) & 1) * 2 - 1);
  const y4 = axis === 1 ? t * 2 - 1 : (((va >> 1) & 1) * 2 - 1);
  const z4 = axis === 2 ? t * 2 - 1 : (((va >> 2) & 1) * 2 - 1);
  const w4 = axis === 3 ? t * 2 - 1 : (((va >> 3) & 1) * 2 - 1);

  // ── 4D rotations (3 planes) ──────────────────────────────────────────────
  // Read precomputed values from state (or fallback for casberry.in)
  const cosXW = state ? state.cosXW : Math.cos(time * 0.22);
  const sinXW = state ? state.sinXW : Math.sin(time * 0.22);
  const cosZW = state ? state.cosZW : Math.cos(time * 0.15);
  const sinZW = state ? state.sinZW : Math.sin(time * 0.15);
  const cosXY = state ? state.cosXY : Math.cos(time * 0.09);
  const sinXY = state ? state.sinXY : Math.sin(time * 0.09);
  const projD = state ? state.projD : 3.5;

  // XW plane rotation
  const rx1 = x4 * cosXW - w4 * sinXW;
  const rw1 = x4 * sinXW + w4 * cosXW;

  // ZW plane rotation
  const rz1 = z4 * cosZW - rw1 * sinZW;
  const rw2 = z4 * sinZW + rw1 * cosZW;

  // XY plane rotation (in-plane, adds graceful roll)
  const rx2 = rx1 * cosXY - y4 * sinXY;
  const ry2 = rx1 * sinXY + y4 * cosXY;

  // ── Perspective projection 4D → 3D ──────────────────────────────────────
  const proj = scale / Math.max(0.1, projD - rw2);
  target.set(rx2 * proj, ry2 * proj, rz1 * proj);

  // ── Color: each axis has a distinct hue; brightness peaks at edge midpoint ─
  const axisHues = [0.00, 0.25, 0.52, 0.75];   // red, green, cyan, violet
  const midBrightness = 1 - Math.abs(t - 0.5) * 2;  // bright at center
  const h = (axisHues[axis] + time * 0.008) % 1;
  const l = 0.04 + midBrightness * 0.24 + rms * 0.10 + beat * 0.18;
  color.setHSL(h, 0.90, Math.min(l, 0.40));
}
