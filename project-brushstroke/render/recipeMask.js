// Recipe-mask stamper (canvas2D) — the owned Form→Pigment hand-off, scheme B.
// Generator-agnostic: it stamps a flat list of MARKS into a mask whose RGBA channels
// are a paint RECIPE, not a literal colour. The KM shader branches on these codes:
//   mask.R = pigment id        (id encoded as (id+0.5)/NPAL)
//   mask.G = grain amount       → shader applies procedural porosity
//   mask.B = knockout strength  → shader hard-replaces (carved edge)
//   mask.A = amount             → coverage / KM concentration
//
// Grain + knockout are NOT baked here — they ride as codes the shader honours,
// live-tunable by uniform without re-stamping (this is why scheme B was adopted).
//
// A mark is a flat object the generators emit and the host can reveal append-only:
//   { kind, id, grain, ko, amount, key, ...geometry }
//   kind 'capsule' → tooth along a normal: x,y,nx,ny,half,weight
//   kind 'disc'    → soft field / wash:    x,y,r
//   kind 'dot'     → stipple / spray:      x,y,r
//   key            → reveal order (ascending); the host stamps in key order
import { NPAL } from './palette.js';

// pack recipe codes into an RGB byte triple (alpha carries amount, via the style string)
export function recipePx(id, grain, ko) {
  return [
    Math.round(((id + 0.5) / NPAL) * 255),
    Math.round(grain * 255),
    Math.round(ko * 255),
  ];
}

// stamp one mark into a 2D context; dispatches by kind
export function stampMark(g, mk) {
  const [r, gg, b] = recipePx(mk.id, mk.grain, mk.ko);
  const style = `rgba(${r},${gg},${b},${mk.amount})`;
  if (mk.kind === 'wash') {
    // broad soft field: COVERAGE falloff (alpha varies, recipe codes constant) so KM
    // mixes the muted pigment gently into the ground; tail → 0 coverage fades to ground.
    // Dim = coverage, never alpha-on-a-mark (composition-spike rule).
    const grad = g.createRadialGradient(mk.x, mk.y, 0, mk.x, mk.y, mk.r);
    grad.addColorStop(0, `rgba(${r},${gg},${b},${mk.amount})`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grad;
    g.beginPath(); g.arc(mk.x, mk.y, mk.r, 0, Math.PI * 2); g.fill();
    return;
  }
  if (mk.kind === 'disc' || mk.kind === 'dot') {
    g.fillStyle = style;
    g.beginPath(); g.arc(mk.x, mk.y, mk.r, 0, Math.PI * 2); g.fill();
    return;
  }
  // capsule (default): a tooth laid across the station normal
  g.strokeStyle = style; g.lineWidth = mk.weight; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(mk.x - mk.nx * mk.half, mk.y - mk.ny * mk.half);
  g.lineTo(mk.x + mk.nx * mk.half, mk.y + mk.ny * mk.half);
  g.stroke();
}

// build ONE recipe-mask plate from a flat list of marks (static / non-revealed use)
export function buildMask(W, H, marks) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  for (const mk of marks) stampMark(g, mk);
  return c;
}
