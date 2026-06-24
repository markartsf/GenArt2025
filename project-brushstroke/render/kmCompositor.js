// KM compositor — multi-plate FBO plate-cache (raw WebGL2 / GLSL ES 3.00).
// Graduated from the proven dense/perf spike (verdict b39ae13). Pigment layer,
// recipe scheme B, OPAQUE output (no alpha on marks → no fringe).
//
// The plate stack is composited bottom→up into per-plate cache textures:
//   cacheTex[0]      = the GROUND (a real plate — uploaded image / cream+noise,
//                      blitted in directly; NOT a flat uniform). See groundProducer.
//   cacheTex[1..N-1] = mark plates (wash / hero / accent), each one KM pass that
//                      mixes its recipe mask over cacheTex[i-1].
// We recomposite only from the lowest DIRTY plate upward (`dirtyFrom`), sampling the
// clean cache below it, and present cacheTex[top] (highest non-empty plate). So:
//   · at rest        → caller passes nothing dirty → 0 KM passes (last frame retained)
//   · revealing      → 1 plate dirty → 1 KM pass, regardless of stack depth
//   · ground swap    → dirtyFrom=0 → re-blit ground, recomposite all
// This dirty-only recomposite IS the M4 reactivity architecture (single-layer budget,
// verdict b39ae13). The modulation uniforms (uBreath/uGrainPulse) are wired but the
// caller passes neutral values this build — no audio/LFO hooks yet (scope: out).
//
// The fragment shader BRANCHES on the recipe codes:
//   mask.R → pigment id    → uPal[id] lookup   (id = floor(R*7))
//   mask.G → grain amount  → procedural porosity (present-or-gone holes + thinning)
//   mask.B → knockout      → hard carved replace (no KM mix)
//   mask.A → amount        → KM concentration / coverage
import { SPECTRAL_GLSL } from './spectral.glsl.js';
import { PALETTE, NPAL, hexRGB } from './palette.js';

