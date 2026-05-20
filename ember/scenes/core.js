// Core: palettes, seeded RNG, resize bus, utilities
window.Ember = window.Ember || {};

// ——— Palettes (warm organic/painterly) ———
Ember.palettes = {
  ember: {
    name: 'Ember',
    bg:   ['#1a0c06', '#2a1208', '#3b1a0c'],
    warm: ['#e8874a', '#f2a463', '#c8552a', '#8a2d1a'],
    cool: ['#5a3324', '#7a4a3a'],
    paper:'#f3ead7'
  },
  dusk: {
    name: 'Dusk',
    bg:   ['#201222', '#3a1a32', '#55243e'],
    warm: ['#e06a7e', '#f09860', '#c7506c', '#7a2a55'],
    cool: ['#4a2842', '#663355'],
    paper:'#f5e5dc'
  },
  ochre: {
    name: 'Ochre',
    bg:   ['#1d1406', '#2b1d0a', '#3f2a10'],
    warm: ['#d9a24a', '#e8c06a', '#a8732a', '#6e4a1a'],
    cool: ['#4a3618', '#6a4e24'],
    paper:'#f3ead2'
  },
  moss: {
    name: 'Moss',
    bg:   ['#0e1a0f', '#1a2e1b', '#26422a'],
    warm: ['#c8a84a', '#e6c667', '#8e7a2a', '#4e5e2a'],
    cool: ['#3a5536', '#567049'],
    paper:'#e8e7cf'
  }
};

Ember.state = {
  palette: 'ember',
  seed: 4271,
  tempo: 1.0,
  audioOn: true,
  vol: 0.55,
  textOn: true,
  scene: -1,
};

// ——— Seeded RNG (mulberry32) ———
Ember.rng = function(seed) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ——— Simplex-ish value noise (cheap, good enough) ———
Ember.makeNoise = function(seed) {
  const r = Ember.rng(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  function fade(t) { return t*t*t*(t*(t*6-15)+10); }
  function lerp(a,b,t) { return a + t*(b-a); }
  function grad(h, x, y) {
    const u = (h & 1) ? x : -x;
    const v = (h & 2) ? y : -y;
    return u + v;
  }
  return function(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return (lerp(x1, x2, v) + 1.4) / 2.8;
  };
};

// ——— Resize bus ———
Ember.resizeHandlers = [];
Ember.onResize = function(fn) { Ember.resizeHandlers.push(fn); };
window.addEventListener('resize', () => {
  Ember.resizeHandlers.forEach(f => { try { f(); } catch(e) {} });
});

// ——— Canvas sizing ———
Ember.sizeCanvas = function(canvas, ctxType) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width  = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  if (ctxType === '2d') {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  return null;
};

// ——— GL helpers ———
Ember.compileShader = function(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('shader error', gl.getShaderInfoLog(s), src);
  }
  return s;
};
Ember.makeProgram = function(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, Ember.compileShader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, Ember.compileShader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('link error', gl.getProgramInfoLog(p));
  }
  return p;
};

Ember.VS_QUAD = `
attribute vec2 a;
varying vec2 vUv;
void main() {
  vUv = a * 0.5 + 0.5;
  gl_Position = vec4(a, 0.0, 1.0);
}
`;

Ember.setupQuad = function(gl, prog) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1,  1,-1, -1, 1,
    -1, 1,  1,-1,  1, 1
  ]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
};

Ember.hexRGB = function(hex) {
  const h = hex.replace('#','');
  const n = parseInt(h, 16);
  return [((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255];
};

Ember.lerp = (a,b,t) => a + (b-a)*t;
Ember.clamp = (x,a,b) => Math.max(a, Math.min(b, x));
