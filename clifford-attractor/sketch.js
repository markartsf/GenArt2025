// Clifford Attractor — Audio-Reactive Density Map
// Accumulating dot density reveals the full attractor structure.
// Equations: x' = sin(a*y) + c*cos(a*x), y' = sin(b*x) + d*cos(b*y)
//
// Audio drives:
//   RMS delta + bass  → dots per frame (density build rate)
//   Bass              → parameter 'a' — shape symmetry morphs
//   Mid               → parameter 'b' — flow direction shifts
//   High              → parameters 'c','d' — curve density
//   Beats             → dot burst (1800 larger dots) + white flash
//   sRMS              → dot alpha, fade rate, color rotation
//   sCentroid         → palette cycling speed
//
// Position-based color: atan2(y,x) maps to winter palette
// so different lobes show different hues simultaneously.

import * as Tone from 'tone';

// ─── Tuning ───────────────────────────────────────────────────────────────────
const PRELOAD_SRC = '/clifford-attractor/BreathBetweenCircuits.mp3';
const BASE_SCALE  = 300;    // was 180 — fills ~1200px of screen

// Clifford parameters — negative 'a' creates wide multi-lobed pattern
const A0 = -1.4, A_VAR = 0.5;   // bass morphs main symmetry
const B0 =  1.6, B_VAR = 0.5;   // mid changes flow direction
const C0 =  1.0, C_VAR = 0.3;   // high affects curve density
const D0 =  0.7, D_VAR = 0.4;   // high affects curve density

// Audio normalization
const BASS_NORM = 1 / 0.18;
const MID_NORM  = 1 / 0.15;
const HIGH_NORM = 1 / 0.03;

// Beat detection
const BEAT_THRESHOLD  = 0.012;
const FLUX_THRESHOLD  = 1.5;
const BEAT_COOLDOWN_F = 10;
const RMS_WIN         = 10;

// Dot density rendering
const DOTS_QUIET    = 80;     // dots/frame when quiet
const DOTS_LOUD     = 600;    // dots/frame at peak energy
const DOTS_BEAT     = 1800;   // dots on a beat frame (burst)
const DOT_ALPHA_MIN = 0.025;  // faint dots during quiet
const DOT_ALPHA_MAX = 0.10;   // brighter during loud
const DOT_SIZE_NORM = 1;      // 1px dot normally
const DOT_SIZE_BEAT = 2.5;    // larger on beats
const FADE_QUIET    = 0.008;  // faster fade during quiet (old shape dissolves)
const FADE_LOUD     = 0.002;  // very slow fade during loud (density persists)
const WARMUP_DOTS   = 60000;  // pre-computed dots for initial density
const COLOR_BUCKETS = 8;      // batch dots by angle for perf

// Winter palette — icy blues, deep blues, purples, silver
const WINTER_HUES = [
  { h: 200, s: 85, l: 65 },  // ice blue
  { h: 220, s: 90, l: 60 },  // deep blue
  { h: 270, s: 75, l: 70 },  // purple
  { h: 190, s: 60, l: 75 },  // pale cyan
];

// ─── Sketch ───────────────────────────────────────────────────────────────────
class CliffordSketch {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx    = this.canvas.getContext('2d');

    // Clifford iteration state
    this.cx = 0.1;
    this.cy = 0.1;

    // Smoothed Clifford params (lerp toward audio targets)
    this.curA = A0;
    this.curB = B0;
    this.curC = C0;
    this.curD = D0;

    // Smoothed audio
    this.sBass = 0; this.sMid = 0; this.sHigh = 0; this.sRMS = 0;
    this.sCentroid = 0;

    // Beat
    this.rmsWin       = new Array(RMS_WIN).fill(0);
    this.beatFlash    = 0;
    this.beatCooldown = 0;

    // Audio deltas
    this.rawRMS       = 0;
    this.avgRMS       = 0;
    this.spectralFlux = 0;
    this.prevSpectrum = null;

    // BPM tracking
    this.beatTimes    = [];
    this.estimatedBPM = 120;
    this.lastBeatTime = 0;

    // Color state
    this.paletteIndex     = 0;
    this.hueShift         = 0;
    this.colorAngleOffset = 0;

