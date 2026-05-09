// Lissajous Oscilloscope Web
// XY-mode phase-portrait drawn from live audio waveform.
// Five overlapping traces create a web/braid of glowing phosphor lines.
//
// Audio mapping:
//   Bass  → phase offset between X and Y channels (bends Lissajous ratio)
//   Mid   → spread between traces (widens or tightens the web)
//   High  → hue shift (electric cyan → violet)
//   Beat  → brightness burst + glow expansion
//
// Behaviour:
//   Stopped → completely frozen (black canvas with a faint centre dot)
//   Playing → phosphor persistence trail, traces update every frame
//   Scroll  → zoom in / out
//   F key   → fullscreen   R key → reset zoom

import * as Tone from 'tone';

// ─── Audio config ──────────────────────────────────────────────────────────────
const PRELOAD_SRC     = '/clifford-attractor/BreathBetweenCircuits.mp3';
const BASS_NORM       = 1 / 0.18;   // calibrated for BreathBetweenCircuits LRA 11.6
const MID_NORM        = 1 / 0.15;
const HIGH_NORM       = 1 / 0.03;
const BEAT_THRESHOLD  = 0.012;      // local RMS delta for beat detection
const FLUX_THRESHOLD  = 1.5;        // spectral flux threshold (dB/bin)
const BEAT_COOLDOWN_F = 10;         // frames between beats (handles 160 BPM @ 60fps)
const RMS_WIN         = 10;         // rolling RMS window length (frames)

// ─── Visual config ─────────────────────────────────────────────────────────────
const TRACE_COUNT     = 5;     // overlapping traces for the "web" look
const PHASE_BASE      = 200;   // base sample offset: Y lags X by this many samples
const PHASE_AMP       = 130;   // bass modulates phase offset by up to ±this amount
const PHASE_SPREAD    = 28;    // sample offset spread between adjacent traces
const POINT_COUNT     = 1024;  // samples drawn per trace (full waveform buffer)
const TRAIL_ALPHA     = 0.020; // phosphor decay: background fade per frame
const HUE_BASE        = 195;   // electric cyan-blue (°)
const HUE_RANGE       = 80;    // shifts toward violet (275°) with high energy
const LIT_BASE        = 50;    // base lightness (%)
const LIT_BEAT        = 22;    // extra lightness on beat (%)
const GLOW_BASE       = 10;    // shadowBlur base (px)
const GLOW_BEAT       = 28;    // extra shadowBlur on beat (px)
const LINE_BASE       = 1.2;   // line width base (px)
const LINE_BEAT       = 2.8;   // line width on full beat
const SCALE_BASE      = 0.36;  // fraction of min(W,H) for figure radius
const SCALE_BASS      = 0.10;  // bass adds up to this fraction to the radius

// ─── Module state ──────────────────────────────────────────────────────────────
let canvas, ctx, W, H, dpr;
let player = null, waveAnalyzer = null, fftAnalyzer = null;
let isPlaying = false;

// Smoothed audio bands (slow alphas → shape breathes, not jerks)
let sBass = 0, sMid = 0, sHigh = 0, sRMS = 0;
let rawRMS = 0, avgRMS = 0;
let rmsWin        = new Array(RMS_WIN).fill(0);
let beatFlash     = 0;
let beatCooldown  = 0;
let beatTimes     = [];
let estimatedBPM  = 120;
let lastBeatTime  = 0;
let spectralFlux  = 0;
let prevSpectrum  = null;
let currentWF     = null;   // latest waveform buffer (Float32Array, 1024 samples)

// User zoom (scroll wheel)
let userScale = 1.0;

// ─── Init ──────────────────────────────────────────────────────────────────────
function init() {
  canvas = document.getElementById('c');
  ctx    = canvas.getContext('2d');

  _resize();
  window.addEventListener('resize', _resize);
  document.addEventListener('fullscreenchange', () => setTimeout(_resize, 50));

  window.addEventListener('wheel', (e) => {
    userScale *= (1 - e.deltaY * 0.001);
    userScale  = Math.max(0.2, Math.min(4.0, userScale));
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') _toggleFullscreen();
    if (e.key === 'r' || e.key === 'R') { userScale = 1.0; }
  });

  _setupAudio();
  _drawFrozen();
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
  _drawFrozen();
}

// ─── Frozen state ──────────────────────────────────────────────────────────────
// Black canvas with a single faint dot — hints the sketch is ready.
function _drawFrozen() {
  ctx.shadowBlur = 0;
  ctx.fillStyle  = '#000';
  ctx.fillRect(0, 0, W, H);

  ctx.shadowBlur  = 18;
  ctx.shadowColor = 'rgba(0, 180, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 200, 255, 0.55)';
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ─── Audio setup ───────────────────────────────────────────────────────────────
function _setupAudio() {
  waveAnalyzer = new Tone.Analyser('waveform', 1024);
  fftAnalyzer  = new Tone.Analyser('fft', 512);
  _loadTrack(PRELOAD_SRC);

  document.getElementById('playBtn').addEventListener('click', _togglePlay);
  document.getElementById('stopBtn').addEventListener('click', _stop);
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
    await Tone.start(); player.start(); isPlaying = true;
    document.getElementById('playBtn').textContent = 'Pause';
  }
}

