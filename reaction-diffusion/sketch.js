// =============================================================
// REACTION DIFFUSION — Canvas API (Gray-Scott model)
// Audio-reactive via render-time contrast + direct field injection
//
// KEY INSIGHT: f/k modulation is too slow to feel reactive.
// Instead audio drives:
//   1. Render-time contrast/threshold shift (INSTANT visual pulse)
//   2. Direct chemical injection into B field on bass hits
//   3. Field-wide perturbation from violin energy
//   4. Brightness/shimmer from highs
// =============================================================

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
const fpsEl  = document.getElementById('fps');

const SIM_SCALE = 2;   // 2px per sim cell — faster, allows more steps
let simW, simH;
let A, B, nextA, nextB;
let imageData, pixels;

let paused       = false;
let frameCount   = 0;
let lastFpsTime  = performance.now();
let autoSeedTimer = 0;

// ─── Gray-Scott presets — chosen for maximum visual contrast ──
// These are from very different regions of the f/k parameter space
const PRESETS = [
  {
    name: 'Maze',
    f: 0.029, k: 0.057,
    // Dense labyrinthine network fills the whole canvas
    seed: (w, h) => {
      for (let i = 0; i < 80; i++) seedBlob(rand(w), rand(h), 1 + ri(4));
      for (let i = 0; i < 30; i++) seedLine(rand(w), rand(h), 6 + ri(10), Math.random() * Math.PI);
    },
  },
  {
    name: 'Worms',
    f: 0.062, k: 0.062,
    // Long sinuous tube-like structures
    seed: (w, h) => {
      for (let i = 0; i < 40; i++) seedCross(rand(w), rand(h), 4 + ri(8), 1);
      for (let i = 0; i < 20; i++) seedLine(rand(w), rand(h), 8 + ri(14), Math.random() * Math.PI);
    },
  },
  {
    name: 'Blobs',
    f: 0.025, k: 0.058,
    // Large isolated slowly-moving blobs
    seed: (w, h) => {
      for (let i = 0; i < 30; i++) seedBlob(rand(w), rand(h), 6 + ri(10));
      for (let i = 0; i < 20; i++) seedRing(rand(w), rand(h), 5 + ri(8), 2);
    },
  },
  {
    name: 'Coral',
    f: 0.0545, k: 0.063,
    // Branching coral / moving spots
    seed: (w, h) => {
      for (let i = 0; i < 50; i++) seedBlob(rand(w), rand(h), 3 + ri(6));
      for (let i = 0; i < 20; i++) seedRing(rand(w), rand(h), 4 + ri(6), 1);
    },
  },
];
let presetIndex = 0;

// ─── Palettes ─────────────────────────────────────────────────
const PALETTES = [
  {
    name: 'Winter',
    stops: [
      [0.00, [  8,  15,  55]],
      [0.22, [  0,  55, 160]],
      [0.48, [  0, 145, 155]],
      [0.75, [110, 190, 225]],
      [1.00, [232, 244, 255]],
    ],
  },
  {
    name: 'Embers',
    stops: [
      [0.00, [  5,   0,   0]],
      [0.20, [ 80,   5,   0]],
      [0.45, [200,  50,   0]],
      [0.70, [255, 160,  20]],
      [1.00, [255, 248, 200]],
    ],
  },
  {
    name: 'Abyss',
    stops: [
      [0.00, [  0,   0,   8]],
      [0.25, [ 20,   0,  80]],
      [0.50, [ 80,   0, 160]],
      [0.75, [180,  80, 255]],
      [1.00, [240, 220, 255]],
    ],
  },
  {
    name: 'Forest',
    stops: [
      [0.00, [  2,   8,   2]],
      [0.25, [  5,  50,  10]],
      [0.50, [ 20, 110,  40]],
      [0.75, [ 80, 200,  80]],
      [1.00, [210, 255, 210]],
    ],
  },
  {
    name: 'Dusk',
    stops: [
      [0.00, [ 10,   5,  20]],
      [0.25, [ 80,  20,  60]],
      [0.50, [180,  60,  80]],
      [0.75, [255, 140, 100]],
      [1.00, [255, 230, 210]],
    ],
  },
  {
    name: 'Mono',
    stops: [
      [0.00, [  5,   5,   5]],
      [0.30, [ 40,  40,  45]],
      [0.60, [120, 125, 130]],
      [0.80, [195, 200, 205]],
      [1.00, [245, 248, 255]],
    ],
  },
];
let paletteIndex = 0;

