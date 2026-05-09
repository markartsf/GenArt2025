// Curl Noise Flow Field — Audio Reactive
// Organic particle field driven by the curl of a time-evolving simplex noise potential.
//
// Audio mapping:
//   Spectral centroid → noise scale  (high notes = fine-grain field; bass notes = wide swirls)
//   Bass              → field evolution speed  (bass pulses = flow accelerates)
//   RMS               → particle speed  (overall energy = faster drift)
//   Beat / flux burst → turbulence injection  (transient = high-freq noise layer)
//
// Colour: each particle has its own hue sampled from a curated palette at birth.
//   Centroid shifts the global hue temperature (warm push at low centroid,
//   cool push at high centroid) so the composition changes colour mood with the music.
// Width: three tiers — fine threads, standard strokes, bold brushstrokes.
//   Thick particles are more transparent; thin ones are more opaque so all tiers read equally.
//
// Controls:
//   R key → clear canvas & respawn particles
//   F key → fullscreen
//   Load Audio → use your own audio file

import * as Tone from 'tone';

// ─── Audio config ──────────────────────────────────────────────────────────────
const PRELOAD_SRC     = '/curl-flow/midnight-corner-table.mp3';
const BASS_NORM       = 1 / 0.18;   // calibrated for Midnight Corner Table
const MID_NORM        = 1 / 0.15;
const HIGH_NORM       = 1 / 0.03;
const BEAT_THRESHOLD  = 0.012;      // local RMS delta for beat detection
const FLUX_THRESHOLD  = 1.5;        // spectral flux threshold (dB/bin)
const BEAT_COOLDOWN_F = 10;         // min frames between beats
const RMS_WIN         = 10;         // rolling RMS window (frames)
const CENTROID_MAX_HZ = 8000;       // normalise spectral centroid over 0–8 kHz

// ─── Visual config ─────────────────────────────────────────────────────────────
const PARTICLE_COUNT   = 5000;
const MAX_AGE_MIN      = 160;       // particle min lifetime (frames)
const MAX_AGE_MAX      = 300;       // particle max lifetime (frames)

// Noise scale: spectral centroid is the primary driver
//   Low centroid  (bass notes)  → 0.0018 → large lazy swirls
//   High centroid (piano highs) → 0.0055 → tight, fine-grained vortices
const NOISE_SCALE_MIN  = 0.0018;
const NOISE_SCALE_MAX  = 0.0055;

// Speed: RMS drives overall particle velocity
const SPEED_BASE       = 170;       // px/frame factor at silence
const SPEED_RMS        = 480;       // extra px/frame factor at full RMS

// Field time: bass drives how fast the noise field evolves
const TIME_SPEED_MIN   = 0.00022;   // very slow drift at silence
const TIME_SPEED_MAX   = 0.00095;   // fast churn at full bass

// Turbulence on beat: second noise octave injected proportional to beatFlash
const TURB_SCALE_MULT  = 5;         // turbulence at 5× base frequency
const TURB_STRENGTH    = 0.55;      // max turbulence mix at beatFlash=1

// Trail: semi-transparent background rect per frame — controls persistence
// Slower fade gives thick strokes time to accumulate into sweeping arcs
const TRAIL_ALPHA      = 0.007;     // ≈ 140-frame fade (≈2.3s at 60fps)

// ─── Three width tiers, each on its own noise field ───────────────────────────
//
// The key insight: thick and thin lines DON'T have to follow the same field.
//   Tier 0 (thin)   → fine-detail field, full noiseScale, fast evolution
//   Tier 1 (medium) → intermediate field, half scale, medium evolution
//   Tier 2 (thick)  → coarse field, 1/5 scale, slow evolution
//
// This creates a painting with THREE simultaneous flow systems:
//   - Hair-thin threads tracing intricate fast-changing vortices
//   - Medium strokes following fluid mid-scale sweeps
//   - Bold brushstrokes sweeping in wide, lazy, slowly-turning arcs
//
// TIER_NOISE_SCALE: multiplies the base noiseScale per tier
// TIER_TIME_MULT:   multiplies noiseTime — thick fields evolve much slower
// TIER_SPEED_MULT:  compensates for lower curl magnitude at coarser scales
//                   so all tiers move at comparable absolute pixel velocities
const TIER_NOISE_SCALE = [1.00, 0.45, 0.20];   // fine → medium → coarse
const TIER_TIME_MULT   = [1.00, 0.55, 0.25];   // fast → medium → slow evolution
const TIER_SPEED_MULT  = [1.00, 2.20, 5.50];   // boost to equalise movement

