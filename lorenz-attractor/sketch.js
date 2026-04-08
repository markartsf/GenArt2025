import { FallColors, Camera } from '../genart-sketches/colorPalette.js';
import * as Tone from 'tone';

// ─── Tuning ───────────────────────────────────────────────────────────────────
const PRELOAD_SRC     = '/lorenz-attractor/GlassHorizon.mp3';
const Z_CENTER        = 23;    // Lorenz z-mean — centres the butterfly vertically
const BEAT_THRESHOLD  = 0.012;
const BEAT_COOLDOWN_F = 22;
const RMS_WIN         = 10;
const BASS_NORM       = 1 / 0.18;
const MID_NORM        = 1 / 0.15;
const HIGH_NORM       = 1 / 0.03;

// ─── Particle ─────────────────────────────────────────────────────────────────
class LorenzParticle {
  constructor(x, y, z) {
    this.x = x + (Math.random() - 0.5) * 5;
    this.y = y + (Math.random() - 0.5) * 5;
    this.z = z + (Math.random() - 0.5) * 5;

    this.offsetX = (Math.random() - 0.5) * 2;
    this.offsetY = (Math.random() - 0.5) * 2;
    this.offsetZ = (Math.random() - 0.5) * 2;

    this.vx = 0;
    this.vy = 0;
    this.vz = 0;

    this.colorIndex = Math.floor(Math.random() * FallColors.palette.length);
    this.life = Math.random();
  }

  update(dt, sigma, rho, beta, audioFeatures) {
    const dx = sigma * (this.y - this.x);
    const dy = this.x * (rho - this.z) - this.y;
    const dz = this.x * this.y - beta * this.z;

    let scatterForce = 0;
    if (audioFeatures.bass > 0.3) {
      scatterForce = audioFeatures.bass * 20;
    }
    // Beat explosion: brief hard scatter that settles as flash decays
    scatterForce += (audioFeatures.beatFlash || 0) * 40;

    this.vx = dx + this.offsetX + (Math.random() - 0.5) * scatterForce;
    this.vy = dy + this.offsetY + (Math.random() - 0.5) * scatterForce;
    this.vz = dz + this.offsetZ + (Math.random() - 0.5) * scatterForce;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    this.life += dt * 0.5;
    if (this.life > 1) {
      this.life = 0;
      this.colorIndex = Math.floor(Math.random() * FallColors.palette.length);
    }
  }
}

// ─── Sketch class (follows genart-sketches API) ───────────────────────────────
export class LorenzAttractor {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.particles = [];
    this.numParticles = 1500;

    this.baseSigma = 10;
    this.baseRho   = 28;
    this.baseBeta  = 8 / 3;

    this.dt       = 0.008;
    this.scale    = 12;
    this.rotation = 0;
    this.camera   = new Camera();