function paletteColor(v, brightness) {
  const stops = PALETTES[paletteIndex].stops;
  v = Math.max(0, Math.min(1, v));
  let i = 0;
  while (i < stops.length - 2 && v > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const t = (t1 > t0) ? (v - t0) / (t1 - t0) : 0;
  return [
    Math.min(255, Math.floor((c0[0] + (c1[0] - c0[0]) * t) * brightness)),
    Math.min(255, Math.floor((c0[1] + (c1[1] - c0[1]) * t) * brightness)),
    Math.min(255, Math.floor((c0[2] + (c1[2] - c0[2]) * t) * brightness)),
  ];
}

// ─── Audio-driven render parameters ───────────────────────────
// These update every frame and take effect IMMEDIATELY at render time
let renderContrast   = 1.0;   // expands the A-B value range
let renderThreshold  = 0.0;   // shifts midpoint of color mapping
let renderBrightness = 1.0;   // overall brightness
let bassFlash        = 0.0;   // white overlay flash on bass hit

// ─── Audio ────────────────────────────────────────────────────
let audioCtx    = null;
let sourceNode  = null;
let analyserFFT = null;
let freqData;
const FFT_SIZE  = 2048;
let BIN_HZ      = 48000 / FFT_SIZE;

class Follower {
  constructor(up = 0.3, dn = 0.92) { this.v = 0; this.up = up; this.dn = dn; }
  feed(x) { const c = x > this.v ? this.up : this.dn; this.v += (x - this.v) * (1 - c); return this.v; }
}

class OnsetDetector {
  constructor(window = 20, thresh = 1.3) {   // lowered from 1.6 — fires on quieter transients
    this.buf = new Float32Array(window).fill(0.02);
    this.pos = 0; this.thresh = thresh; this.cool = 0;
  }
  feed(e) {
    const avg = this.buf.reduce((a, b) => a + b) / this.buf.length;
    const hit = this.cool <= 0 && e > avg * this.thresh && e > 0.015; // lower floor too
    this.buf[this.pos++ % this.buf.length] = e;
    if (this.cool > 0) this.cool--;
    if (hit) this.cool = 8;
    return hit;
  }
}

// Auto-normalise per band — tracks running peak so quiet tracks fill full range
class AutoNorm {
  constructor(decay = 0.9995) { this.peak = 0.02; this.decay = decay; }
  feed(x) {
    if (x > this.peak) this.peak = x;
    else this.peak *= this.decay;
    this.peak = Math.max(this.peak, 0.02);
    return Math.min(x / this.peak, 1);
  }
}

const bassOnset  = new OnsetDetector(16, 1.3);
const bassFollow = new Follower(0.4, 0.88);
const midFollow  = new Follower(0.15, 0.97);
const highFollow = new Follower(0.20, 0.96);
const bassNorm   = new AutoNorm();
const midNorm    = new AutoNorm();
const highNorm   = new AutoNorm();

function bandEnergy(data, loHz, hiHz) {
  const lo = Math.max(1, Math.floor(loHz / BIN_HZ));
  const hi = Math.min(data.length - 1, Math.ceil(hiHz / BIN_HZ));
  let s = 0;
  for (let i = lo; i <= hi; i++) s += data[i];
  return s / ((hi - lo + 1) * 255);
}

// ─── Helpers ──────────────────────────────────────────────────
const rand = (n) => Math.floor(Math.random() * n);
const ri   = (n) => Math.floor(Math.random() * n);

// ─── Seed shapes ──────────────────────────────────────────────
function seedBlob(cx, cy, r) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        const ix = ((cx + dx) % simW + simW) % simW;
        const iy = ((cy + dy) % simH + simH) % simH;
        B[iy * simW + ix] = 1.0;
        A[iy * simW + ix] = 0.0;
      }
    }
  }
}