    // Audio
    this.player      = null;
    this.analyzer    = null;
    this.fftAnalyzer = null;
    this.isPlaying   = false;

    this._setupCanvas();
    this._setupAudio();
    this._setupControls();
    this._warmUp();
    this._animate();
  }

  // ── Canvas ─────────────────────────────────────────────────────────────────
  _setupCanvas() {
    const resize = () => {
      const c   = document.getElementById('canvas-container');
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width  = c.clientWidth  * dpr;
      this.canvas.height = c.clientHeight * dpr;
      this.canvas.style.width  = c.clientWidth  + 'px';
      this.canvas.style.height = c.clientHeight + 'px';
      this.ctx.scale(dpr, dpr);
      this._warmUp();
    };
    resize();
    window.addEventListener('resize', resize);
  }

  // ── Audio ──────────────────────────────────────────────────────────────────
  _setupAudio() {
    this.analyzer    = new Tone.Analyser('waveform', 1024);
    this.fftAnalyzer = new Tone.Analyser('fft', 512);
    this._preload();
  }

  _preload() {
    this._setStatus('Loading audio...', 'loading');
    this._createPlayer(PRELOAD_SRC);
  }

  _createPlayer(url) {
    if (this.player) {
      if (this.isPlaying) { this.player.stop(); this.isPlaying = false; }
      this.player.dispose();
      this.player = null;
    }

    this.player = new Tone.Player(url, () => {
      document.getElementById('playBtn').disabled = false;
      document.getElementById('stopBtn').disabled = false;
      this._setStatus('Ready — Press Play.', 'ready');
    }).toDestination();

    this.player.volume.value = 0;
    this.player.loop = true;
    this.player.connect(this.analyzer);
    this.player.connect(this.fftAnalyzer);
  }

  _createPlayerFromFile(url, name) {
    return new Promise((resolve) => {
      if (this.player) {
        if (this.isPlaying) { this.player.stop(); this.isPlaying = false; }
        this.player.dispose();
        this.player = null;
      }
      this.player = new Tone.Player(url, () => {
        document.getElementById('playBtn').disabled = false;
        document.getElementById('stopBtn').disabled = false;
        this._setStatus(`Ready — ${name}. Press Play.`, 'ready');
        resolve();
      }).toDestination();
      this.player.volume.value = 0;
      this.player.loop = true;
      this.player.connect(this.analyzer);
      this.player.connect(this.fftAnalyzer);
    });
  }

  // ── Controls ───────────────────────────────────────────────────────────────
  _setupControls() {
    document.getElementById('playBtn').addEventListener('click', () => this._togglePlay());
    document.getElementById('stopBtn').addEventListener('click', () => this._stop());
    document.getElementById('fullscreenBtn').addEventListener('click', () => this._toggleFullscreen());
    document.getElementById('audioFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      this._setStatus(`Loading ${f.name}...`, 'loading');
      await this._createPlayerFromFile(URL.createObjectURL(f), f.name);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'f' || e.key === 'F') this._toggleFullscreen();
    });
  }

  async _togglePlay() {
    if (!this.player) return;
    if (this.isPlaying) {
      this.player.stop(); this.isPlaying = false;
      document.getElementById('playBtn').textContent = 'Play';
    } else {
      await Tone.start(); this.player.start(); this.isPlaying = true;
      document.getElementById('playBtn').textContent = 'Pause';
    }
  }

  _stop() {
    if (!this.player) return;
    this.player.stop(); this.isPlaying = false;
    document.getElementById('playBtn').textContent = 'Play';
    // Reset all audio state
    this.sBass = this.sMid = this.sHigh = this.sRMS = 0;
    this.rawRMS = 0; this.avgRMS = 0;
    this.spectralFlux = 0; this.prevSpectrum = null;
    this.rmsWin = new Array(RMS_WIN).fill(0);
    this.beatFlash = 0; this.beatCooldown = 0;
    // Reset Clifford params to defaults
    this.curA = A0; this.curB = B0; this.curC = C0; this.curD = D0;
    // Redraw clean warm-up density
    this._warmUp();
    this._setStatus('Stopped. Press Play.', 'ready');
  }

  _toggleFullscreen() {
    const el = document.getElementById('container');
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  }

  _setStatus(msg, cls) {
    const el = document.getElementById('status');
    el.textContent = msg; el.className = cls || '';
  }

  // ── Audio analysis (unchanged) ─────────────────────────────────────────────
  _readAudio() {
    const spec = this.fftAnalyzer.getValue();
    const bins = spec.length;
    const bEnd = Math.floor(bins * 0.10);
    const mEnd = Math.floor(bins * 0.50);

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

    const wf = this.analyzer.getValue();
    let sq = 0; for (let v of wf) sq += v * v;
    const rawRMS = Math.sqrt(sq / wf.length);
    this.rawRMS = rawRMS;

    const alpha = 0.3;
    this.sBass += alpha * (Math.min(1, rawBass * BASS_NORM) - this.sBass);
    this.sMid  += alpha * (Math.min(1, rawMid  * MID_NORM)  - this.sMid);
    this.sHigh += alpha * (Math.min(1, rawHigh * HIGH_NORM) - this.sHigh);
    this.sRMS  += alpha * (rawRMS - this.sRMS);

    // Spectral centroid
    let wSum = 0, mMag = 0;
    for (let i = 0; i < bins; i++) {
      const lin = Math.pow(10, spec[i] / 20);
      wSum += i * lin; mMag += lin;
    }
    const rawCent = mMag > 0 ? wSum / mMag / bins : 0;
    this.sCentroid += alpha * (rawCent - this.sCentroid);

    // Spectral flux
    let fluxRaw = 0;
    if (this.prevSpectrum !== null) {
      for (let i = 0; i < bins; i++) {
        fluxRaw += Math.max(0, spec[i] - this.prevSpectrum[i]);
      }
      fluxRaw /= bins;
    }
    this.prevSpectrum = Array.from(spec);
    this.spectralFlux += 0.5 * (fluxRaw - this.spectralFlux);

    // Beat detection — dual RMS delta + spectral flux
    this.rmsWin.shift(); this.rmsWin.push(rawRMS);
    this.avgRMS = this.rmsWin.reduce((s, v) => s + v, 0) / RMS_WIN;

    const beatByRMS  = (rawRMS - this.avgRMS) > BEAT_THRESHOLD;
    const beatByFlux = this.spectralFlux > FLUX_THRESHOLD;

    if ((beatByRMS || beatByFlux) && this.beatCooldown <= 0) {
      this.beatFlash    = 1.0;
      this.beatCooldown = BEAT_COOLDOWN_F;

      const now = performance.now();
      if (this.lastBeatTime > 0) {
        const interval = now - this.lastBeatTime;
        this.beatTimes.push(interval);
        if (this.beatTimes.length > 8) this.beatTimes.shift();
        if (this.beatTimes.length >= 4) {
          const avgInterval = this.beatTimes.reduce((s, v) => s + v, 0) / this.beatTimes.length;
          this.estimatedBPM = 60000 / avgInterval;
          this.estimatedBPM = Math.max(60, Math.min(180, this.estimatedBPM));
        }
      }
      this.lastBeatTime = now;
    }
    this.beatFlash    *= 0.82;
    this.beatCooldown  = Math.max(0, this.beatCooldown - 1);

    // Meters
    document.getElementById('bassMeter').style.height = (this.sBass * 100) + '%';
    document.getElementById('midMeter').style.height  = (this.sMid  * 100) + '%';
    document.getElementById('highMeter').style.height = (this.sHigh * 100) + '%';

    // Status
    const rmsDelta = (rawRMS - this.avgRMS).toFixed(3);
    const beatSrc  = beatByFlux ? 'F' : (beatByRMS ? 'R' : '-');
    this._setStatus(
      `BPM:${Math.round(this.estimatedBPM)} RMS:${rawRMS.toFixed(3)} \u0394:${rmsDelta} Flux:${this.spectralFlux.toFixed(2)} [${beatSrc}]  B:${this.sBass.toFixed(2)} M:${this.sMid.toFixed(2)} H:${this.sHigh.toFixed(2)}`,
      'ready'
    );
  }

  // ── Clifford step ──────────────────────────────────────────────────────────
  _cliffordStep(a, b, c, d) {
    const x = this.cx, y = this.cy;
    this.cx = Math.sin(a * y) + c * Math.cos(a * x);
    this.cy = Math.sin(b * x) + d * Math.cos(b * y);
  }

  // ── Compute color for a given angle bucket ─────────────────────────────────
  _bucketColor(bucketIdx, dotAlpha, extraL) {
    const angle = (bucketIdx + 0.5) / COLOR_BUCKETS * 2 * Math.PI
               - Math.PI + this.colorAngleOffset;
    const hueT  = (((angle + Math.PI) / (2 * Math.PI)) % 1 + 1) % 1;
    const idxF  = hueT * WINTER_HUES.length;
    const idx   = Math.floor(idxF) % WINTER_HUES.length;
    const nxt   = (idx + 1) % WINTER_HUES.length;
    const t     = idxF - Math.floor(idxF);
    const c1    = WINTER_HUES[idx];
    const c2    = WINTER_HUES[nxt];
    const h = c1.h + (c2.h - c1.h) * t + this.hueShift;
    const s = c1.s + (c2.s - c1.s) * t;
    const l = Math.min(95, c1.l + (c2.l - c1.l) * t + extraL);
    return `hsla(${h}, ${s}%, ${l}%, ${dotAlpha})`;
  }

  // ── Warm-up: pre-plot 60k dots for initial density ─────────────────────────
  _warmUp() {
    const dpr = window.devicePixelRatio || 1;
    const W   = this.canvas.width  / dpr;
    const H   = this.canvas.height / dpr;
    const centerX = W / 2;
    const centerY = H / 2;

    // Black background
    this.ctx.fillStyle = 'rgb(4, 2, 10)';
    this.ctx.fillRect(0, 0, W, H);

    // Reset Clifford state
    this.cx = 0.1; this.cy = 0.1;

    // Batch by color bucket for performance
    const buckets = Array.from({ length: COLOR_BUCKETS }, () => []);

    for (let i = 0; i < WARMUP_DOTS; i++) {
      const px = this.cx, py = this.cy;
      this.cx = Math.sin(A0 * py) + C0 * Math.cos(A0 * px);
      this.cy = Math.sin(B0 * px) + D0 * Math.cos(B0 * py);

      const sx = centerX + this.cx * BASE_SCALE;
      const sy = centerY + this.cy * BASE_SCALE;

      const angle = Math.atan2(this.cy, this.cx);
      const hueT  = (((angle + Math.PI) / (2 * Math.PI)) % 1 + 1) % 1;
      const bucket = Math.floor(hueT * COLOR_BUCKETS) % COLOR_BUCKETS;
      buckets[bucket].push(sx, sy);
    }

    // Draw each bucket with one fillStyle
    for (let b = 0; b < COLOR_BUCKETS; b++) {
      const pts = buckets[b];
      if (pts.length === 0) continue;
      this.ctx.fillStyle = this._bucketColor(b, 0.03, 0);
      for (let j = 0; j < pts.length; j += 2) {
        this.ctx.fillRect(pts[j], pts[j + 1], 1, 1);
      }
    }
  }

  // ── Main draw — density dot emission ───────────────────────────────────────
  _draw() {
    const dpr     = window.devicePixelRatio || 1;
    const W       = this.canvas.width  / dpr;
    const H       = this.canvas.height / dpr;
    const centerX = W / 2;
    const centerY = H / 2;

    if (this.isPlaying) this._readAudio();

    // ── Target Clifford params from audio ────────────────────────────────
    const targetA = A0 + (this.sBass - 0.5) * 2 * A_VAR;
    const targetB = B0 + (this.sMid  - 0.5) * 2 * B_VAR;
    const targetC = C0 + (this.sHigh - 0.5) * 2 * C_VAR;
    const targetD = D0 + (this.sHigh - 0.5) * 2 * D_VAR;

    // Smooth parameter morphing (~30 frames to reach target)
    const pAlpha = 0.03;
    this.curA += pAlpha * (targetA - this.curA);
    this.curB += pAlpha * (targetB - this.curB);
    this.curC += pAlpha * (targetC - this.curC);
    this.curD += pAlpha * (targetD - this.curD);

    // ── Dots per frame ───────────────────────────────────────────────────
    let dotsPerFrame = 0;
    if (this.isPlaying) {
      const rmsLocalDelta = Math.max(0, this.rawRMS - this.avgRMS);
      const energy = rmsLocalDelta * 300 + this.sBass * 15 + this.sRMS * 30;
      dotsPerFrame = Math.floor(DOTS_QUIET + energy * (DOTS_LOUD - DOTS_QUIET));
      dotsPerFrame = Math.min(dotsPerFrame, DOTS_LOUD);
      if (this.beatFlash > 0.7) dotsPerFrame = DOTS_BEAT;
    }

    // ── Dot appearance ───────────────────────────────────────────────────
    const dotAlpha = DOT_ALPHA_MIN + this.sRMS * (DOT_ALPHA_MAX - DOT_ALPHA_MIN)
                   + this.beatFlash * 0.06;
    const dotSize  = (this.beatFlash > 0.5)
      ? DOT_SIZE_BEAT
      : DOT_SIZE_NORM + this.sRMS * 0.5;
    const extraL   = this.beatFlash * 15;  // lightness boost on beats

    // ── Background fade (inversely proportional to energy) ───────────────
    const fade = this.isPlaying
      ? FADE_LOUD + (1 - this.sRMS) * (FADE_QUIET - FADE_LOUD)
      : 0;
    if (fade > 0) {
      this.ctx.fillStyle = `rgba(4, 2, 10, ${fade})`;
      this.ctx.fillRect(0, 0, W, H);
    }

    // ── Palette cycling (only when playing) ──────────────────────────────
    if (this.isPlaying) {
      this.paletteIndex = (this.paletteIndex + 0.015 + this.sCentroid * 0.25)
                        % WINTER_HUES.length;
      this.hueShift = (this.hueShift + 0.05 + this.sRMS * 0.3) % 30;
      this.colorAngleOffset += 0.002 + this.sRMS * 0.008;
    }

    // ── Emit & plot dots (batched by color bucket) ───────────────────────
    if (dotsPerFrame > 0) {
      const a = this.curA, b = this.curB, c = this.curC, d = this.curD;
      const buckets = Array.from({ length: COLOR_BUCKETS }, () => []);

      for (let i = 0; i < dotsPerFrame; i++) {
        // Inline Clifford step
        const px = this.cx, py = this.cy;
        this.cx = Math.sin(a * py) + c * Math.cos(a * px);
        this.cy = Math.sin(b * px) + d * Math.cos(b * py);

        // NaN guard
        if (!isFinite(this.cx) || !isFinite(this.cy)) {
          this.cx = 0.1; this.cy = 0.1;
          continue;
        }

        // Project to screen
        const sx = centerX + this.cx * BASE_SCALE;
        const sy = centerY + this.cy * BASE_SCALE;

        // Bucket by angle
        const angle = Math.atan2(this.cy, this.cx);
        const hueT  = (((angle + Math.PI) / (2 * Math.PI)) % 1 + 1) % 1;
        const bucket = Math.floor(hueT * COLOR_BUCKETS) % COLOR_BUCKETS;
        buckets[bucket].push(sx, sy);
      }

      // Draw each bucket with one fillStyle
      for (let bk = 0; bk < COLOR_BUCKETS; bk++) {
        const pts = buckets[bk];
        if (pts.length === 0) continue;
        this.ctx.fillStyle = this._bucketColor(bk, dotAlpha, extraL);
        for (let j = 0; j < pts.length; j += 2) {
          this.ctx.fillRect(pts[j], pts[j + 1], dotSize, dotSize);
        }
      }
    }

    // ── Beat flash overlay ───────────────────────────────────────────────
    if (this.beatFlash > 0.15) {
      this.ctx.fillStyle = `rgba(200, 220, 255, ${this.beatFlash * 0.04})`;
      this.ctx.fillRect(0, 0, W, H);
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this._draw();
  }
}

new CliffordSketch();