function _stop() {
  if (!player) return;
  player.stop(); isPlaying = false;
  document.getElementById('playBtn').textContent = 'Play';

  // Reset all audio state
  sBass = sMid = sHigh = sRMS = rawRMS = avgRMS = 0;
  spectralFlux = 0; prevSpectrum = null; currentWF = null;
  rmsWin = new Array(RMS_WIN).fill(0);
  beatFlash = 0; beatCooldown = 0;

  _setStatus('Stopped. Press Play.', 'ready');
  _drawFrozen();
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

  // FFT → band energies
  const spec = fftAnalyzer.getValue();
  const bins  = spec.length;
  const bEnd  = Math.floor(bins * 0.10);
  const mEnd  = Math.floor(bins * 0.50);

  let bSum = 0, mSum = 0, hSum = 0;
  for (let i = 0; i < bins; i++) {
    const lin = Math.pow(10, spec[i] / 20);
    if      (i < bEnd) bSum += lin;
    else if (i < mEnd) mSum += lin;
    else               hSum += lin;
  }
  const rawBass = bSum / bEnd;
  const rawMid  = mSum / (mEnd - bEnd);
  const rawHigh = hSum / (bins - mEnd);

  // Waveform → RMS + store for drawing
  currentWF = waveAnalyzer.getValue();
  let sq = 0;
  for (const v of currentWF) sq += v * v;
  rawRMS = Math.sqrt(sq / currentWF.length);

  // Per-band smoothing — bass/mid slow (gradual shape morph), high faster
  sBass += 0.08 * (Math.min(1, rawBass * BASS_NORM) - sBass);
  sMid  += 0.07 * (Math.min(1, rawMid  * MID_NORM)  - sMid);
  sHigh += 0.18 * (Math.min(1, rawHigh * HIGH_NORM) - sHigh);
  sRMS  += 0.10 * (rawRMS - sRMS);

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
    `BPM:${Math.round(estimatedBPM)}  RMS:${rawRMS.toFixed(3)}  [${beatSrc}]  B:${sBass.toFixed(2)} M:${sMid.toFixed(2)} H:${sHigh.toFixed(2)}`,
    'ready'
  );
}

// ─── Draw one Lissajous trace ──────────────────────────────────────────────────
// wf        — Float32Array of 1024 samples in [-1, 1]
// phase     — sample offset: Y = wf[(i + phase) % N]  (controls Lissajous ratio)
// hue       — HSL hue (°)
// traceAlpha — opacity of the stroke
// lineWidth — canvas line width
// glowBlur  — shadowBlur (px)
function _drawTrace(wf, phase, hue, traceAlpha, lineWidth, glowBlur) {
  const N    = wf.length;
  const cx   = W / 2;
  const cy   = H / 2;
  const scale = Math.min(W, H) * (SCALE_BASE + sBass * SCALE_BASS) * userScale;
  const lit   = LIT_BASE + beatFlash * LIT_BEAT;
  const color = `hsla(${hue | 0}, 100%, ${lit | 0}%, ${traceAlpha.toFixed(3)})`;

  ctx.shadowBlur  = glowBlur;
  ctx.shadowColor = `hsla(${hue | 0}, 100%, 70%, 0.75)`;
  ctx.strokeStyle = color;
  ctx.lineWidth   = lineWidth;

  ctx.beginPath();
  const phaseInt = Math.round(phase) % N;
  for (let i = 0; i < POINT_COUNT; i++) {
    const xi = i % N;
    const yi = (xi + phaseInt + N) % N;
    const x  = cx + wf[xi] * scale;
    const y  = cy + wf[yi] * scale;
    if (i === 0) ctx.moveTo(x, y);
    else         ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ─── Main render loop ──────────────────────────────────────────────────────────
function _loop() {
  requestAnimationFrame(_loop);
  _readAudio();

  // FROZEN: do nothing when stopped
  if (!isPlaying || !currentWF) return;

  // ── Phosphor trail: fade canvas toward black ──────────────────────────────
  ctx.shadowBlur = 0;
  ctx.fillStyle  = `rgba(0, 0, 0, ${TRAIL_ALPHA})`;
  ctx.fillRect(0, 0, W, H);

  // ── Audio-driven visual parameters ────────────────────────────────────────
  const basePhase = PHASE_BASE + sBass * PHASE_AMP;   // bass bends Lissajous ratio
  const spread    = PHASE_SPREAD + sMid * 50;          // mids widen the web
  const baseHue   = HUE_BASE + sHigh * HUE_RANGE;     // highs shift toward violet
  const glowBlur  = GLOW_BASE + beatFlash * GLOW_BEAT;
  const lineWidth = LINE_BASE + sBass * 1.0 + beatFlash * (LINE_BEAT - LINE_BASE);

  // ── Draw TRACE_COUNT traces with staggered phases and hues ────────────────
  for (let t = 0; t < TRACE_COUNT; t++) {
    const tNorm     = t / (TRACE_COUNT - 1);                // 0 → 1
    const phase     = basePhase + (t - (TRACE_COUNT - 1) / 2) * spread;
    const hue       = baseHue + t * 12;                     // slight hue spread
    // Inner traces slightly dimmer, outer traces slightly brighter
    const traceAlpha = 0.45 + tNorm * 0.35;
    _drawTrace(currentWF, phase, hue, traceAlpha, lineWidth, glowBlur);
  }

  // Reset shadow after all traces
  ctx.shadowBlur = 0;
}

// ─── Boot ──────────────────────────────────────────────────────────────────────
init();