function seedRing(cx, cy, r, thick) {
  for (let dy = -(r + thick); dy <= r + thick; dy++) {
    for (let dx = -(r + thick); dx <= r + thick; dx++) {
      const d = dx * dx + dy * dy;
      if (d >= (r - thick) * (r - thick) && d <= (r + thick) * (r + thick)) {
        const ix = ((cx + dx) % simW + simW) % simW;
        const iy = ((cy + dy) % simH + simH) % simH;
        B[iy * simW + ix] = 1.0; A[iy * simW + ix] = 0.0;
      }
    }
  }
}

function seedCross(cx, cy, arm, thick) {
  for (let i = -arm; i <= arm; i++) {
    for (let t = -thick; t <= thick; t++) {
      const hx = ((cx + i) % simW + simW) % simW;
      const hy = ((cy + t) % simH + simH) % simH;
      B[hy * simW + hx] = 1.0; A[hy * simW + hx] = 0.0;
      const vx = ((cx + t) % simW + simW) % simW;
      const vy = ((cy + i) % simH + simH) % simH;
      B[vy * simW + vx] = 1.0; A[vy * simW + vx] = 0.0;
    }
  }
}

function seedLine(cx, cy, len, angle) {
  for (let i = -len; i <= len; i++) {
    const px = Math.round(cx + Math.cos(angle) * i);
    const py = Math.round(cy + Math.sin(angle) * i);
    for (let t = -1; t <= 1; t++) {
      const ix = ((px + t) % simW + simW) % simW;
      const iy = (py % simH + simH) % simH;
      B[iy * simW + ix] = 1.0; A[iy * simW + ix] = 0.0;
    }
  }
}

// ─── Bass hit injection — large-scale, spread widely ─────────
function bassInject() {
  // Drop 8-14 seeds, some large
  const n = 8 + ri(7);
  for (let i = 0; i < n; i++) {
    const cx = rand(simW), cy = rand(simH);
    const type = ri(4);
    switch (type) {
      case 0: seedBlob(cx, cy, 6 + ri(10)); break;   // large blob
      case 1: seedRing(cx, cy, 8 + ri(10), 2); break; // large ring
      case 2: seedCross(cx, cy, 6 + ri(10), 2); break;
      case 3: seedLine(cx, cy, 10 + ri(14), Math.random() * Math.PI); break;
    }
  }
  // Also inject directly into B field to perturb existing structures
  const perturbCount = simW * simH * 0.005; // 0.5% of cells
  for (let i = 0; i < perturbCount; i++) {
    const idx = Math.floor(Math.random() * simW * simH);
    B[idx] = Math.min(1, B[idx] + 0.3);
    A[idx] = Math.max(0, A[idx] - 0.3);
  }
}

// Periodic top-up
function periodicSeed() {
  const p = PRESETS[presetIndex];
  p.seed(simW, simH);
}

// ─── Resize ───────────────────────────────────────────────────
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  simW = Math.ceil(canvas.width  / SIM_SCALE);
  simH = Math.ceil(canvas.height / SIM_SCALE);
  imageData = ctx.createImageData(simW, simH);
  pixels    = imageData.data;
  initAndSeed();
}

function initAndSeed() {
  A = new Float32Array(simW * simH);
  B = new Float32Array(simW * simH);
  nextA = new Float32Array(simW * simH);
  nextB = new Float32Array(simW * simH);
  A.fill(1.0);
  B.fill(0.0);
  PRESETS[presetIndex].seed(simW, simH);
  autoSeedTimer = 0;
}

