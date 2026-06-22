// Recipe-mask stamper (canvas2D) — the owned Form→Pigment hand-off, scheme B.
// Generator-agnostic: it stamps a flat list of teeth into a mask whose RGBA channels
// are a paint RECIPE, not a literal colour. The KM shader branches on these codes:
//   mask.R = pigment id        (id encoded as (id+0.5)/NPAL)
//   mask.G = grain amount       → shader applies procedural porosity
//   mask.B = knockout strength  → shader hard-replaces (carved edge)
//   mask.A = amount             → coverage / KM concentration
//
// The tooth is a single clean capsule stroke. Grain + knockout are NOT baked here —
// they ride as codes the shader honours, live-tunable by uniform without re-stamping.
// (This is exactly why scheme B was adopted over A: paint behaviour as uniforms.)
import { NPAL } from './palette.js';

// pack recipe codes into an RGB byte triple (alpha carries amount, set via globalAlpha)
export function recipePx(id, grain, ko) {
  return [
    Math.round(((id + 0.5) / NPAL) * 255),
    Math.round(grain * 255),
    Math.round(ko * 255),
  ];
}

// stamp one tooth: a capsule along the station normal, codes in colour + alpha
export function stampTooth(g, s, { id, grain, ko, amount }, weight) {
  const [r, gg, b] = recipePx(id, grain, ko);
  g.strokeStyle = `rgba(${r},${gg},${b},${amount})`;
  g.lineWidth = weight;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(s.x - s.nx * s.half, s.y - s.ny * s.half);
  g.lineTo(s.x + s.nx * s.half, s.y + s.ny * s.half);
  g.stroke();
}

// build ONE recipe-mask plate from a flat list of teeth (generator-agnostic)
export function buildMask(W, H, teeth, weight) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  for (const tooth of teeth) stampTooth(g, tooth.s, tooth, weight);
  return c;
}