// Width ranges per tier
const W_THIN_MIN  =  0.5;  const W_THIN_MAX  =  1.3;   // fine threads
const W_MED_MIN   =  2.2;  const W_MED_MAX   =  5.0;   // fluid strokes
const W_THICK_MIN =  7.0;  const W_THICK_MAX = 14.0;   // bold brushstrokes

// Population split
const TIER_PROBS = [0.55, 0.30, 0.15];   // thin 55%, medium 30%, thick 15%

// ─── Winter colour palette ────────────────────────────────────────────────────
// All hues in cold 183–305° range: aqua → ice → sky → royal → indigo → purple → lavender
// Per-tier colour character:
//   Thin   → vivid, fully saturated jewel-tone blues/purples (fine detail pops)
//   Medium → moderate saturation, fluid mid-register
//   Thick  → pale, desaturated, near-white (icy frost / snow brushstrokes)
//
// Centroid shifts palette temperature within the winter range:
//   Low centroid  → push toward deep indigo/violet (dark winter sky)
//   High centroid → push toward aqua/ice (bright frost/snow light)
const PALETTE_HUES    = [183, 195, 206, 217, 230, 244, 258, 272, 288, 303];
//                       aqua  icy  sky  blue  roy  peri  ind  pur  vio  lav
const PALETTE_WEIGHTS = [0.07, 0.16, 0.18, 0.18, 0.14, 0.10, 0.08, 0.05, 0.03, 0.01];
const _PALETTE_CDF    = PALETTE_WEIGHTS.reduce((acc, w, i) => {
  acc.push((acc[i - 1] || 0) + w); return acc;
}, []);

const TIER_SAT        = [92, 68, 38];         // thin=vivid  thick=icy/frosted
const TIER_LIT_BASE   = [56, 63, 70];         // thick lighter but not blowing out
const TIER_BASE_ALPHA = [0.78, 0.52, 0.18];   // thick kept subtle so overlap doesn't wash
const LIT_BEAT        = 10;                   // gentler beat flash — was 20, caused pure-white
const HUE_TEMP_RANGE  = 20;                   // ±20° centroid-driven palette shift

// Background: deep midnight navy
const BG_R = 6, BG_G = 8, BG_B = 20;

// Epsilon for curl finite difference (pixels)
const EPS = 1.0;

// ─── Palette + tier helpers ────────────────────────────────────────────────────
function _pickHue() {
  const r = Math.random();
  for (let i = 0; i < _PALETTE_CDF.length; i++) {
    if (r <= _PALETTE_CDF[i]) return PALETTE_HUES[i];
  }
  return PALETTE_HUES[PALETTE_HUES.length - 1];
}

function _pickTier() {
  const r = Math.random();
  if (r < TIER_PROBS[0])                    return 0;
  if (r < TIER_PROBS[0] + TIER_PROBS[1])   return 1;
  return 2;
}

function _pickWidth(tier) {
  if (tier === 0) return W_THIN_MIN  + Math.random() * (W_THIN_MAX  - W_THIN_MIN);
  if (tier === 1) return W_MED_MIN   + Math.random() * (W_MED_MAX   - W_MED_MIN);
                  return W_THICK_MIN + Math.random() * (W_THICK_MAX  - W_THICK_MIN);
}

// ─── Simplex Noise 2D ─────────────────────────────────────────────────────────
// Based on Stefan Gustavson / Ashima Research reference implementation (MIT)
const _perm  = new Uint8Array(512);
const _grad2 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];

(function _initNoise() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.random() * (i + 1) | 0;
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) _perm[i] = p[i & 255];
})();