// ─── Simulation step (laplacian fully inlined) ────────────────
function step(f, k) {
  const dA = 1.0, dB = 0.5;
  for (let y = 0; y < simH; y++) {
    const yU = y > 0        ? y - 1 : simH - 1;
    const yD = y < simH - 1 ? y + 1 : 0;
    for (let x = 0; x < simW; x++) {
      const xL = x > 0        ? x - 1 : simW - 1;
      const xR = x < simW - 1 ? x + 1 : 0;
      const idx = y * simW + x;

      const laA =
        A[yU*simW+xL]*0.05 + A[yU*simW+x]*0.20 + A[yU*simW+xR]*0.05 +
        A[y *simW+xL]*0.20 + A[idx]       *-1.0 + A[y *simW+xR]*0.20 +
        A[yD*simW+xL]*0.05 + A[yD*simW+x]*0.20 + A[yD*simW+xR]*0.05;

      const laB =
        B[yU*simW+xL]*0.05 + B[yU*simW+x]*0.20 + B[yU*simW+xR]*0.05 +
        B[y *simW+xL]*0.20 + B[idx]       *-1.0 + B[y *simW+xR]*0.20 +
        B[yD*simW+xL]*0.05 + B[yD*simW+x]*0.20 + B[yD*simW+xR]*0.05;

      const a = A[idx], b = B[idx], rxn = a * b * b;
      nextA[idx] = Math.max(0, Math.min(1, a + dA*laA - rxn + f*(1-a)));
      nextB[idx] = Math.max(0, Math.min(1, b + dB*laB + rxn - (k+f)*b));
    }
  }
  [A, nextA] = [nextA, A];
  [B, nextB] = [nextB, B];
}

// ─── Render — audio drives contrast, threshold, brightness ────
function render() {
  const contrast  = renderContrast;
  const threshold = renderThreshold;
  const bright    = renderBrightness;
  const flash     = bassFlash;

  for (let i = 0; i < simW * simH; i++) {
    // Raw 0→1 value from simulation
    let v = A[i] - B[i];

    // Audio: stretch contrast around 0.5, shift threshold
    // This is IMMEDIATE — no simulation lag
    v = (v - 0.5 + threshold) * contrast + 0.5;
    v = Math.max(0, Math.min(1, v));

    const [r, g, b] = paletteColor(v, bright);

    // Bass flash — blend toward white
    const p = i * 4;
    pixels[p]     = Math.min(255, r + Math.floor(flash * 80));
    pixels[p + 1] = Math.min(255, g + Math.floor(flash * 80));
    pixels[p + 2] = Math.min(255, b + Math.floor(flash * 120));
    pixels[p + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  // Scale up from sim resolution to screen
  ctx.drawImage(canvas, 0, 0, simW, simH, 0, 0, canvas.width, canvas.height);
}

// ─── Main loop ────────────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);
  if (paused) return;

  const p = PRESETS[presetIndex];
  let stepsPerFrame = 12;

  if (analyserFFT) {
    analyserFFT.getByteFrequencyData(freqData);

    const bassE = bandEnergy(freqData,  60,  350);
    const midE  = bandEnergy(freqData, 700, 5000);
    const highE = bandEnergy(freqData, 5000, 16000);

    // Auto-normalised values — compressed tracks still fill full range
    const bassN = bassNorm.feed(bassE);
    const midN  = midNorm.feed(midE);
    const highN = highNorm.feed(highE);

    const hit = bassOnset.feed(bassN);   // onset on normalised value
    if (hit) {
      bassInject();
      bassFlash = 0.8;
    }

    const bassSmooth = bassFollow.feed(bassN);
    const midSmooth  = midFollow.feed(midN);
    const highSmooth = highFollow.feed(highN);

    // ── IMMEDIATE render-time reactivity ──
    renderContrast   = 1.0 + (bassSmooth + midSmooth) * 3.5;   // stronger contrast swing
    renderThreshold  = (bassSmooth - midSmooth) * 0.35;         // more threshold shift
    renderBrightness = 0.7 + highSmooth * 0.8;                  // wider brightness range

    // Bass flash decays
    bassFlash = Math.max(0, bassFlash - 0.04);

    // Steps per frame: 12–22 based on overall energy
    const overallE = (bassSmooth + midSmooth + highSmooth) / 3;
    stepsPerFrame = Math.round(12 + overallE * 10);

    // Update UI meters (normalised so they always show activity)
    document.getElementById('bass-meter').style.width = (bassSmooth * 100).toFixed(1) + '%';
    document.getElementById('mid-meter').style.width  = (midSmooth  * 100).toFixed(1) + '%';
    document.getElementById('high-meter').style.width = (highSmooth * 100).toFixed(1) + '%';

  } else {
    renderContrast = 1.0; renderThreshold = 0; renderBrightness = 1.0; bassFlash = 0;
  }

  // Periodic seeding
  autoSeedTimer++;
  if (autoSeedTimer > 600) { periodicSeed(); autoSeedTimer = 0; }

  for (let i = 0; i < stepsPerFrame; i++) step(p.f, p.k);
  render();

  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime > 1000) {
    fpsEl.textContent =
      `${frameCount} fps  |  ${p.name}  |  ${PALETTES[paletteIndex].name}  |  contrast: ${renderContrast.toFixed(2)}`;
    frameCount = 0;
    lastFpsTime = now;
  }
}

