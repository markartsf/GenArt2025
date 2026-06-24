// Composition host — p5 (instance, P2D) owns the visible canvas, the rAF loop,
// pixelDensity, the timed append-only reveal, and presents the cached KM stack.
// Pigment is the raw-WebGL2 plate-cache compositor; form is our own canvas2D mark
// stamping (no p5.brush — it can't emit recipe channel codes).
//
// The stack is generic: a `ground` builder (plate 0) + an ordered `layers` list of
// mark generators (plates 1..N). The host knows nothing about Tuft/wash/accent — it
// reveals marks append-only and recomposites only the dirty plates upward (rest = 0
// passes, reveal = 1 pass), and exposes the live control levers (see api.* below):
// each lever rebuilds only the plate(s) it touches and recomposites from there up.
//
//   config = {
//     holderId, seed, revealMs,
//     ground: (W,H,scale,opts) => canvas,          // plate 0 producer (opaque RGB)
//     groundOpts,                                   // initial ground options
//     layers: [ { name, opts, gen: (W,H,seed,scale,opts) => marks } ],  // plates 1..N
//     onReady: (api) => {},                         // called once after setup
//   }
import { createCompositor } from './kmCompositor.js';
import { stampMark } from './recipeMask.js';

const FRAME_REF = 620;   // mark scale is relative to the frame (DESIGN #7)
const ease = x => x * x * x * (x * (x * 6 - 15) + 10);   // smootherstep reveal cadence

