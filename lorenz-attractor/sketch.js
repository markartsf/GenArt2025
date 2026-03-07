// Lorenz Attractor — Audio Reactive
// Single trail, Catmull-Rom spline rendering, calibrated for Glass Horizon.
//
// Audio drives:
//   RMS        → trace speed (steps/frame) — most visually obvious effect
//   Bass       → gentle scale breathing (±25%), camera zoom pulse on beats
//   Mid        → rotation speed
//   Centroid   → hue cycling speed
//   Beat       → tip glow burst + brief scale pop
//
// Lorenz σ/ρ/β stay within ±15% of classical values so the
// butterfly shape stays recognisable and on-screen at all times.
// Larger dt (0.018) spreads points further apart for visible motion.

import * as Tone from 'tone';

// ─── Tuning ───────────────────────────────────────────────────────────────────
const PRELOAD_SRC  = '/lorenz-attractor/GlassHorizon.mp3';
const DT           = 0.012;     // integration time step
const MAX_PTS      = 3500;      // stored control points — enough to show both butterfly wings
const SKIP         = 1;         // store every sim step (no skipping)
const Z_CENTER     = 23;        // Lorenz z-mean — centres the butterfly vertically
const BASE_SCALE   = 22;        // idle scale (produces butterfly ~±440px at σ=10,ρ=28)

// Classical Lorenz — we deviate by up to ±30% for more dramatic audio response
const SIG0 = 10,  SIG_VAR  = 0.30;   // sigma varies by up to SIG_VAR * audio
const RHO0 = 28,  RHO_VAR  = 0.30;
const BET0 = 8/3, BET_VAR  = 0.25;

// Glass Horizon measured levels (ffprobe):
//   bass ≈ 0.12,  mid ≈ 0.10,  high ≈ 0.016 (linear)
// We normalise to 0-1 using modest scale factors so mods stay gentle
const BASS_NORM = 1 / 0.18;
const MID_NORM  = 1 / 0.15;
const HIGH_NORM = 1 / 0.03;

// Beat: compare current RMS to local average to handle compressed music
const BEAT_THRESHOLD  = 0.012;
const BEAT_COOLDOWN_F = 22;
const RMS_WIN         = 10;

// Winter palette — icy blues, deep blues, purples, silver
const WINTER_HUES = [
  { h: 200, s: 85, l: 65 },  // ice blue
  { h: 220, s: 90, l: 60 },  // deep blue
  { h: 270, s: 75, l: 70 },  // purple
  { h: 190, s: 60, l: 75 },  // pale cyan
];

// ─── Catmull-Rom spline ───────────────────────────────────────────────────────
// Draws a smooth bezier spline through screen-space points.
// One stroke() call per colour section — very few canvas ops total.
function splinePath(ctx, pts, a, b) {
  const n = pts.length;
  if (b - a < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[a].sx, pts[a].sy);
  for (let i = a + 1; i < b; i++) {
    const p0 = pts[Math.max(a, i - 1)];
    const p1 = pts[i];
    const p2 = pts[Math.min(b - 1, i + 1)];
    const p3 = pts[Math.min(b - 1, i + 2)];
    const cp1x = p1.sx + (p2.sx - p0.sx) / 6;
    const cp1y = p1.sy + (p2.sy - p0.sy) / 6;
    const cp2x = p2.sx - (p3.sx - p1.sx) / 6;
    const cp2y = p2.sy - (p3.sy - p1.sy) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.sx, p2.sy);
  }
}

// ─── Sketch ───────────────────────────────────────────────────────────────────
class LorenzSketch {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx    = this.canvas.getContext('2d');

    // Lorenz state
    this.lx = 0.1; this.ly = 0; this.lz = 0;
    this.pts      = [];   // { sx, sy, hue } — projected screen coords + hue at store time
    this.skipCount = 0;

    // Rotation
    this.rotation = 0;

    // Smoothed audio
    this.sBass = 0; this.sMid = 0; this.sHigh = 0; this.sRMS = 0;
    this.sCentroid = 0;

    // Beat
    this.rmsWin       = new Array(RMS_WIN).fill(0);
    this.beatFlash    = 0;
    this.beatCooldown = 0;

    // BPM tracking — measure time between beats to sync rotation to tempo
    this.beatTimes    = [];      // timestamps of recent beats
    this.estimatedBPM = 120;     // default BPM, updated from beat intervals
    this.lastBeatTime = 0;

    // Camera
    this.camZoom       = 1;
    this.camTargetZoom = 1;