// ─── Audio loading ────────────────────────────────────────────
async function initAudio(arrayBuffer) {
  if (audioCtx) audioCtx.close();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  BIN_HZ = audioCtx.sampleRate / FFT_SIZE;
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  analyserFFT = audioCtx.createAnalyser();
  analyserFFT.fftSize = FFT_SIZE;
  analyserFFT.smoothingTimeConstant = 0.55;  // lower = snappier response
  freqData = new Uint8Array(FFT_SIZE / 2);
  sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = decoded;
  sourceNode.loop   = true;
  sourceNode.connect(analyserFFT);
  analyserFFT.connect(audioCtx.destination);
  sourceNode.start(0);
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('playBtn').textContent = 'Pause';
}

// ─── Controls ─────────────────────────────────────────────────
window.loadBundled = async function () {
  try {
    const r = await fetch('../dist/assets/circles01a.mp3');
    await initAudio(await r.arrayBuffer());
  } catch (e) { alert('Could not load circles01a.mp3\n' + e.message); }
};

window.loadFile = async function (input) {
  const file = input.files[0];
  if (!file) return;
  await initAudio(await file.arrayBuffer());
};

window.startWithoutAudio = function () {
  document.getElementById('overlay').style.display = 'none';
};

window.togglePause = function () {
  paused = !paused;
  if (audioCtx) paused ? audioCtx.suspend() : audioCtx.resume();
  document.getElementById('playBtn').textContent = paused ? 'Play' : 'Pause';
};

window.resetSim = function () {
  initAndSeed();
};

window.nextPreset = function () {
  presetIndex = (presetIndex + 1) % PRESETS.length;
  initAndSeed();
  document.getElementById('presetBtn').textContent = 'Preset: ' + PRESETS[presetIndex].name;
};

window.cyclePalette = function () {
  paletteIndex = (paletteIndex + 1) % PALETTES.length;
  document.getElementById('palBtn').textContent = 'Palette: ' + PALETTES[paletteIndex].name;
};

window.addSeed = function () { bassInject(); };

window.toggleFullscreen = function () {
  const btn = document.getElementById('fsBtn');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      document.body.classList.add('fullscreen-mode');
      btn.textContent = '✕ Exit Fullscreen';
    });
  } else {
    document.exitFullscreen().then(() => {
      document.body.classList.remove('fullscreen-mode');
      btn.textContent = '⛶ Fullscreen';
    });
  }
};

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    document.body.classList.remove('fullscreen-mode');
    const b = document.getElementById('fsBtn');
    if (b) b.textContent = '⛶ Fullscreen';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') window.cyclePalette();
  if (e.key === 'n' || e.key === 'N') window.nextPreset();
  if (e.key === ' ')  { e.preventDefault(); window.togglePause(); }
  if (e.key === 'r' || e.key === 'R') window.resetSim();
});

canvas.addEventListener('mousemove', (e) => {
  if (e.buttons !== 1) return;
  seedBlob(Math.floor(e.clientX / SIM_SCALE), Math.floor(e.clientY / SIM_SCALE), 6);
});
canvas.addEventListener('click', (e) => {
  seedBlob(Math.floor(e.clientX / SIM_SCALE), Math.floor(e.clientY / SIM_SCALE), 8);
});

window.addEventListener('resize', resize);
resize();
loop();