function _dot2(g, x, y) { return g[0] * x + g[1] * y; }

function simplex2(xin, yin) {
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const s  = (xin + yin) * F2;
  const i  = Math.floor(xin + s);
  const j  = Math.floor(yin + s);
  const t  = (i + j) * G2;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  const ii = i & 255;
  const jj = j & 255;
  const gi0 = _perm[ii +      _perm[jj     ]] & 7;
  const gi1 = _perm[ii + i1 + _perm[jj + j1]] & 7;
  const gi2 = _perm[ii + 1  + _perm[jj + 1 ]] & 7;
  let n0 = 0, n1 = 0, n2 = 0, tt;
  tt = 0.5 - x0*x0 - y0*y0; if (tt > 0) { tt *= tt; n0 = tt * tt * _dot2(_grad2[gi0], x0, y0); }
  tt = 0.5 - x1*x1 - y1*y1; if (tt > 0) { tt *= tt; n1 = tt * tt * _dot2(_grad2[gi1], x1, y1); }
  tt = 0.5 - x2*x2 - y2*y2; if (tt > 0) { tt *= tt; n2 = tt * tt * _dot2(_grad2[gi2], x2, y2); }
  return 70 * (n0 + n1 + n2);
}

// ─── Curl of 2D scalar potential ──────────────────────────────────────────────
// Potential: φ(x,y) = simplex2(x·s, y·s + t)
// curl_x =  ∂φ/∂y   curl_y = −∂φ/∂x   (divergence-free)
function _curl(px, py, scale, timeOff) {
  const inv2eps = 0.5 / EPS;
  const nx = px * scale;
  const ny = py * scale + timeOff;
  const vx = (simplex2(nx, ny + EPS * scale) - simplex2(nx, ny - EPS * scale)) * inv2eps;
  const vy = -(simplex2(nx + EPS * scale, ny) - simplex2(nx - EPS * scale, ny)) * inv2eps;
  return [vx, vy];
}

// ─── Module state ──────────────────────────────────────────────────────────────
let canvas, ctx, W, H, dpr;
let player = null, waveAnalyzer = null, fftAnalyzer = null;
let isPlaying = false;

// Particle array — each: { x, y, px, py, age, maxAge, hue, tier, width, baseAlpha, born }
let particles = [];
let noiseTime = 0;

// Smoothed audio bands
let sBass = 0, sMid = 0, sHigh = 0, sRMS = 0, sCentroid = 0;
let rawRMS = 0, avgRMS = 0;
let rmsWin        = new Array(RMS_WIN).fill(0);
let beatFlash     = 0;
let beatCooldown  = 0;
let beatTimes     = [];
let estimatedBPM  = 120;
let lastBeatTime  = 0;
let spectralFlux  = 0;
let prevSpectrum  = null;

// ─── Particle helpers ──────────────────────────────────────────────────────────
function _makeParticle(randomAge) {
  const maxAge = (MAX_AGE_MIN + Math.random() * (MAX_AGE_MAX - MAX_AGE_MIN)) | 0;
  const tier   = _pickTier();
  const width  = _pickWidth(tier);
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    px: 0, py: 0,
    age:       randomAge ? (Math.random() * maxAge) | 0 : 0,
    maxAge,
    hue:       _pickHue(),
    tier,                          // 0=thin 1=medium 2=thick — determines noise field
    width,
    baseAlpha: TIER_BASE_ALPHA[tier],
    born:      false,
  };
}

function _respawn(p) {
  p.x         = Math.random() * W;
  p.y         = Math.random() * H;
  p.age       = 0;
  p.maxAge    = (MAX_AGE_MIN + Math.random() * (MAX_AGE_MAX - MAX_AGE_MIN)) | 0;
  p.hue       = _pickHue();
  p.tier      = _pickTier();
  p.width     = _pickWidth(p.tier);
  p.baseAlpha = TIER_BASE_ALPHA[p.tier];
  p.born      = false;
}

function _initParticles() {
  particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(_makeParticle(true));
}