    // Winter palette index — cycles through WINTER_HUES array
    this.paletteIndex = 0;
    this.hueShift = 0;  // small offset within current palette color

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
      // Re-project all stored points after resize
      this._reproject();
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
    this._setStatus('Loading GlassHorizon.mp3...', 'loading');
    this._createPlayer(PRELOAD_SRC);
  }

  _createPlayer(url) {
    if (this.player) {
      if (this.isPlaying) { this.player.stop(); this.isPlaying = false; }
      this.player.dispose();
      this.player = null;
    }

    // Use Tone.Player's built-in onload callback — most reliable pattern
    this.player = new Tone.Player(url, () => {
      // Buffer is ready
      document.getElementById('playBtn').disabled = false;
      document.getElementById('stopBtn').disabled = false;
      this._setStatus('Ready — GlassHorizon.mp3. Press Play.', 'ready');
    }).toDestination();

    this.player.volume.value = 0;
    this.player.loop = true;
    this.player.connect(this.analyzer);
    this.player.connect(this.fftAnalyzer);
  }

  // Allow loading a user-picked file (returns a promise so we can await it)
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
    this.sBass = this.sMid = this.sHigh = this.sRMS = 0;
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

  // ── Audio analysis ─────────────────────────────────────────────────────────
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

    // Normalise — gentle 0-1 range that doesn't over-drive parameters
    const α = 0.3;
    this.sBass += α * (Math.min(1, rawBass * BASS_NORM) - this.sBass);
    this.sMid  += α * (Math.min(1, rawMid  * MID_NORM)  - this.sMid);
    this.sHigh += α * (Math.min(1, rawHigh * HIGH_NORM)  - this.sHigh);
    this.sRMS  += α * (rawRMS - this.sRMS);

    // Spectral centroid
    let wSum = 0, mMag = 0;
    for (let i = 0; i < bins; i++) {
      const lin = Math.pow(10, spec[i] / 20);
      wSum += i * lin; mMag += lin;
    }
    const rawCent = mMag > 0 ? wSum / mMag / bins : 0;
    this.sCentroid += α * (rawCent - this.sCentroid);

    // Beat — compare to local window average
    this.rmsWin.shift(); this.rmsWin.push(rawRMS);
    const avgRMS = this.rmsWin.reduce((s, v) => s + v, 0) / RMS_WIN;
    if (rawRMS - avgRMS > BEAT_THRESHOLD && this.beatCooldown <= 0) {
      this.beatFlash    = 1.0;
      this.beatCooldown = BEAT_COOLDOWN_F;

      // Track beat timing for BPM estimation
      const now = performance.now();
      if (this.lastBeatTime > 0) {
        const interval = now - this.lastBeatTime;
        this.beatTimes.push(interval);
        if (this.beatTimes.length > 8) this.beatTimes.shift();  // keep last 8 beats

        // Calculate BPM from average interval
        if (this.beatTimes.length >= 4) {
          const avgInterval = this.beatTimes.reduce((s, v) => s + v, 0) / this.beatTimes.length;
          this.estimatedBPM = 60000 / avgInterval;  // ms to BPM
          // Clamp to reasonable range
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

    // RMS readout — confirms audio analysis is running
    if (this.isPlaying) {
      this._setStatus(
        `Playing — BPM: ${Math.round(this.estimatedBPM)}  RMS: ${rawRMS.toFixed(4)}  B:${this.sBass.toFixed(2)} M:${this.sMid.toFixed(2)} H:${this.sHigh.toFixed(2)}`,
        'ready'
      );
    }
  }

  // ── Lorenz integration step ────────────────────────────────────────────────
  _lorenzStep(sigma, rho, beta) {
    const dx = sigma * (this.ly - this.lx);
    const dy = this.lx * (rho - this.lz) - this.ly;
    const dz = this.lx * this.ly - beta * this.lz;
    this.lx += dx * DT;
    this.ly += dy * DT;
    this.lz += dz * DT;
  }

  // ── Project a Lorenz point to screen coords ────────────────────────────────
  _project(x, y, z, cos, sin, scale, width, height) {
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    return {
      sx: rx * scale,
      sy: (ry - (z - Z_CENTER)) * scale * 0.5,
    };
  }

  // ── Get current winter color with interpolation between palette entries ───
  _getWinterColor() {
    const idx = Math.floor(this.paletteIndex);
    const nextIdx = (idx + 1) % WINTER_HUES.length;
    const t = this.paletteIndex - idx;  // interpolation factor

    const c1 = WINTER_HUES[idx];
    const c2 = WINTER_HUES[nextIdx];

    // Interpolate between colors
    const h = c1.h + (c2.h - c1.h) * t + this.hueShift;
    const s = c1.s + (c2.s - c1.s) * t;
    const l = c1.l + (c2.l - c1.l) * t;

    return { h, s, l };
  }

  // ── Re-project all stored points (called on resize) ────────────────────────
  _reproject() {
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const scale = BASE_SCALE * this.camZoom;
    for (const pt of this.pts) {
      const r = this._project(pt.x, pt.y, pt.z, cos, sin, scale, 0, 0);
      pt.sx = r.sx; pt.sy = r.sy;
    }
  }

  // ── Warm-up: pre-populate trail so butterfly is fully formed ───────────────
  _warmUp() {
    // Run enough steps to fill MAX_PTS with SKIP factor
    const warmUpSteps = MAX_PTS * SKIP * 2;  // double to ensure full butterfly coverage
    for (let i = 0; i < warmUpSteps; i++) {
      this._lorenzStep(SIG0, RHO0, BET0);
      this.skipCount++;
      if (this.skipCount >= SKIP) {
        this.skipCount = 0;
        const wc = this._getWinterColor();
        this.pts.push({ x: this.lx, y: this.ly, z: this.lz, sx: 0, sy: 0, wc });
        if (this.pts.length > MAX_PTS) this.pts.shift();
      }
    }
    this._reproject();
  }

  // ── Main draw ──────────────────────────────────────────────────────────────
  _draw() {
    const dpr    = window.devicePixelRatio || 1;
    const W      = this.canvas.width  / dpr;
    const H      = this.canvas.height / dpr;

    if (this.isPlaying) this._readAudio();

    // ── Lorenz parameters: classical ± small audio nudge ──────────────────
    const sigma = SIG0 * (1 + this.sMid  * SIG_VAR);
    const rho   = RHO0 * (1 + this.sBass * RHO_VAR);
    const beta  = BET0 * (1 + this.sHigh * BET_VAR);

    // ── Trace speed: most visible audio effect ─────────────────────────────
    //    Quiet → 3 steps/frame  |  Loud → 25 steps/frame (much more dramatic)
    const stepsPerFrame = Math.max(3, Math.floor(3 + this.sRMS * 120));

    // ── Winter palette cycling: shift through palette colors based on centroid ──
    this.paletteIndex = (this.paletteIndex + 0.02 + this.sCentroid * 0.3) % WINTER_HUES.length;
    this.hueShift = (this.hueShift + 0.1 + this.sRMS * 0.5) % 30;  // small variance within color

    // ── Rotation: synced to BPM, beat accelerates ──────────────────────────
    // Base rotation speed scales with BPM (120 BPM = 1x, 60 BPM = 0.5x, 180 BPM = 1.5x)
    const bpmScale = this.estimatedBPM / 120;
    this.rotation += 0.003 * bpmScale + this.beatFlash * 0.045;

    // ── Scale: dramatic bass breathing + beat pop ──────────────────────────
    this.camTargetZoom  = 1 + this.sBass * 0.50 + this.beatFlash * 0.25;
    this.camZoom       += (this.camTargetZoom - this.camZoom) * 0.15;
    const dynScale      = BASE_SCALE * this.camZoom;

    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);

    // ── Integrate & store ──────────────────────────────────────────────────
    for (let s = 0; s < stepsPerFrame; s++) {
      this._lorenzStep(sigma, rho, beta);
      this.skipCount++;
      if (this.skipCount >= SKIP) {
        this.skipCount = 0;
        const r = this._project(this.lx, this.ly, this.lz, cos, sin, dynScale, W, H);
        const wc = this._getWinterColor();
        this.pts.push({ x: this.lx, y: this.ly, z: this.lz, sx: r.sx, sy: r.sy, wc });
        if (this.pts.length > MAX_PTS) this.pts.shift();
      }
    }

    // ── Re-project all existing points at new rotation & scale ────────────
    // (Only needed because rotation changes each frame)
    for (const pt of this.pts) {
      const r = this._project(pt.x, pt.y, pt.z, cos, sin, dynScale, W, H);
      pt.sx = r.sx; pt.sy = r.sy;
    }

    // ── Background fade — slow fade to keep full butterfly visible
    //    Slower fade = longer persistent trail showing both wings
    const fade = 0.015 + this.sRMS * 0.03 + this.beatFlash * 0.02;
    this.ctx.fillStyle = `rgba(4, 2, 10, ${fade})`;
    this.ctx.fillRect(0, 0, W, H);

    if (this.pts.length < 8) return;

    // ── Draw trail in 3 layers ─────────────────────────────────────────────
    const n   = this.pts.length;
    const cut = Math.floor(n * 0.75);   // split: ghost / active
    const tip = Math.max(cut, n - 60);  // last 60 pts = glowing tip

    this.ctx.save();
    this.ctx.translate(W / 2, H / 2);
    this.ctx.lineCap  = 'round';
    this.ctx.lineJoin = 'round';

    // Layer 1 — ghost trail (oldest 75%): dim, no shadow, 4 colour sections
    {
      this.ctx.shadowBlur = 0;
      const sections = 4;
      for (let s = 0; s < sections; s++) {
        const ta = Math.floor((s / sections) * cut);
        const tb = Math.floor(((s + 1) / sections) * cut);
        if (tb - ta < 2) continue;
        const t  = (s + 0.5) / sections;
        const wc = this.pts[ta].wc;
        const alpha = t * (0.18 + this.sRMS * 0.12);
        const lw    = 0.5 + t * 1.2;
        this.ctx.strokeStyle = `hsla(${wc.h}, ${wc.s}%, ${wc.l - 10}%, ${alpha})`;
        this.ctx.lineWidth   = lw;
        splinePath(this.ctx, this.pts, ta, tb);
        this.ctx.stroke();
      }
    }

    // Layer 2 — active tail (newest 25%): bright, one shadow setting
    {
      const wcShadow = this.pts[cut].wc;
      this.ctx.shadowBlur  = 12 + this.sBass * 24 + this.beatFlash * 30;
      this.ctx.shadowColor = `hsla(${wcShadow.h}, ${wcShadow.s}%, ${Math.min(85, wcShadow.l + 15)}%, 0.8)`;
      const sections = 4;
      for (let s = 0; s < sections; s++) {
        const ta = cut + Math.floor((s / sections) * (tip - cut));
        const tb = cut + Math.floor(((s + 1) / sections) * (tip - cut));
        if (tb - ta < 2) continue;
        const t  = (s + 0.5) / sections;
        const wc = this.pts[ta].wc;
        const sat   = Math.min(100, wc.s + this.sRMS * 15);
        const lit   = Math.min(90, wc.l + t * 15 + this.beatFlash * 20);
        const alpha = 0.45 + t * 0.45 + this.beatFlash * 0.20;
        const lw    = 1.5 + t * 4.0 + this.sRMS * 6 + this.beatFlash * 5;
        this.ctx.strokeStyle = `hsla(${wc.h}, ${sat}%, ${lit}%, ${alpha})`;
        this.ctx.lineWidth   = lw;
        splinePath(this.ctx, this.pts, ta, tb);
        this.ctx.stroke();
      }
    }

    // Layer 3 — glowing tip (last 60 pts): bright + stronger glow
    if (tip < n - 2) {
      const wcTip = this.pts[n - 1].wc;
      this.ctx.shadowBlur  = 20 + this.sBass * 30 + this.beatFlash * 45;
      this.ctx.shadowColor = `hsla(${wcTip.h}, 100%, ${Math.min(90, wcTip.l + 20)}%, 0.9)`;
      this.ctx.strokeStyle = `hsla(${wcTip.h}, ${Math.min(100, wcTip.s + 10)}%, ${Math.min(90, wcTip.l + 20)}%, 0.98)`;
      this.ctx.lineWidth   = 3.5 + this.sRMS * 7 + this.beatFlash * 8;
      splinePath(this.ctx, this.pts, tip, n);
      this.ctx.stroke();
    }

    // Layer 4 — tip dot: single bright circle at current position
    {
      const last = this.pts[n - 1];
      const wcTip = last.wc;
      const radius = 4 + this.sRMS * 12 + this.beatFlash * 20;
      this.ctx.shadowBlur  = 30 + this.beatFlash * 60;
      this.ctx.shadowColor = `hsla(${wcTip.h}, 100%, ${Math.min(95, wcTip.l + 25)}%, 1)`;
      this.ctx.fillStyle   = `hsla(${wcTip.h}, 100%, ${Math.min(95, wcTip.l + 25)}%, 1)`;
      this.ctx.beginPath();
      this.ctx.arc(last.sx, last.sy, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
    this.ctx.shadowBlur = 0;

    // Beat flash screen overlay — winter white flash
    if (this.beatFlash > 0.15) {
      this.ctx.fillStyle = `rgba(200, 220, 255, ${this.beatFlash * 0.06})`;
      this.ctx.fillRect(0, 0, W, H);
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this._draw();
  }
}

new LorenzSketch();
