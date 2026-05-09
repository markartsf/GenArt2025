// =============================================================
// LISSAJOUS WEB  —  Canvas API
// Stereo waveform plotter with dual-instrument reactivity
//
// Two visual systems:
//   VIOLIN  (700Hz–5kHz)  → web persistence, color temperature, glow
//   BASS PLUCK (60–350Hz) → flash bursts, radial pulses, color flares
// =============================================================

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// ─── State ────────────────────────────────────────────────────
let audioCtx    = null;
let sourceNode  = null;
let analyserL   = null;
let analyserR   = null;
let analyserFFT = null;
let bufferL, bufferR, freqData;
let startedAt   = 0;
let pausedAt    = 0;
let isPlaying   = false;
let audioBuffer = null;

const FFT_SIZE   = 2048;
const HISTORY    = 120;   // frames kept in the web trail

let histX = [];   // circular buffer of Float32Array
let histY = [];

let msMode      = false;  // XY stereo vs M/S (mid-side)
let paletteIdx  = 0;

// ─── Auto-normaliser per channel ──────────────────────────────
// Tracks a decaying peak so even a compressed track fills the screen
class AutoNorm {
  constructor(attack = 0.05, decay = 0.9995) {
    this.peak  = 0.001;
    this.attack = attack;
    this.decay  = decay;
  }
  process(arr) {
    // Find frame peak
    let framePeak = 0;
    for (let i = 0; i < arr.length; i++) {
      const a = Math.abs(arr[i]);
      if (a > framePeak) framePeak = a;
    }
    // Slowly track it
    if (framePeak > this.peak) {
      this.peak += (framePeak - this.peak) * this.attack;
    } else {
      this.peak *= this.decay;
    }
    this.peak = Math.max(this.peak, 0.001);
    // Normalise
    const out = new Float32Array(arr.length);
    const inv = 0.95 / this.peak;
    for (let i = 0; i < arr.length; i++) out[i] = arr[i] * inv;
    return out;
  }
}
const normL = new AutoNorm();
const normR = new AutoNorm();

// ─── Onset detector (for the staccato bass pluck) ─────────────
// Detects sudden rises in a frequency band relative to recent history
class OnsetDetector {
  constructor(windowSize = 20, threshold = 1.6) {
    this.buf       = new Float32Array(windowSize).fill(0.1);
    this.pos       = 0;
    this.threshold = threshold;
    this.cooldown  = 0;
  }
  feed(energy) {
    const avg = this.buf.reduce((a, b) => a + b) / this.buf.length;
    const onset = (this.cooldown <= 0) && (energy > avg * this.threshold) && (energy > 0.05);
    this.buf[this.pos % this.buf.length] = energy;
    this.pos++;
    if (this.cooldown > 0) this.cooldown--;
    if (onset) this.cooldown = 8;   // 8 frames dead-time after a hit
    return onset;
  }
}

// ─── Smooth follower (one-pole LP) ────────────────────────────
class Follower {
  constructor(up = 0.4, down = 0.92) {
    this.v = 0; this.up = up; this.down = down;
  }
  feed(x) {
    const coef = x > this.v ? this.up : this.down;
    this.v += (x - this.v) * (1 - coef);
    return this.v;
  }
}

const bassOnset   = new OnsetDetector(16, 1.7);
const bassFollow  = new Follower(0.35, 0.90);
const violinFollow= new Follower(0.15, 0.97);
const highFollow  = new Follower(0.20, 0.96);

// Active pulse list for bass-hit ring bursts
let pulses = [];   // { x, y, r, maxR, age, maxAge, color }

// ─── Palettes ─────────────────────────────────────────────────
// [ web-line RGB, bass-burst RGB, background RGB, glow RGB ]
const PALETTES = [
  { web: [30, 180, 255],  bass: [255, 100, 30],   bg: [0, 2, 8],    glow: [0, 140, 255]  },
  { web: [180, 80, 255],  bass: [255, 200, 30],   bg: [5, 0, 10],   glow: [160, 60, 255] },
  { web: [30, 255, 140],  bass: [255, 60, 120],   bg: [0, 8, 4],    glow: [20, 220, 120] },
  { web: [255, 180, 40],  bass: [80, 200, 255],   bg: [8, 4, 0],    glow: [220, 150, 30] },
  { web: [255, 255, 255], bass: [255, 80, 80],     bg: [2, 2, 4],    glow: [200, 200, 255]},
];