// ─── Init ──────────────────────────────────────────────────────────────────────
function init() {
  canvas = document.getElementById('c');
  ctx    = canvas.getContext('2d');

  _resize();
  window.addEventListener('resize', _resize);
  document.addEventListener('fullscreenchange', () => setTimeout(_resize, 50));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') _toggleFullscreen();
    if (e.key === 'r' || e.key === 'R') _clearField();
  });

  _setupAudio();
  _drawBackground();
  requestAnimationFrame(_loop);
}

// ─── Resize ────────────────────────────────────────────────────────────────────
function _resize() {
  dpr = window.devicePixelRatio || 1;
  W   = window.innerWidth;
  H   = window.innerHeight;
  canvas.width        = W * dpr;
  canvas.height       = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  _initParticles();
  _drawBackground();
}

function _drawBackground() {
  ctx.shadowBlur = 0;
  ctx.fillStyle  = `rgb(${BG_R}, ${BG_G}, ${BG_B})`;
  ctx.fillRect(0, 0, W, H);
}

function _clearField() {
  _drawBackground();
  _initParticles();
  noiseTime = 0;
}

// ─── Audio setup ───────────────────────────────────────────────────────────────
function _setupAudio() {
  waveAnalyzer = new Tone.Analyser('waveform', 1024);
  fftAnalyzer  = new Tone.Analyser('fft', 512);
  _loadTrack(PRELOAD_SRC);

  document.getElementById('playBtn').addEventListener('click', _togglePlay);
  document.getElementById('stopBtn').addEventListener('click', _stop);
  document.getElementById('clearBtn').addEventListener('click', _clearField);
  document.getElementById('audioFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    _setStatus(`Loading ${f.name}…`, 'loading');
    await _loadTrackFromFile(URL.createObjectURL(f), f.name);
  });
  document.getElementById('fullscreenBtn').addEventListener('click', _toggleFullscreen);
}

function _loadTrack(url) {
  _setStatus('Loading audio…', 'loading');
  if (player) { if (isPlaying) { player.stop(); isPlaying = false; } player.dispose(); }
  player = new Tone.Player(url, () => {
    document.getElementById('playBtn').disabled = false;
    document.getElementById('stopBtn').disabled = false;
    _setStatus('Ready — Press Play', 'ready');
  }).toDestination();
  player.volume.value = 0;
  player.loop = true;
  player.connect(waveAnalyzer);
  player.connect(fftAnalyzer);
}

async function _loadTrackFromFile(url, name) {
  if (player) { if (isPlaying) { player.stop(); isPlaying = false; } player.dispose(); }
  return new Promise(resolve => {
    player = new Tone.Player(url, () => {
      document.getElementById('playBtn').disabled = false;
      document.getElementById('stopBtn').disabled = false;
      _setStatus(`Ready — ${name}`, 'ready');
      resolve();
    }).toDestination();
    player.volume.value = 0;
    player.loop = true;
    player.connect(waveAnalyzer);
    player.connect(fftAnalyzer);
  });
}

async function _togglePlay() {
  if (!player) return;
  if (isPlaying) {
    player.stop(); isPlaying = false;
    document.getElementById('playBtn').textContent = 'Play';
  } else {
    try {
      await Tone.start();
      await Tone.getContext().resume();  // ensure AudioContext is running
      player.start();
      isPlaying = true;
      document.getElementById('playBtn').textContent = 'Pause';
    } catch (err) {
      _setStatus(`Audio error: ${err.message}`, 'loading');
      console.error('Tone.js start error:', err);
    }
  }
}

function _stop() {
  if (!player) return;
  player.stop(); isPlaying = false;
  document.getElementById('playBtn').textContent = 'Play';
  sBass = sMid = sHigh = sRMS = sCentroid = rawRMS = avgRMS = 0;
  spectralFlux = 0; prevSpectrum = null;
  rmsWin = new Array(RMS_WIN).fill(0);
  beatFlash = 0; beatCooldown = 0;
  _setStatus('Stopped. Press Play.', 'ready');
}

function _toggleFullscreen() {
  const el = document.getElementById('container');
  if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
  else document.exitFullscreen();
}

