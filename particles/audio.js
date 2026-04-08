import * as Tone from 'tone';

// ─── Adaptive Audio Engine ──────────────────────────────────────────────
// Extracted from murmuration/sketch.js — self-calibrating to any audio track.
// Provides { bass, mid, high, rms, beat, centroid } all normalized [0,1].

const ATTACK     = 0.40;
const RELEASE    = 0.06;
const PEAK_DECAY = 0.9997;
const BEAT_CD    = 10;
const RMS_WIN    = 30;

export class AudioEngine {
  constructor() {
    this.wfAn  = new Tone.Analyser('waveform', 1024);
    this.fftAn = new Tone.Analyser('fft', 512);
    this.player   = null;
    this.isPlaying = false;

    // Smoothed outputs
    this.sBass = 0; this.sMid = 0; this.sHigh = 0;
    this.sRMS = 0; this.sCentroid = 0; this.beatFlash = 0;

    // Adaptive peaks
    this.pkB = 0.0001; this.pkM = 0.0001;
    this.pkH = 0.0001; this.pkR = 0.0001;

    // Beat detection state
    this.cdFrames  = 0;
    this.rmsWin    = new Float32Array(RMS_WIN);
    this.rmsWinIdx = 0;
    this.prevSpec  = new Float32Array(512);
    this.sFlux     = 0;

    // The features object — allocated once, mutated in place (zero GC)
    this._f = { bass: 0, mid: 0, high: 0, rms: 0, beat: 0, centroid: 0 };
  }

  get features() {
    this._f.bass     = this.sBass;
    this._f.mid      = this.sMid;
    this._f.high     = this.sHigh;
    this._f.rms      = this.sRMS;
    this._f.beat     = this.beatFlash;
    this._f.centroid  = this.sCentroid;
    return this._f;
  }

  async loadUrl(url) {
    if (this.player) { this.player.stop(); this.player.dispose(); }
    this.player = new Tone.Player(url);
    this.player.connect(this.wfAn);
    this.player.connect(this.fftAn);
    this.player.toDestination();
    this.player.loop = true;
    await Tone.loaded();
  }

  async loadFile(file) {
    const url = URL.createObjectURL(file);
    await this.loadUrl(url);
  }

  async toggle() {
    await Tone.start();
    if (!this.isPlaying) {
      if (!this.player) await this.loadUrl('/audio-tunnel/GlassHorizon.mp3');
      this.player.start();
      this.isPlaying = true;
    } else {
      this.player.stop();
      this.isPlaying = false;
      this.reset();
    }
    return this.isPlaying;
  }

  reset() {
    this.sBass = this.sMid = this.sHigh = this.sRMS = this.sCentroid = 0;
    this.beatFlash = this.sFlux = 0;
    this.pkB = this.pkM = this.pkH = this.pkR = 0.0001;
    this.rmsWinIdx = 0;
    this.rmsWin.fill(0);
    this.prevSpec.fill(0);
  }

  update() {
    if (!this.isPlaying || !this.player) return;

    const wf  = this.wfAn.getValue();
    const fft = this.fftAn.getValue();

    // RMS from waveform
    let sq = 0;
    for (let i = 0; i < wf.length; i++) sq += wf[i] * wf[i];
    const rawRMS = Math.sqrt(sq / wf.length);

    // FFT bands + spectral flux (single pass)
    const bins = fft.length;
    const bEnd = (bins * 0.10) | 0;
    const mEnd = (bins * 0.50) | 0;
    let bSum = 0, mSum = 0, hSum = 0;
    let bN = 0, mN = 0, hN = 0;
    let wSum = 0, tMag = 0, fluxPos = 0;

    for (let i = 0; i < bins; i++) {
      const mag = Math.max(0, Math.pow(10, fft[i] / 20));
      if (i < bEnd)      { bSum += mag; bN++; }
      else if (i < mEnd) { mSum += mag; mN++; }
      else               { hSum += mag; hN++; }
      wSum += mag * i;
      tMag += mag;
      const diff = mag - this.prevSpec[i];
      if (diff > 0) fluxPos += diff;
      this.prevSpec[i] = mag;
    }

    const rawBass = bN > 0 ? bSum / bN : 0;
    const rawMid  = mN > 0 ? mSum / mN : 0;
    const rawHigh = hN > 0 ? hSum / hN : 0;
    const rawFlux = fluxPos / bins;

    // Adaptive peak tracking
    this.pkB = Math.max(rawBass, this.pkB * PEAK_DECAY);
    this.pkM = Math.max(rawMid,  this.pkM * PEAK_DECAY);
    this.pkH = Math.max(rawHigh, this.pkH * PEAK_DECAY);
    this.pkR = Math.max(rawRMS,  this.pkR * PEAK_DECAY);

    const nB = this.pkB > 0.0001 ? rawBass / this.pkB : 0;
    const nM = this.pkM > 0.0001 ? rawMid  / this.pkM : 0;
    const nH = this.pkH > 0.0001 ? rawHigh / this.pkH : 0;
    const nR = this.pkR > 0.0001 ? rawRMS  / this.pkR : 0;

    // Dual-rate smoothing
    this.sBass += (nB > this.sBass ? ATTACK : RELEASE) * (nB - this.sBass);
    this.sMid  += (nM > this.sMid  ? ATTACK : RELEASE) * (nM - this.sMid);
    this.sHigh += (nH > this.sHigh ? ATTACK : RELEASE) * (nH - this.sHigh);
    this.sRMS  += (nR > this.sRMS  ? ATTACK : RELEASE) * (nR - this.sRMS);
    this.sCentroid += 0.10 * ((tMag > 0 ? wSum / tMag / bins : 0) - this.sCentroid);

    // Spectral flux smoothing
    this.sFlux += (rawFlux > this.sFlux ? 0.3 : 0.05) * (rawFlux - this.sFlux);

    // Local-average beat detection
    this.rmsWin[this.rmsWinIdx % RMS_WIN] = rawRMS;
    this.rmsWinIdx++;
    let rmsAvg = 0;
    for (let k = 0; k < RMS_WIN; k++) rmsAvg += this.rmsWin[k];
    rmsAvg /= RMS_WIN;

    const rmsSpike  = rawRMS  > rmsAvg    * 1.12;
    const fluxSpike = rawFlux > this.sFlux * 1.5;

    this.cdFrames = Math.max(0, this.cdFrames - 1);
    if ((rmsSpike || fluxSpike) && this.cdFrames <= 0) {
      this.beatFlash = 1;
      this.cdFrames  = BEAT_CD;
    }
    this.beatFlash *= 0.86;
  }
}
