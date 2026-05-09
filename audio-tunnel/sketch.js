import * as Tone from 'tone';

const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const PRELOAD_SRC = '/audio-tunnel/GlassHorizon.mp3';
const BG = '#060810';
const BASS_NORM = 1 / 0.15;
const MID_NORM  = 1 / 0.12;
const HIGH_NORM = 1 / 0.02;

class Tunnel {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx    = this.canvas.getContext('2d');

    this.player    = null;
    this.isPlaying = false;

    /* analysers created ONCE in constructor — same as lorenz */
    this.analyzer    = new Tone.Analyser('waveform', 1024);
    this.fftAnalyzer = new Tone.Analyser('fft', 512);

    this.sBass = 0;  this.sMid = 0;  this.sHigh = 0;
    this.sRMS  = 0;  this.sCentroid = 0;

    this.t   = 0;
    this.hue = 200;

    this._resize();
    this._setupControls();
    this._preload();
    this._loop();
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width  = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.canvas.style.width  = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── controls — matches lorenz pattern ──────────────────── */
  _setupControls() {
    window.addEventListener('resize', () => this._resize());

    document.getElementById('playBtn').addEventListener('click', () => this._togglePlay());

    document.getElementById('audioFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      document.getElementById('track-name').textContent = f.name;
      this._setStatus(`Loading ${f.name}...`);
      await this._createPlayerFromFile(URL.createObjectURL(f), f.name);
    });