export function startComposition(config) {
  const C = { seed: 11, revealMs: 4200, groundOpts: {}, ...config };
  const api = {};

  const sketch = (p) => {
    let inPreview = false, dpr = 2;
    let cssW, cssH, W, H, baseScale, scale, comp, K;
    let ground, plates = [], t = 0;
    let frameMs = 0, kmPasses = 0, newMarks = 0;
    const M = C.layers.length;        // number of mark plates

    // live control state (the levers mutate these, then rebuild + recompose)
    let scaleMul = 1, grainAmt = 1, grainSize = C.grainSize ?? 1.3;   // grainSize = grain cell px at scale 1
    const groundOpts = { ...C.groundOpts };
    const layerOpts = C.layers.map(l => ({ ...(l.opts || {}) }));
    // KM opts: grain cell scales with element scale → in-mark grain tracks the mark
    const kmOpts = () => ({ grainAmt, grainCell: grainSize * scale });

    function recomputeSize() { cssW = p.constrain(p.windowWidth, 360, 1600); cssH = p.constrain(p.windowHeight, 360, 1000); }
    function buildGroundPlate() { ground = C.ground(W, H, scale, groundOpts); K.uploadGround(ground); }
    function genPlate(i) { return C.layers[i].gen(W, H, C.seed + i, scale, layerOpts[i]); }

    function build() {
      W = cssW * dpr; H = cssH * dpr; baseScale = Math.min(W, H) / FRAME_REF; scale = baseScale * scaleMul;
      buildGroundPlate();
      plates = [];
      for (let i = 0; i < M; i++) {
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        plates.push({ name: C.layers[i].name, canvas: cv, ctx: cv.getContext('2d'), marks: genPlate(i), cursor: 0, dirty: true });
        K.uploadMask(i + 1, cv);
      }
      t = 0;
      K.composite(0, 0, kmOpts()); present();   // show the quiet ground at t=0
    }

    // plate i (0-based mark index) reveals across global-t window [i/M, (i+1)/M]
    function plateLocalT(mi) { const w = 1 / M; return ease(p.constrain((t - mi * w) / w, 0, 1)); }

    function advanceReveal() {
      newMarks = 0; let dirtyFrom = Infinity, top = 0;
      for (let i = 0; i < M; i++) {
        const pl = plates[i], target = plateLocalT(i) * pl.marks.length;
        if (target > pl.cursor) {
          for (let m = Math.floor(pl.cursor); m < Math.floor(target) && m < pl.marks.length; m++) { stampMark(pl.ctx, pl.marks[m]); newMarks++; }
          pl.cursor = target; pl.dirty = true;
        }
        if (pl.cursor > 0) top = i + 1;
        if (pl.dirty) { K.uploadMask(i + 1, pl.canvas); dirtyFrom = Math.min(dirtyFrom, i + 1); pl.dirty = false; }
      }
      return { dirtyFrom, top };
    }

    function present() { p.drawingContext.drawImage(comp, 0, 0, cssW, cssH); }
    function revealing() { return t < 1; }
    function currentTop() { let top = 0; for (let i = 0; i < M; i++) if (plates[i].cursor > 0) top = i + 1; return top; }

    // control edits happen at rest → re-stamp the fully-revealed plate, then recompose
    function restampPlate(i) { const pl = plates[i]; pl.ctx.clearRect(0, 0, pl.canvas.width, pl.canvas.height); for (const mk of pl.marks) stampMark(pl.ctx, mk); pl.cursor = pl.marks.length; K.uploadMask(i + 1, pl.canvas); }
    function rebuildPlate(i) { plates[i].marks = genPlate(i); restampPlate(i); }
    function recompose(from) {
      const top = currentTop();
      const r = K.composite(top < 1 ? 0 : Math.max(0, Math.min(from, top)), top, kmOpts());
      kmPasses = r.passes; present();
    }

    p.setup = function () {
      inPreview = /Claude\/.*Electron/.test(navigator.userAgent);
      dpr = inPreview ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      recomputeSize();
      const c = p.createCanvas(cssW, cssH); c.parent(C.holderId);
      p.pixelDensity(dpr);            // set once, never toggled (PATTERNS)
      comp = document.createElement('canvas'); comp.width = cssW * dpr; comp.height = cssH * dpr;
      K = createCompositor(comp, cssW * dpr, cssH * dpr, M + 1);
      build();
      api._ready = true;
      if (C.onReady) C.onReady(api);
    };

    p.draw = function () {
      if (K.isLost()) return;
      const t0 = performance.now();
      if (revealing()) {
        t = p.min(1, t + (p.deltaTime / C.revealMs));
        const { dirtyFrom, top } = advanceReveal();
        if (dirtyFrom !== Infinity) { const r = K.composite(dirtyFrom, top, kmOpts()); kmPasses = r.passes; present(); }
        else kmPasses = 0;
      } else { kmPasses = 0; newMarks = 0; }   // rest: nothing dirty, P2D retains last frame
      frameMs = performance.now() - t0;
    };

    p.windowResized = function () { recomputeSize(); };   // sized on load; reload to refit retina

    // ---- controller surface: HUD actions + the live levers ----
    api.replay = () => { for (const pl of plates) { pl.ctx.clearRect(0, 0, pl.canvas.width, pl.canvas.height); pl.cursor = 0; pl.dirty = true; } build(); };
    api.savePNG = () => { const a = document.createElement('a'); a.href = comp.toDataURL('image/png'); a.download = `composition_seed${C.seed}.png`; document.body.appendChild(a); a.click(); a.remove(); };
    api.reseed = (s) => { C.seed = (s == null) ? ((C.seed * 7 + 1) & 0xffff) : (s >>> 0); api.replay(); return C.seed; };

    // DESIGN #7 — element scale to frame: rebuild every mark plate at the new scale
    api.setScale = (m) => { scaleMul = m; scale = baseScale * scaleMul; for (let i = 0; i < M; i++) rebuildPlate(i); recompose(1); };
    // DESIGN #8 — quiet grounds: noise / contrast / image swap (rebuild ground only)
    api.setGround = (partial) => { Object.assign(groundOpts, partial); buildGroundPlate(); recompose(0); };
    // palette: re-upload the 7 entries, recomposite the mark stack (ground unaffected)
    api.setPalette = (hexArr) => { K.setPalette(hexArr); recompose(1); };
    // grain amount: global uniform on mask.G — cheap, no re-stamp
    api.setGrainAmt = (a) => { grainAmt = a; recompose(1); };
    // grain size: cell px at scale 1; actual cell = grainSize·scale, so it scales with the mark
    api.setGrainSize = (s) => { grainSize = s; recompose(1); };
    // per-layer opts (wash strength/colour, accent dot-size/amount/colour): rebuild that plate
    api.setLayer = (name, partial) => { const i = C.layers.findIndex(l => l.name === name); if (i < 0) return; Object.assign(layerOpts[i], partial); rebuildPlate(i); recompose(i + 1); };

    api.stats = () => ({ t: +t.toFixed(3), frameMs: +frameMs.toFixed(2), kmPasses, newMarks, plates: M + 1, dpr, scale: +scaleMul.toFixed(2), seed: C.seed, state: revealing() ? 'revealing' : 'rest', lost: K.isLost() });
  };

  const inst = new (window.p5)(sketch);
  api.p5 = inst;
  return api;
}