    this.initParticles();
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push(new LorenzParticle(0.1, 0, 0));
    }
  }

  reset() {
    this.initParticles();
    this.rotation = 0;
    this.camera.reset();
  }

  draw(audioFeatures) {
    const width  = this.canvas.width  / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Use bootstrap-smoothed values directly — no second smoothing pass
    const audio = audioFeatures;
    const beatFlash = audio.beatFlash || 0;

    // Update camera each frame before drawing
    this.camera.update(audio);

    // Background fade
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    this.ctx.fillRect(0, 0, width, height);

    // Lorenz parameter modulation
    const sigma = this.baseSigma * (1 + audio.bass * 0.1);
    const rho   = this.baseRho   * (1 + audio.mid  * 0.2);
    const beta  = this.baseBeta  * (1 + audio.high  * 0.1);

    // Rotation
    this.rotation += 0.001 + audio.mid * 0.004;

    // Dynamic scale
    const dynamicScale = this.scale + audio.rms * 25;

    // Pre-compute rotation trig once — used in both particle and connecting-lines loops
    const rotCos = Math.cos(this.rotation);
    const rotSin = Math.sin(this.rotation);

    // Centre + apply camera transforms
    this.ctx.save();
    this.ctx.translate(width / 2, height / 2);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    this.ctx.rotate(this.camera.rotation);
    this.ctx.translate(this.camera.x, this.camera.y);

    // Update and draw particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      p.update(this.dt, sigma, rho, beta, audio);

      const rotatedX = p.x * rotCos - p.y * rotSin;
      const rotatedY = p.x * rotSin + p.y * rotCos;

      // Z_CENTER offsets z-mean so butterfly is vertically centred
      const px = rotatedX * dynamicScale;
      const py = (rotatedY - (p.z - Z_CENTER)) * dynamicScale * 0.5;

      const baseAlpha = 0.4 + Math.sin(p.life * Math.PI) * 0.6;
      const alpha     = Math.min(1, baseAlpha * (0.5 + audio.rms * 2));

      this.ctx.fillStyle = FallColors.getAudioColor(p.colorIndex, audio, alpha);

      const size = 1.5 + audio.mid * 3 + audio.high * 4;

      if (audio.high > 0.1 || audio.bass > 0.2 || beatFlash > 0.1) {
        this.ctx.shadowBlur  = 5 + audio.bass * 15 + beatFlash * 30;
        this.ctx.shadowColor = FallColors.getGlowColor(p.colorIndex, Math.min(1, audio.bass + beatFlash));
      } else {
        this.ctx.shadowBlur = 0;
      }

      this.ctx.beginPath();
      this.ctx.arc(px, py, size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Connecting lines between nearby particles on bass hits
    if (audio.bass > 0.1) {
      this.ctx.shadowBlur = 0;
      this.ctx.lineWidth  = 0.5 + audio.high * 2;

      const checkLimit  = Math.min(this.particles.length, 300);
      const connectDist = 40 + audio.bass * 100;
      const distSqLimit = connectDist * connectDist;

      for (let i = 0; i < checkLimit; i += 2) {
        for (let j = i + 1; j < checkLimit; j += 3) {
          const p1 = this.particles[i];
          const p2 = this.particles[j];

          const px1 = (p1.x * rotCos - p1.y * rotSin) * dynamicScale;
          const py1 = (p1.x * rotSin + p1.y * rotCos - (p1.z - Z_CENTER)) * dynamicScale * 0.5;
          const px2 = (p2.x * rotCos - p2.y * rotSin) * dynamicScale;
          const py2 = (p2.x * rotSin + p2.y * rotCos - (p2.z - Z_CENTER)) * dynamicScale * 0.5;

          const dx    = px1 - px2;
          const dy    = py1 - py2;
          const distSq = dx * dx + dy * dy;

          if (distSq < distSqLimit) {
            const lineAlpha = (1 - distSq / distSqLimit) * audio.bass * 0.5;
            this.ctx.strokeStyle = FallColors.getAudioColor(p1.colorIndex, audio, lineAlpha);
            this.ctx.beginPath();
            this.ctx.moveTo(px1, py1);
            this.ctx.lineTo(px2, py2);
            this.ctx.stroke();
          }
        }
      }
    }

    this.ctx.restore();

  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
class LorenzApp {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx    = this.canvas.getContext('2d');

    this.player      = null;
    this.analyzer    = null;
    this.fftAnalyzer = null;
    this.isPlaying   = false;

    this.sBass = 0; this.sMid = 0; this.sHigh = 0; this.sRMS = 0;
    this.sCentroid = 0;

    this.rmsWin       = new Array(RMS_WIN).fill(0);
    this.beatCooldown = 0;
    this.beatFlash    = 0;

    this._setupCanvas();
    this._setupAudio();
    this._setupControls();

    this.sketch = new LorenzAttractor(this.canvas, this.ctx);
    this._animate();
  }

  _setupCanvas() {
    const resize = () => {
      const c   = document.getElementById('canvas-container');
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width        = c.clientWidth  * dpr;
      this.canvas.height       = c.clientHeight * dpr;
      this.canvas.style.width  = c.clientWidth  + 'px';
      this.canvas.style.height = c.clientHeight + 'px';
      this.ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);
  }

  _setupAudio() {
    this.analyzer    = new Tone.Analyser('waveform', 1024);
    this.fftAnalyzer = new Tone.Analyser('fft', 512);
    this._setStatus('Loading GlassHorizon.mp3…', 'loading');
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
      this._setStatus('Ready — press Play.', 'ready');
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

  _setupControls() {
    document.getElementById('playBtn').addEventListener('click', () => this._togglePlay());
    document.getElementById('stopBtn').addEventListener('click', () => this._stop());
    document.getElementById('fullscreenBtn').addEventListener('click', () => this._toggleFullscreen());
    document.getElementById('audioFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      this._setStatus(`Loading ${f.name}…`, 'loading');
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
    this.sBass = this.sMid = this.sHigh = this.sRMS = this.sCentroid = 0;
    this.rmsWin.fill(0);
    this.beatCooldown = 0;
    this.beatFlash    = 0;
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

  _readAudio() {
    const spec = this.fftAnalyzer.getValue();
    const bins = spec.length;
    const bEnd = Math.floor(bins * 0.10);
    const mEnd = Math.floor(bins * 0.50);

    let bSum = 0, mSum = 0, hSum = 0;
    let wSum = 0, mMag = 0;
    for (let i = 0; i < bins; i++) {
      const lin = Math.pow(10, spec[i] / 20);
      if      (i < bEnd) bSum += lin;
      else if (i < mEnd) mSum += lin;
      else               hSum += lin;
      wSum += i * lin; mMag += lin;
    }
    const rawBass = bSum / bEnd;
    const rawMid  = mSum / (mEnd - bEnd);
    const rawHigh = hSum / (bins - mEnd);
    const rawCent = mMag > 0 ? (wSum / mMag) / bins : 0;

    const wf = this.analyzer.getValue();
    let sq = 0; for (const v of wf) sq += v * v;
    const rawRMS = Math.sqrt(sq / wf.length);

    const α = 0.3;
    this.sBass     += α * (Math.min(1, rawBass * BASS_NORM) - this.sBass);
    this.sMid      += α * (Math.min(1, rawMid  * MID_NORM)  - this.sMid);
    this.sHigh     += α * (Math.min(1, rawHigh * HIGH_NORM)  - this.sHigh);
    this.sRMS      += α * (rawRMS - this.sRMS);
    this.sCentroid += α * (rawCent - this.sCentroid);

    // Beat detection via local RMS average
    this.rmsWin.shift(); this.rmsWin.push(rawRMS);
    const avgRMS = this.rmsWin.reduce((s, v) => s + v, 0) / RMS_WIN;
    if (rawRMS - avgRMS > BEAT_THRESHOLD && this.beatCooldown <= 0) {
      this.beatFlash    = 1.0;
      this.beatCooldown = BEAT_COOLDOWN_F;
    }
    this.beatCooldown = Math.max(0, this.beatCooldown - 1);

    // Update meters
    document.getElementById('bassMeter').style.height = (this.sBass * 100) + '%';
    document.getElementById('midMeter').style.height  = (this.sMid  * 100) + '%';
    document.getElementById('highMeter').style.height = (this.sHigh * 100) + '%';

    if (this.isPlaying) {
      this._setStatus(
        `Playing — RMS: ${rawRMS.toFixed(4)}  B:${this.sBass.toFixed(2)} M:${this.sMid.toFixed(2)} H:${this.sHigh.toFixed(2)}`,
        'ready'
      );
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());

    if (this.isPlaying) this._readAudio();

    // Decay beat flash every frame regardless of playback state
    this.beatFlash *= 0.82;

    this.sketch.draw({
      bass:             this.sBass,
      mid:              this.sMid,
      high:             this.sHigh,
      rms:              this.sRMS,
      spectralCentroid: this.sCentroid,
      beatFlash:        this.beatFlash,
    });
  }
}

new LorenzApp();