    document.getElementById('fsBtn').addEventListener('click', () => this._toggleFullscreen());

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); this._togglePlay(); }
      if (e.code === 'KeyF') this._toggleFullscreen();
    });
  }

  /* ── audio — matches lorenz _createPlayer / _togglePlay ─── */
  _preload() {
    this._setStatus('Loading GlassHorizon.mp3...');
    this._createPlayer(PRELOAD_SRC);
  }

  _createPlayer(url) {
    if (this.player) {
      if (this.isPlaying) { this.player.stop(); this.isPlaying = false; }
      this.player.dispose();
      this.player = null;
    }

    document.getElementById('playBtn').disabled = true;

    this.player = new Tone.Player(url, () => {
      document.getElementById('playBtn').disabled = false;
      this._setStatus('Ready \u2014 press Play or Space');
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
      document.getElementById('playBtn').disabled = true;
      this.player = new Tone.Player(url, () => {
        document.getElementById('playBtn').disabled = false;
        this._setStatus(`Ready \u2014 ${name}`);
        resolve();
      }).toDestination();
      this.player.volume.value = 0;
      this.player.loop = true;
      this.player.connect(this.analyzer);
      this.player.connect(this.fftAnalyzer);
    });
  }

  async _togglePlay() {
    if (!this.player || !this.player.loaded) return;
    if (this.isPlaying) {
      this.player.stop();
      this.isPlaying = false;
      this.sBass = 0; this.sMid = 0; this.sHigh = 0;
      this.sRMS = 0; this.sCentroid = 0;
      const btn = document.getElementById('playBtn');
      btn.textContent = '\u25B6 Play'; btn.classList.remove('active');
    } else {
      /* Safari requires AudioContext resume inside a user gesture */
      await Tone.start();
      if (Tone.context.state !== 'running') {
        await Tone.context.resume();
      }
      this.player.start();
      this.isPlaying = true;
      const btn = document.getElementById('playBtn');
      btn.textContent = '\u25A0 Stop'; btn.classList.add('active');
    }
  }

  _toggleFullscreen() {
    const el = document.documentElement;
    const isFS = document.fullscreenElement || document.webkitFullscreenElement;
    if (!isFS) {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el).catch(() => {});
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }
  }

  _setStatus(msg) { document.getElementById('status').textContent = msg; }

  /* ── audio analysis ─────────────────────────────────────── */
  _readAudio() {
    if (!this.isPlaying || !this.fftAnalyzer) return;

    const spec = this.fftAnalyzer.getValue();
    const bins = spec.length;
    const bEnd = Math.floor(bins * 0.10);
    const mEnd = Math.floor(bins * 0.50);

    let bS = 0, mS = 0, hS = 0;
    for (let i = 0; i < bins; i++) {
      const lin = Math.pow(10, spec[i] / 20);
      if      (i < bEnd) bS += lin;
      else if (i < mEnd) mS += lin;
      else               hS += lin;
    }

    this.sBass = lerp(this.sBass, clamp(bS / Math.max(1, bEnd) * BASS_NORM, 0, 1), 0.08);
    this.sMid  = lerp(this.sMid,  clamp(mS / Math.max(1, mEnd - bEnd) * MID_NORM, 0, 1), 0.08);
    this.sHigh = lerp(this.sHigh, clamp(hS / Math.max(1, bins - mEnd) * HIGH_NORM, 0, 1), 0.08);

    const wf = this.analyzer.getValue();
    let sq = 0;
    for (const v of wf) sq += v * v;
    this.sRMS = lerp(this.sRMS, clamp(Math.sqrt(sq / wf.length) * 5, 0, 1), 0.06);

    let wSum = 0, mMag = 0;
    for (let i = 0; i < bins; i++) { const l = Math.pow(10, spec[i] / 20); wSum += i * l; mMag += l; }
    this.sCentroid = lerp(this.sCentroid, mMag > 0 ? wSum / mMag / bins : 0, 0.06);
  }

  _updateStatus() {
    const bar = (v) => { const n = Math.round(v * 8); return '\u2588'.repeat(n) + '\u2591'.repeat(8 - n); };
    this._setStatus(
      `B ${bar(this.sBass)}  M ${bar(this.sMid)}  H ${bar(this.sHigh)}  ` +
      `hue ${Math.round(this.hue)}\u00b0`
    );
  }

  /* ── render ─────────────────────────────────────────────── */
  _draw() {
    const { ctx, w, h } = this;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    this._readAudio();
    if (this.isPlaying) this._updateStatus();

    if (this.isPlaying) {
      this.t += (Math.PI / 45) * (0.8 + this.sRMS * 0.25);
    } else {
      this.t += Math.PI / 90;
    }

    const hueTarget = 200 + this.sCentroid * 80 + Math.sin(this.t * 0.025) * 35;
    this.hue = lerp(this.hue, clamp(hueTarget, 185, 280), 0.015);
    const sat = 65 + this.sMid * 15;
    const lit = 60 + this.sRMS * 10;

    ctx.fillStyle = `hsla(${this.hue}, ${sat}%, ${lit}%, 0.35)`;

    const sc = Math.min(w, h) / 400;
    const cx = w / 2 + Math.sin(this.t * 0.07) * w * 0.06;
    const cy = h / 2 + Math.cos(this.t * 0.05) * h * 0.06;

    const breathe = 79 + this.sBass * 20 + this.sMid * 8;
    const dist    = 5 + this.sMid * 10 + this.sHigh * 5;
    const t       = this.t;

    for (let i = 2e4; i--;) {
      const m = (i & 1) * 3;
      const e = i / 652 - 13;
      const k = 9 * Math.cos(i / 61);
      const d = (k * k + e * e) / 89 + 1;

      const q = (breathe
        - (e * 0.5) * Math.sin(k)
        + (k / d) * (6 + dist * Math.sin(
            Math.sin(d * d + e / 9 - t + m)))) * sc;

      const c = d / 1.9 + Math.cos(t - d * 3 + m) / 11
                - t / 16 + m;

      ctx.fillRect(
        q * Math.sin(c) + cx,
        (q + 40 * sc) * Math.cos(c) + cy,
        1, 1
      );
    }
  }

  _loop() {
    this._draw();
    requestAnimationFrame(() => this._loop());
  }
}

new Tunnel();
