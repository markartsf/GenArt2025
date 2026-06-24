// Composition host — p5 (instance, P2D) owns the visible canvas, the rAF loop,
// pixelDensity, the timed append-only reveal, and presents the cached KM stack.
// Pigment is the raw-WebGL2 plate-cache compositor; form is our own canvas2D mark
// stamping (no p5.brush — it can't emit recipe channel codes).
//
// The stack is generic: a `ground` builder (plate 0) + an ordered `layers` list of
// mark generators (plates 1..N). The host knows nothing about Tuft/wash/accent — it
// reveals marks append-only and recomposites only the dirty plates upward, exactly
// as the dense/perf spike proved (rest = 0 passes, reveal = 1 pass).
//
//   config = {
//     holderId,                       // parent element id for the p5 canvas
//     seed,                           // deterministic seed
//     revealMs,                       // total reveal duration (ms) across all layers
//     ground: (W,H,scale) => canvas,  // plate 0 producer (opaque RGB canvas)
//     layers: [ { name, gen: (W,H,seed,scale) => marks } ],  // plates 1..N
//   }
import { createCompositor } from './kmCompositor.js';
import { stampMark } from './recipeMask.js';

const FRAME_REF = 620;   // mark scale is relative to the frame (DESIGN #7)
const ease = x => x * x * x * (x * (x * 6 - 15) + 10);   // smootherstep reveal cadence

export function startComposition(config) {
  const C = { seed: 11, revealMs: 4200, ...config };
  let api = {};

  const sketch = (p) => {
    let inPreview = false, dpr = 2;
    let cssW, cssH, W, H, scale, comp, K;
    let ground, plates = [], t = 0;
    let frameMs = 0, kmPasses = 0, newMarks = 0;
    const M = C.layers.length;        // number of mark plates

    function recomputeSize() { cssW = p.constrain(p.windowWidth, 360, 1600); cssH = p.constrain(p.windowHeight, 360, 1000); }

    function build() {
      W = cssW * dpr; H = cssH * dpr; scale = Math.min(W, H) / FRAME_REF;
      // ground (plate 0)
      ground = C.ground(W, H, scale);
      K.uploadGround(ground);
      // mark plates (1..N)
      plates = [];
      for (let i = 0; i < M; i++) {
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        plates.push({ name: C.layers[i].name, canvas: cv, ctx: cv.getContext('2d'),
                      marks: C.layers[i].gen(W, H, C.seed + i, scale), cursor: 0, dirty: true });
        K.uploadMask(i + 1, cv);      // empty mask until marks land
      }
      t = 0;
      K.composite(0, 0);              // blit ground so the quiet base shows at t=0
      present();
    }

    // plate i (1-based mark index) reveals across global-t window [(i-1)/M, i/M]
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
    };

    p.draw = function () {
      if (K.isLost()) return;
      const t0 = performance.now();
      if (revealing()) {
        t = p.min(1, t + (p.deltaTime / C.revealMs));
        const { dirtyFrom, top } = advanceReveal();
        if (dirtyFrom !== Infinity) { const r = K.composite(dirtyFrom, top); kmPasses = r.passes; present(); }
        else kmPasses = 0;
      } else { kmPasses = 0; newMarks = 0; }   // rest: nothing dirty, P2D retains last frame
      frameMs = performance.now() - t0;
    };

    p.windowResized = function () { recomputeSize(); };   // sized on load; reload to refit retina

    // ---- controller surface (HUD + commit-4 controls) ----
    api.replay = () => { for (const pl of plates) { pl.ctx.clearRect(0, 0, pl.canvas.width, pl.canvas.height); pl.cursor = 0; pl.dirty = true; } build(); };
    api.savePNG = () => { const a = document.createElement('a'); a.href = comp.toDataURL('image/png'); a.download = `composition_seed${C.seed}.png`; document.body.appendChild(a); a.click(); a.remove(); };
    api.stats = () => ({ t: +t.toFixed(3), frameMs: +frameMs.toFixed(2), kmPasses, newMarks, plates: M + 1, dpr, state: revealing() ? 'revealing' : 'rest', lost: K.isLost() });
  };

  const inst = new (window.p5)(sketch);
  api.p5 = inst;
  return api;
}