let bassFlash  = 0;   // 0-1 flash intensity after onset
let webBrightness = 0;

// ─── Resize ───────────────────────────────────────────────────
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ─── Frequency band helpers ───────────────────────────────────
// At 48 kHz + FFT_SIZE=2048  →  bin width = 23.4 Hz
let BIN_HZ = 48000 / FFT_SIZE;

function bandEnergy(data, loHz, hiHz) {
  const lo = Math.max(1, Math.floor(loHz / BIN_HZ));
  const hi = Math.min(data.length - 1, Math.ceil(hiHz / BIN_HZ));
  let sum = 0;
  for (let i = lo; i <= hi; i++) sum += data[i];
  return sum / ((hi - lo + 1) * 255);
}

// ─── Draw loop ────────────────────────────────────────────────
function draw() {
  requestAnimationFrame(draw);

  const W  = canvas.width;
  const H  = canvas.height;
  const cx = W * 0.5;
  const cy = H * 0.5;
  const scale = Math.min(W, H) * 0.44;
  const pal = PALETTES[paletteIdx];

  // ── If no audio yet, draw idle pattern ──
  if (!analyserL) {
    ctx.fillStyle = `rgb(${pal.bg[0]},${pal.bg[1]},${pal.bg[2]})`;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  // ── Pull audio data ──
  analyserL.getFloatTimeDomainData(bufferL);
  analyserR.getFloatTimeDomainData(bufferR);
  analyserFFT.getByteFrequencyData(freqData);

  // ── Band energies ──
  const bassE   = bandEnergy(freqData,  60,  350);   // bass pluck
  const violinE = bandEnergy(freqData, 700, 5000);   // violin body
  const highE   = bandEnergy(freqData, 5000,16000);  // violin harmonics / air

  const bassHit = bassOnset.feed(bassE);
  bassFlash     = Math.max(bassFlash * 0.84, bassHit ? 1.0 : 0);

  const bassSmooth   = bassFollow.feed(bassE);
  const violinSmooth = violinFollow.feed(violinE);
  const highSmooth   = highFollow.feed(highE);

  webBrightness = Math.min(0.7, 0.2 + violinSmooth * 0.55 + highSmooth * 0.25);

  // ── Update UI meters ──
  document.getElementById('mid-meter').style.width  = (violinSmooth * 200).toFixed(1) + '%';
  document.getElementById('bass-meter').style.width = (bassSmooth * 200).toFixed(1) + '%';
  document.getElementById('high-meter').style.width = (highSmooth * 200).toFixed(1) + '%';

  // ── Time display ──
  if (startedAt > 0) {
    const elapsed = audioCtx.currentTime - startedAt + pausedAt;
    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60);
    document.getElementById('time-label').textContent =
      `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  // ── Compute XY points for this frame ──
  const normedL = normL.process(bufferL);
  const normedR = normR.process(bufferR);

  const fX = new Float32Array(FFT_SIZE);
  const fY = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    if (msMode) {
      // Mid-Side: X = stereo difference, Y = sum
      fX[i] = (normedL[i] - normedR[i]) * 0.75;
      fY[i] = (normedL[i] + normedR[i]) * 0.5;
    } else {
      fX[i] = normedL[i];
      fY[i] = normedR[i];
    }
  }

  histX.push(fX);
  histY.push(fY);
  if (histX.length > HISTORY) { histX.shift(); histY.shift(); }

  // ── Add pulse on bass hit ──
  if (bassHit) {
    pulses.push({
      x: cx, y: cy,
      r: 0,
      maxR: scale * (0.8 + Math.random() * 0.6),
      age: 0,
      maxAge: 40 + Math.floor(Math.random() * 20),
      color: pal.bass,
    });
  }

  // ── Background fade ──
  // Faster fade = less persistence = less web buildup. Slower = denser web.
  const fadeAlpha = 0.07 + bassFlash * 0.04;
  ctx.fillStyle = `rgba(${pal.bg[0]},${pal.bg[1]},${pal.bg[2]},${fadeAlpha})`;
  ctx.fillRect(0, 0, W, H);

  // ── Bass flash: radial bloom ──
  if (bassFlash > 0.02) {
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 1.8);
    const a1 = (bassFlash * 0.25).toFixed(3);
    const a2 = (bassFlash * 0.08).toFixed(3);
    gr.addColorStop(0,   `rgba(${pal.bass[0]},${pal.bass[1]},${pal.bass[2]},${a1})`);
    gr.addColorStop(0.5, `rgba(${pal.bass[0]},${pal.bass[1]},${pal.bass[2]},${a2})`);
    gr.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ── Draw expanding ring pulses (bass hits) ──
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    p.age++;
    p.r = (p.age / p.maxAge) * p.maxR;
    const t = p.age / p.maxAge;           // 0→1 over lifetime
    const alpha = Math.sin(t * Math.PI) * 0.7;   // fade in then out
    const lineW = (1 - t) * 3 + 0.5;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${alpha.toFixed(3)})`;
    ctx.lineWidth = lineW;
    ctx.shadowColor = `rgb(${p.color[0]},${p.color[1]},${p.color[2]})`;
    ctx.shadowBlur  = 15;
    ctx.stroke();

    if (p.age >= p.maxAge) pulses.splice(i, 1);
  }
  ctx.restore();

  // ── Draw history web ──
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const nFrames = histX.length;
  // Downsample: draw every Nth sample for performance
  const step = 3;

  for (let f = 0; f < nFrames; f++) {
    const age  = f / nFrames;   // 0 = oldest, 1 = newest
    // Opacity: old trails fade out, newest is brightest
    const alpha  = Math.pow(age, 2.5) * webBrightness * 0.65;
    const lw     = age * 1.2 + 0.2;

    // Color: blend web color toward bass burst color on flash, cooler for violin
    const bMix = bassFlash * Math.pow(age, 0.5);
    const vMix = violinSmooth * 0.4;
    const r = Math.floor(pal.web[0] + (pal.bass[0] - pal.web[0]) * bMix);
    const g = Math.floor(pal.web[1] + (pal.bass[1] - pal.web[1]) * bMix);
    const b = Math.floor(Math.min(255, pal.web[2] * (1 + vMix)));

    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    ctx.lineWidth   = lw;
    ctx.beginPath();

    const xs = histX[f];
    const ys = histY[f];
    let first = true;
    for (let i = 0; i < xs.length; i += step) {
      const px = cx + xs[i] * scale;
      const py = cy + ys[i] * scale;
      if (first) { ctx.moveTo(px, py); first = false; }
      else        ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();

  // ── Brightest layer: current frame with glow ──
  if (histX.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const brightness = webBrightness;
    ctx.strokeStyle = `rgba(${pal.glow[0]},${pal.glow[1]},${pal.glow[2]},${(brightness * 0.55).toFixed(3)})`;
    ctx.lineWidth   = 1.2;
    ctx.shadowColor = `rgb(${pal.glow[0]},${pal.glow[1]},${pal.glow[2]})`;
    ctx.shadowBlur  = 8 + violinSmooth * 10;

    const xs = histX[histX.length - 1];
    const ys = histY[histY.length - 1];
    ctx.beginPath();
    let first = true;
    for (let i = 0; i < xs.length; i += 2) {
      const px = cx + xs[i] * scale;
      const py = cy + ys[i] * scale;
      if (first) { ctx.moveTo(px, py); first = false; }
      else        ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ── Spectrum ring (outer decorative arc) ──
  drawSpectrumRing(cx, cy, scale * 1.12, freqData, pal);
}

// ─── Spectrum ring: polar FFT around the lissajous ────────────
function drawSpectrumRing(cx, cy, radius, data, pal) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const numBins = 180;   // use 180 bins mapped around the circle
  const maxBin  = Math.floor(data.length * 0.6);
  const ringH   = Math.min(canvas.width, canvas.height) * 0.06;  // max ring height

  ctx.strokeStyle = `rgba(${pal.web[0]},${pal.web[1]},${pal.web[2]},0.5)`;
  ctx.lineWidth   = 1.2;

  for (let i = 0; i < numBins; i++) {
    const binIdx  = Math.floor((i / numBins) * maxBin);
    const energy  = data[binIdx] / 255;
    const angle   = (i / numBins) * Math.PI * 2 - Math.PI * 0.5;
    const inner   = radius;
    const outer   = radius + energy * ringH;

    const x1 = cx + Math.cos(angle) * inner;
    const y1 = cy + Math.sin(angle) * inner;
    const x2 = cx + Math.cos(angle) * outer;
    const y2 = cy + Math.sin(angle) * outer;

    // Color high-energy bins with bass color
    if (energy > 0.6) {
      ctx.strokeStyle = `rgba(${pal.bass[0]},${pal.bass[1]},${pal.bass[2]},${energy * 0.8})`;
    } else {
      ctx.strokeStyle = `rgba(${pal.web[0]},${pal.web[1]},${pal.web[2]},${energy * 0.6})`;
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Audio loading ────────────────────────────────────────────
async function initAudio(arrayBuffer) {
  if (audioCtx) { audioCtx.close(); }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Update bin width for actual sample rate
  BIN_HZ = audioCtx.sampleRate / FFT_SIZE;

  audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  pausedAt = 0;
  startedAt = 0;

  document.getElementById('overlay').style.display = 'none';
  setupAndPlay(0);
}

function setupAndPlay(offset) {
  if (sourceNode) { try { sourceNode.stop(); } catch(e) {} }

  const splitter = audioCtx.createChannelSplitter(2);

  analyserL = audioCtx.createAnalyser();
  analyserL.fftSize = FFT_SIZE;
  analyserL.smoothingTimeConstant = 0.1;   // LOW smoothing so we see raw waveform

  analyserR = audioCtx.createAnalyser();
  analyserR.fftSize = FFT_SIZE;
  analyserR.smoothingTimeConstant = 0.1;

  analyserFFT = audioCtx.createAnalyser();
  analyserFFT.fftSize = FFT_SIZE;
  analyserFFT.smoothingTimeConstant = 0.75;  // smoother for freq bands

  bufferL  = new Float32Array(FFT_SIZE);
  bufferR  = new Float32Array(FFT_SIZE);
  freqData = new Uint8Array(FFT_SIZE / 2);

  sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.loop   = true;
  sourceNode.connect(splitter);
  sourceNode.connect(analyserFFT);
  splitter.connect(analyserL, 0);
  splitter.connect(analyserR, 1);
  analyserFFT.connect(audioCtx.destination);

  sourceNode.start(0, offset);
  startedAt  = audioCtx.currentTime - offset;
  isPlaying  = true;
}

// ─── Controls ─────────────────────────────────────────────────
window.loadBundled = async function () {
  try {
    const resp = await fetch('../dist/assets/circles01a.mp3');
    const ab   = await resp.arrayBuffer();
    await initAudio(ab);
  } catch (e) {
    alert('Could not load circles01a.mp3 — try using the file loader instead.\n' + e.message);
  }
};

window.loadFile = async function (input) {
  const file = input.files[0];
  if (!file) return;
  const ab = await file.arrayBuffer();
  await initAudio(ab);
};

window.togglePlay = function () {
  if (!audioCtx) return;
  if (isPlaying) {
    pausedAt = audioCtx.currentTime - startedAt;
    audioCtx.suspend();
    isPlaying = false;
    document.getElementById('playBtn').textContent = 'Play';
  } else {
    audioCtx.resume();
    startedAt = audioCtx.currentTime - pausedAt;
    isPlaying = true;
    document.getElementById('playBtn').textContent = 'Pause';
  }
};

window.toggleMode = function () {
  msMode = !msMode;
  clearWeb();
  document.getElementById('mode-label').textContent = msMode ? 'Mode: M/S (Mid/Side)' : 'Mode: XY Stereo';
  document.getElementById('modeBtn').textContent    = msMode ? 'XY Mode' : 'M/S Mode';
};

window.cyclePalette = function () {
  paletteIdx = (paletteIdx + 1) % PALETTES.length;
};

window.clearWeb = function () {
  histX = [];
  histY = [];
  pulses = [];
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
};

window.toggleFullscreen = function () {
  const btn = document.getElementById('fsBtn');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      document.body.classList.add('fullscreen-mode');
      btn.textContent = '✕ Exit Fullscreen';
    }).catch(err => console.warn('Fullscreen error:', err));
  } else {
    document.exitFullscreen().then(() => {
      document.body.classList.remove('fullscreen-mode');
      btn.textContent = '⛶ Fullscreen';
    });
  }
};

// Also exit fullscreen state when ESC is pressed (browser handles the exit,
// but we need to update the button label)
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    document.body.classList.remove('fullscreen-mode');
    const btn = document.getElementById('fsBtn');
    if (btn) btn.textContent = '⛶ Fullscreen';
  }
});

// ─── Kick it off ──────────────────────────────────────────────
draw();
