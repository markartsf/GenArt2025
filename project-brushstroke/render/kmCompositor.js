// KM compositor (raw WebGL2 / GLSL ES 3.00) — Pigment layer, scheme B.
// Composites ONE recipe-mask plate over the ground in a single Kubelka-Munk pass.
// Opaque output (alpha always 1.0) — this is what eliminates fringing.
//
// The fragment shader BRANCHES on the recipe codes:
//   mask.R → pigment id → uPal[id] lookup   (id = floor(R*7))
//   mask.G → grain amount → procedural porosity (present-or-gone holes + thinning)
//   mask.B → knockout strength → hard carved replace (no KM mix)
//   mask.A → amount → KM concentration / coverage
//
// Grain + knockout are uniform-tunable instructions, not baked pixels — a uniform
// change + re-composite restyles the plate without re-stamping the mask.
// p5 2.x custom-shader APIs fail silently, so this owns raw WebGL2 directly.
import { SPECTRAL_GLSL } from './spectral.glsl.js';
import { CREAM, PALETTE, NPAL, hexRGB } from './palette.js';

const VS = `#version 300 es
in vec2 aPos; out vec2 vTex;
void main(){ vTex = aPos * 0.5 + 0.5; vTex.y = 1.0 - vTex.y; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const HEAD = `#version 300 es
precision highp float;
in vec2 vTex;
out vec4 fragColor;
uniform sampler2D maskTex;
uniform vec3 groundCol;
uniform vec3 uPal[7];
uniform bool uGrain;
uniform bool uKnockout;
uniform float uSigma;
uniform float uScale;
uniform float uSkip;
uniform float uCov;
uniform float uSeed;
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
`;

// Single-plate KM: incoming recipe mask mixed over the cream ground, one pass.
const MAIN = `
void main(){
  vec4 m = texture(maskTex, vTex);
  vec3 existing = groundCol;
  float cov = m.a;
  if(cov <= 0.004){ fragColor = vec4(existing, 1.0); return; }
  // R → pigment id → palette lookup
  int id = int(floor(m.r * 7.0 + 0.0001)); id = clamp(id, 0, 6);
  vec3 pig = uPal[id];
  // G → grain amount → procedural porosity / dither
  float grainAmt = m.g;
  if(uGrain && grainAmt > 0.01){
    vec2 jit = uSigma * (vec2(hash21(vTex * 157.0 + uSeed), hash21(vTex * 311.0 - uSeed)) - 0.5);
    float gh = hash21(floor((vTex + jit) * uScale + uSeed * 13.0));
    if(gh < grainAmt * uSkip) cov = 0.0;            // porous: present-or-gone holes
    else cov *= mix(1.0, uCov, grainAmt);           // thin the survivors
  }
  if(cov <= 0.004){ fragColor = vec4(existing, 1.0); return; }
  // B → knockout strength → hard carved replace (no subtractive mix)
  float ko = m.b;
  vec3 km = spectral_mix(existing, pig, clamp(cov, 0.0, 1.0));
  vec3 col = km;
  if(uKnockout && ko > 0.01){
    float hard = step(0.5, cov);                    // present-or-gone boundary
    vec3 carved = mix(existing, pig, hard);         // opaque replace, no KM blend
    col = mix(km, carved, ko);
  }
  fragColor = vec4(col, 1.0);
}`;

export const FRAGMENT_SRC = HEAD + SPECTRAL_GLSL + MAIN;

// default procedural-grain knobs (from the mask-A/B spike Panel B defaults)
export const GRAIN_DEFAULTS = { grain: true, knockout: true, sigma: 0.4, scale: 320, skip: 0.45, cov: 0.55, seed: 0 };

export function createCompositor(W, H) {
  const glc = document.createElement('canvas');
  glc.width = W; glc.height = H;
  const gl = glc.getContext('webgl2', { preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 unavailable');

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error((type === gl.VERTEX_SHADER ? 'VERT' : 'FRAG') + ': ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  };

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT_SRC));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));

  gl.useProgram(prog);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // persistent mask texture, reused every render (allocating per-frame leaks GPU mem)
  const texMask = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texMask);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const U = {};
  for (const n of ['maskTex', 'groundCol', 'uGrain', 'uKnockout', 'uSigma', 'uScale', 'uSkip', 'uCov', 'uSeed',
    'uPal[0]', 'uPal[1]', 'uPal[2]', 'uPal[3]', 'uPal[4]', 'uPal[5]', 'uPal[6]']) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  // upload palette once (static for the piece)
  for (let i = 0; i < NPAL; i++) {
    const c = hexRGB(PALETTE[i]).map(v => v / 255);
    gl.uniform3f(U[`uPal[${i}]`], c[0], c[1], c[2]);
  }

  function render(maskCanvas, opts = {}) {
    const o = { ...GRAIN_DEFAULTS, ...opts };
    const t0 = performance.now();
    gl.viewport(0, 0, W, H);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texMask);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);
    gl.uniform1i(U.maskTex, 0);
    gl.uniform3fv(U.groundCol, (o.ground || CREAM).map(v => v / 255));
    gl.uniform1i(U.uGrain, o.grain ? 1 : 0);
    gl.uniform1i(U.uKnockout, o.knockout ? 1 : 0);
    gl.uniform1f(U.uSigma, o.sigma);
    gl.uniform1f(U.uScale, o.scale);
    gl.uniform1f(U.uSkip, o.skip);
    gl.uniform1f(U.uCov, o.cov);
    gl.uniform1f(U.uSeed, o.seed);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return performance.now() - t0;
  }

  return { canvas: glc, gl, render };
}