function _setStatus(msg, cls) {
  const el = document.getElementById('status');
  el.textContent = msg; el.className = cls || '';
}

// ─── Audio analysis ────────────────────────────────────────────────────────────
function _readAudio() {
  if (!isPlaying) return;

  // FFT → band energies + spectral centroid
  const spec      = fftAnalyzer.getValue();
  const bins      = spec.length;
  const bEnd      = Math.floor(bins * 0.10);
  const mEnd      = Math.floor(bins * 0.50);
  const sampleRate = Tone.getContext().sampleRate;
  const binHz     = sampleRate / (2 * bins);

  let bSum = 0, mSum = 0, hSum = 0;
  let centroidNum = 0, centroidDen = 0;
  for (let i = 0; i < bins; i++) {
    const lin = Math.pow(10, spec[i] / 20);
    if      (i < bEnd) bSum += lin;
    else if (i < mEnd) mSum += lin;
    else               hSum += lin;
    centroidNum += i * binHz * lin;
    centroidDen += lin;
  }
  const rawBass       = bSum / bEnd;
  const rawMid        = mSum / (mEnd - bEnd);
  const rawHigh       = hSum / (bins - mEnd);
  const rawCentroid01 = centroidDen > 0
    ? Math.min(1, (centroidNum / centroidDen) / CENTROID_MAX_HZ)
    : 0.3;

  // Waveform → RMS
  const wf = waveAnalyzer.getValue();
  let sq = 0;
  for (const v of wf) sq += v * v;
  rawRMS = Math.sqrt(sq / wf.length);

  // Per-band smoothing — bass/mid slow (shape breathes), high/centroid faster
  sBass     += 0.08 * (Math.min(1, rawBass * BASS_NORM) - sBass);
  sMid      += 0.07 * (Math.min(1, rawMid  * MID_NORM)  - sMid);
  sHigh     += 0.18 * (Math.min(1, rawHigh * HIGH_NORM) - sHigh);
  sRMS      += 0.10 * (rawRMS - sRMS);
  sCentroid += 0.12 * (rawCentroid01 - sCentroid);

  // Spectral flux — transient detector
  let fluxRaw = 0;
  if (prevSpectrum !== null) {
    for (let i = 0; i < bins; i++)
      fluxRaw += Math.max(0, spec[i] - prevSpectrum[i]);
    fluxRaw /= bins;
  }
  prevSpectrum = Array.from(spec);
  spectralFlux += 0.5 * (fluxRaw - spectralFlux);

  // Beat detection: dual RMS delta + spectral flux
  rmsWin.shift(); rmsWin.push(rawRMS);
  avgRMS = rmsWin.reduce((s, v) => s + v, 0) / RMS_WIN;

  const beatByRMS  = (rawRMS - avgRMS) > BEAT_THRESHOLD;
  const beatByFlux = spectralFlux > FLUX_THRESHOLD;

  if ((beatByRMS || beatByFlux) && beatCooldown <= 0) {
    beatFlash    = 1.0;
    beatCooldown = BEAT_COOLDOWN_F;
    const now = performance.now();
    if (lastBeatTime > 0) {
      const interval = now - lastBeatTime;
      beatTimes.push(interval);
      if (beatTimes.length > 8) beatTimes.shift();
      if (beatTimes.length >= 4) {
        const avgI = beatTimes.reduce((s, v) => s + v, 0) / beatTimes.length;
        estimatedBPM = Math.max(60, Math.min(180, 60000 / avgI));
      }
    }
    lastBeatTime = now;
  }
  beatFlash    *= 0.85;
  beatCooldown  = Math.max(0, beatCooldown - 1);

  // Level meters
  document.getElementById('bassMeter').style.height = (sBass * 100) + '%';
  document.getElementById('midMeter').style.height  = (sMid  * 100) + '%';
  document.getElementById('highMeter').style.height = (sHigh * 100) + '%';

  const beatSrc = beatByFlux ? 'F' : (beatByRMS ? 'R' : '-');
  _setStatus(
    `BPM:${Math.round(estimatedBPM)}  C:${sCentroid.toFixed(2)}  [${beatSrc}]  B:${sBass.toFixed(2)} M:${sMid.toFixed(2)} H:${sHigh.toFixed(2)}`,
    'ready'
  );
}