const VS = `#version 300 es
in vec2 aPos; out vec2 vTex;
void main(){ vTex = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const HEAD = `#version 300 es
precision highp float;
in vec2 vTex; out vec4 fragColor;
uniform sampler2D maskTex;    // recipe mask of the plate being composited
uniform sampler2D canvasTex;  // cached composite of the plate below
uniform vec3 uPal[7];
uniform float uBreath;        // palette-breathe modulation (0 = none, M4 seam)
uniform float uGrainPulse;    // grain-amount multiplier (1 = neutral, M4 seam)
uniform float uSkip;          // grain porosity (hole fraction) — scale-independent
uniform float uGrainCell;     // grain cell size in DEVICE PIXELS (scales with the mark)
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
`;

const MAIN = `
void main(){
  vec4 m = texture(maskTex, vTex);
  vec3 existing = texture(canvasTex, vTex).rgb;   // the plate below (ground for plate 1)
  float cov = m.a;
  if(cov <= 0.004){ fragColor = vec4(existing, 1.0); return; }
  int id = int(floor(m.r * 7.0 + 0.0001)); id = clamp(id, 0, 6);
  vec3 pig = uPal[id];
  pig = mix(pig, pig.gbr, uBreath);               // palette breathe (M4 seam; 0 now)
  float grainAmt = clamp(m.g * uGrainPulse, 0.0, 1.0);
  if(grainAmt > 0.01){
    // pixel-space grain cell → size set by uGrainCell (device px), so it scales with
    // the mark when the host ties uGrainCell to element scale. Hole fraction (uSkip)
    // is independent of cell size, so areal porosity holds across scales.
    float gh = hash21(floor(gl_FragCoord.xy / uGrainCell));
    if(gh < grainAmt * uSkip) cov = 0.0;          // porous: present-or-gone holes
    else cov *= mix(1.0, 0.55, grainAmt);         // thin the survivors
  }
  if(cov <= 0.004){ fragColor = vec4(existing, 1.0); return; }
  float ko = m.b;
  vec3 col = spectral_mix(existing, pig, clamp(cov, 0.0, 1.0));
  if(ko > 0.01){
    float hard = step(0.5, cov);                  // present-or-gone boundary
    col = mix(col, mix(existing, pig, hard), ko); // hard carved replace
  }
  fragColor = vec4(col, 1.0);
}`;

const BLIT_F = `#version 300 es
precision highp float; in vec2 vTex; out vec4 fragColor; uniform sampler2D src;
void main(){ fragColor = vec4(texture(src, vTex).rgb, 1.0); }`;

export const FRAGMENT_SRC = HEAD + SPECTRAL_GLSL + MAIN;
export const GRAIN_DEFAULTS = { skip: 0.45, cellPx: 4 };   // cellPx = device-px fallback
// neutral modulation (no audio/LFO this build); generators carry grain/knockout in-mask
export const MOD_NEUTRAL = { on: false, whole: true, plate: -1, breath: 0, grain: 1 };

// plateCount includes the ground (index 0). e.g. ground + wash + hero + accent → 4.
export function createCompositor(glCanvas, W, H, plateCount) {
  const gl = glCanvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
  if (!gl) throw new Error('WebGL2 unavailable');
  let P = plateCount;

  const compile = (t, s) => {
    const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error((t === gl.VERTEX_SHADER ? 'VS' : 'FS') + ': ' + gl.getShaderInfoLog(sh));
    return sh;
  };
  const linkProg = (vs, fs) => {
    const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    return p;
  };
  const uloc = (p, names) => { const o = {}; for (const n of names) o[n] = gl.getUniformLocation(p, n); return o; };
  const mkTex = () => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  };
  const allocRGBA = (t) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); };

  const progKM = linkProg(VS, FRAGMENT_SRC);
  const progBlit = linkProg(VS, BLIT_F);
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  for (const p of [progKM, progBlit]) { gl.useProgram(p); const l = gl.getAttribLocation(p, 'aPos'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); }
  const locKM = uloc(progKM, ['maskTex', 'canvasTex', 'uBreath', 'uGrainPulse', 'uSkip', 'uGrainCell',
    'uPal[0]', 'uPal[1]', 'uPal[2]', 'uPal[3]', 'uPal[4]', 'uPal[5]', 'uPal[6]']);
  const locBlit = uloc(progBlit, ['src']);
  const fbo = gl.createFramebuffer();

  const groundTex = mkTex();   // ground source (uploaded from groundProducer canvas)
  let maskTex = [], cacheTex = [];
  function rebuildTextures() {
    maskTex.forEach(t => gl.deleteTexture(t)); cacheTex.forEach(t => gl.deleteTexture(t));
    maskTex = []; cacheTex = [];
    for (let i = 0; i < P; i++) { maskTex.push(mkTex()); const c = mkTex(); allocRGBA(c); cacheTex.push(c); }
  }
  rebuildTextures();

  // palette is uploaded once (static for the piece); setPalette re-uploads for commit-4 tuning
  let palette = PALETTE.slice();
  function uploadPalette() {
    gl.useProgram(progKM);
    for (let i = 0; i < NPAL; i++) { const c = hexRGB(palette[i]).map(v => v / 255); gl.uniform3f(locKM[`uPal[${i}]`], c[0], c[1], c[2]); }
  }
  uploadPalette();

  function setPlateCount(n) { P = n; rebuildTextures(); }
  function setPalette(hexArr) { palette = hexArr.slice(); uploadPalette(); }
  function uploadGround(srcCanvas) { gl.bindTexture(gl.TEXTURE_2D, groundTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas); }
  function uploadMask(i, srcCanvas) { gl.bindTexture(gl.TEXTURE_2D, maskTex[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas); }

  function blit(srcTex, dstTex /* null = screen */) {
    gl.useProgram(progBlit);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstTex ? fbo : null);
    if (dstTex) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dstTex, 0);
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcTex); gl.uniform1i(locBlit.src, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // composite plates [dirtyFrom..top]; dirtyFrom=0 re-blits the ground first.
  // top = highest non-empty plate (0 = only ground showing). Returns KM pass count.
  //   opts.grainAmt   global grain-amount multiplier on mask.G (live lever, 1 = neutral)
  //   opts.grainScale procedural-grain hash scale (uScale)
  //   opts.mod        M4 modulation seam (off this build); multiplies grain on the lit plate
  function composite(dirtyFrom, top, opts = {}) {
    const grainAmt = opts.grainAmt == null ? 1 : opts.grainAmt;
    const mod = opts.mod || MOD_NEUTRAL;
    const t0 = performance.now();
    if (dirtyFrom <= 0) blit(groundTex, cacheTex[0]);   // ground refresh into cache[0]
    let passes = 0;
    if (top >= 1) {
      gl.useProgram(progKM);
      gl.uniform1f(locKM.uSkip, GRAIN_DEFAULTS.skip); gl.uniform1f(locKM.uGrainCell, opts.grainCell || GRAIN_DEFAULTS.cellPx);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, W, H);
      for (let i = Math.max(1, dirtyFrom); i <= top; i++) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cacheTex[i], 0);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskTex[i]); gl.uniform1i(locKM.maskTex, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, cacheTex[i - 1]); gl.uniform1i(locKM.canvasTex, 1);
        const lit = mod.on && (mod.whole || i === mod.plate);
        gl.uniform1f(locKM.uBreath, lit ? mod.breath : 0.0);
        gl.uniform1f(locKM.uGrainPulse, grainAmt * (lit ? mod.grain : 1.0));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        passes++;
      }
    }
    blit(cacheTex[top], null);   // present highest non-empty plate to the screen
    return { passes, ms: performance.now() - t0 };
  }

  // 1×1 readback forces GPU execution to complete (perf timing only — see PATTERNS)
  const _px = new Uint8Array(4);
  function sync() { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, _px); return _px[0]; }

  return {
    canvas: glCanvas, gl, setPlateCount, setPalette, uploadGround, uploadMask, composite, sync,
    isLost: () => gl.isContextLost(), get plateCount() { return P; },
  };
}