// ─── Main render loop ──────────────────────────────────────────────────────────
function _loop() {
  requestAnimationFrame(_loop);
  _readAudio();

  // ── Audio-derived field parameters ────────────────────────────────────────
  // When stopped: centroid=0 → widest swirls, base speed, base time rate
  const noiseScale    = NOISE_SCALE_MIN + sCentroid * (NOISE_SCALE_MAX - NOISE_SCALE_MIN);
  const timeSpeed     = TIME_SPEED_MIN  + sBass     * (TIME_SPEED_MAX  - TIME_SPEED_MIN);
  const speed         = SPEED_BASE + sRMS * SPEED_RMS;
  const turbStrength  = beatFlash * TURB_STRENGTH;
  const turbScale     = noiseScale * TURB_SCALE_MULT;
  const turbTimeOff   = noiseTime * 2.7 + 37.3; // uncorrelated turbulence region
  // Global hue temperature shift within winter range:
  //   centroid=0 (bass) → +20° push toward deeper indigo/violet
  //   centroid=1 (highs) → −20° push toward aqua/ice
  const hueShift      = HUE_TEMP_RANGE * (1 - 2 * sCentroid);
  const beatLit       = beatFlash * LIT_BEAT; // added to per-tier lightness on beat

  // ── Advance noise field time ───────────────────────────────────────────────
  noiseTime += timeSpeed;

  // ── Phosphor trail: fade canvas toward navy ────────────────────────────────
  ctx.fillStyle = `rgba(${BG_R}, ${BG_G}, ${BG_B}, ${TRAIL_ALPHA})`;
  ctx.fillRect(0, 0, W, H);

  // ── Update and draw all particles ─────────────────────────────────────────
  ctx.shadowBlur = 0;

  for (const p of particles) {
    // On first frame after spawn/respawn: record position without drawing
    if (!p.born) { p.px = p.x; p.py = p.y; p.born = true; }

    // Age particle; respawn if expired or wandered off canvas
    p.age++;
    if (p.age >= p.maxAge ||
        p.x < -10 || p.x > W + 10 ||
        p.y < -10 || p.y > H + 10) {
      _respawn(p);
      continue;
    }

    // Tier-specific noise field: each tier follows a different scale/time
    const ns  = noiseScale * TIER_NOISE_SCALE[p.tier];
    const nt  = noiseTime  * TIER_TIME_MULT[p.tier];
    const spd = speed      * TIER_SPEED_MULT[p.tier];

    // Compute base curl velocity from this tier's field
    let [vx, vy] = _curl(p.x, p.y, ns, nt);

    // Add turbulence proportional to beatFlash (applies to all tiers)
    if (turbStrength > 0.01) {
      const [tvx, tvy] = _curl(p.x, p.y, turbScale, turbTimeOff);
      vx += tvx * turbStrength;
      vy += tvy * turbStrength;
    }

    // Move particle
    p.px = p.x;
    p.py = p.y;
    p.x += vx * spd;
    p.y += vy * spd;

    // Life-cycle alpha: fade in over first 25 frames, fade out over last 20%
    const lifeT   = p.age / p.maxAge;
    const fadeIn  = Math.min(1, p.age / 25);
    const fadeOut = lifeT > 0.8 ? (1 - lifeT) / 0.2 : 1.0;
    const alpha   = fadeIn * fadeOut * p.baseAlpha;

    // Per-particle colour: tier determines saturation + lightness character
    const pHue = ((p.hue + hueShift) + 360) % 360 | 0;
    const pSat = TIER_SAT[p.tier];
    const pLit = (TIER_LIT_BASE[p.tier] + beatLit) | 0;
    ctx.lineWidth   = p.width;
    ctx.strokeStyle = `hsla(${pHue}, ${pSat}%, ${pLit}%, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(p.px, p.py);
    ctx.lineTo(p.x,  p.y);
    ctx.stroke();
  }
}

// ─── Boot ──────────────────────────────────────────────────────────────────────
init();
