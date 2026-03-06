// Audio Engine — Web Audio API
// Ported from lorenz-attractor + clifford-attractor Tone.js patterns
// Uses raw Web Audio API to avoid module/global scope conflicts with p5.brush

const BASS_NORM = 1 / 0.18;
const MID_NORM  = 1 / 0.15;
const HIGH_NORM = 1 / 0.03;

const BEAT_THRESHOLD  = 0.012;
const FLUX_THRESHOLD  = 1.5;
const BEAT_COOLDOWN_F = 12;
const RMS_WIN         = 10;
const ALPHA           = 0.3;

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.audioEl = null;
    this.isPlaying = false;
    this.isReady = false;

    // Smoothed features (0-1)
    this.sBass = 0;
    this.sMid = 0;
    this.sHigh = 0;
    this.sRMS = 0;
    this.sCentroid = 0;

    // Beat detection
    this.beatFlash = 0;
    this.beatCooldown = 0;
    this.rmsWin = new Array(RMS_WIN).fill(0);
    this.rawRMS = 0;
    this.avgRMS = 0;

    // Spectral flux
    this.spectralFlux = 0;
    this.prevSpectrum = null;

    // BPM estimation
    this.estimatedBPM = 120;
    this.beatTimes = [];
    this.lastBeatTime = 0;

    // Buffers (allocated on init)
    this.freqData = null;
    this.timeData = null;
  }

  init(audioUrl) {
    // Create audio element
    this.audioEl = document.createElement('audio');
    this.audioEl.crossOrigin = 'anonymous';
    this.audioEl.loop = true;
    this.audioEl.preload = 'auto';
    this.audioEl.src = audioUrl;

    this.audioEl.addEventListener('canplaythrough', () => {
      this.isReady = true;
      document.getElementById('playBtn').disabled = false;
      document.getElementById('status').textContent = 'Ready — press Play';
      document.getElementById('status').className = 'ready';
    }, { once: true });

    this.audioEl.addEventListener('error', () => {
      document.getElementById('status').textContent = 'Audio load failed';
      document.getElementById('status').className = 'error';
    });
  }

  _ensureContext() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024; // 512 frequency bins
    this.analyser.smoothingTimeConstant = 0.8;

    this.source = this.ctx.createMediaElementSource(this.audioEl);
    this.source.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    const bins = this.analyser.frequencyBinCount; // 512
    this.freqData = new Float32Array(bins);
    this.timeData = new Float32Array(this.analyser.fftSize);
  }

  loadFile(file) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.stop();

    // Disconnect old source if switching files after context exists
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    this.audioEl.src = URL.createObjectURL(file);
    this.isReady = false;

    document.getElementById('status').textContent = 'Loading ' + file.name + '...';
    document.getElementById('status').className = 'loading';
    document.getElementById('playBtn').disabled = true;

    this.audioEl.addEventListener('canplaythrough', () => {
      // Reconnect source with new audio element state
      if (this.ctx) {
        this.source = this.ctx.createMediaElementSource(this.audioEl);
        this.source.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      }
      this.isReady = true;
      document.getElementById('playBtn').disabled = false;
      document.getElementById('status').textContent = 'Ready — ' + file.name;
      document.getElementById('status').className = 'ready';
    }, { once: true });
  }

  async play() {
    this._ensureContext();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.audioEl.play();
    this.isPlaying = true;
    document.getElementById('playBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
  }

  stop() {
    this.audioEl.pause();
    this.audioEl.currentTime = 0;
    this.isPlaying = false;

    // Reset smoothed values
    this.sBass = this.sMid = this.sHigh = this.sRMS = this.sCentroid = 0;
    this.rawRMS = 0;
    this.avgRMS = 0;
    this.spectralFlux = 0;
    this.prevSpectrum = null;
    this.rmsWin = new Array(RMS_WIN).fill(0);
    this.beatFlash = 0;
    this.beatCooldown = 0;
    this.beatTimes = [];
    this.lastBeatTime = 0;

    document.getElementById('playBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('status').textContent = 'Stopped';
    document.getElementById('status').className = '';

    // Reset meters
    document.getElementById('bassMeter').style.height = '0%';
    document.getElementById('midMeter').style.height = '0%';
    document.getElementById('highMeter').style.height = '0%';
  }

  analyze() {
    if (!this.analyser || !this.isPlaying) {
      return {
        bass: this.sBass, mid: this.sMid, high: this.sHigh,
        rms: this.sRMS, centroid: this.sCentroid,
        beatFlash: this.beatFlash, bpm: this.estimatedBPM,
        spectralFlux: this.spectralFlux
      };
    }

    // Get frequency data (dB values, typically -100 to 0)
    this.analyser.getFloatFrequencyData(this.freqData);
    // Get time domain data (-1 to 1)
    this.analyser.getFloatTimeDomainData(this.timeData);

    const bins = this.freqData.length;
    const bEnd = Math.floor(bins * 0.10);
    const mEnd = Math.floor(bins * 0.50);

    // Band splitting — convert dB to linear, average per band
    let bSum = 0, mSum = 0, hSum = 0;
    for (let i = 0; i < bins; i++) {
      const lin = Math.pow(10, this.freqData[i] / 20);
      if      (i < bEnd) bSum += lin;
      else if (i < mEnd) mSum += lin;
      else               hSum += lin;
    }
    const rawBass = bSum / bEnd;
    const rawMid  = mSum / (mEnd - bEnd);
    const rawHigh = hSum / (bins - mEnd);

    // RMS from time domain
    let sq = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      sq += this.timeData[i] * this.timeData[i];
    }
    const rawRMS = Math.sqrt(sq / this.timeData.length);
    this.rawRMS = rawRMS;

    // Smooth and normalize to 0-1
    this.sBass += ALPHA * (Math.min(1, rawBass * BASS_NORM) - this.sBass);
    this.sMid  += ALPHA * (Math.min(1, rawMid  * MID_NORM)  - this.sMid);
    this.sHigh += ALPHA * (Math.min(1, rawHigh * HIGH_NORM) - this.sHigh);
    this.sRMS  += ALPHA * (rawRMS - this.sRMS);

    // Spectral centroid
    let wSum = 0, mMag = 0;
    for (let i = 0; i < bins; i++) {
      const lin = Math.pow(10, this.freqData[i] / 20);
      wSum += i * lin;
      mMag += lin;
    }
    const rawCent = mMag > 0 ? wSum / mMag / bins : 0;
    this.sCentroid += ALPHA * (rawCent - this.sCentroid);

    // Spectral flux (from clifford-attractor pattern)
    let fluxRaw = 0;
    if (this.prevSpectrum !== null) {
      for (let i = 0; i < bins; i++) {
        fluxRaw += Math.max(0, this.freqData[i] - this.prevSpectrum[i]);
      }
      fluxRaw /= bins;
    }
    this.prevSpectrum = Float32Array.from(this.freqData);
    this.spectralFlux += 0.5 * (fluxRaw - this.spectralFlux);

    // Beat detection — dual RMS delta + spectral flux
    this.rmsWin.shift();
    this.rmsWin.push(rawRMS);
    this.avgRMS = this.rmsWin.reduce((s, v) => s + v, 0) / RMS_WIN;

    const beatByRMS  = (rawRMS - this.avgRMS) > BEAT_THRESHOLD;
    const beatByFlux = this.spectralFlux > FLUX_THRESHOLD;

    if ((beatByRMS || beatByFlux) && this.beatCooldown <= 0) {
      this.beatFlash = 1.0;
      this.beatCooldown = BEAT_COOLDOWN_F;

      // BPM estimation from beat intervals
      const now = performance.now();
      if (this.lastBeatTime > 0) {
        const interval = now - this.lastBeatTime;
        this.beatTimes.push(interval);
        if (this.beatTimes.length > 8) this.beatTimes.shift();
        if (this.beatTimes.length >= 4) {
          const avgInterval = this.beatTimes.reduce((s, v) => s + v, 0) / this.beatTimes.length;
          this.estimatedBPM = Math.max(60, Math.min(180, 60000 / avgInterval));
        }
      }
      this.lastBeatTime = now;
    }
    this.beatFlash *= 0.82;
    this.beatCooldown = Math.max(0, this.beatCooldown - 1);

    // Update meters
    document.getElementById('bassMeter').style.height = (this.sBass * 100) + '%';
    document.getElementById('midMeter').style.height  = (this.sMid  * 100) + '%';
    document.getElementById('highMeter').style.height = (this.sHigh * 100) + '%';

    // Update status
    const beatSrc = beatByFlux ? 'F' : (beatByRMS ? 'R' : '-');
    document.getElementById('status').textContent =
      `BPM:${Math.round(this.estimatedBPM)} RMS:${rawRMS.toFixed(3)} [${beatSrc}]  B:${this.sBass.toFixed(2)} M:${this.sMid.toFixed(2)} H:${this.sHigh.toFixed(2)}`;
    document.getElementById('status').className = 'ready';

    return {
      bass: this.sBass, mid: this.sMid, high: this.sHigh,
      rms: this.sRMS, centroid: this.sCentroid,
      beatFlash: this.beatFlash, bpm: this.estimatedBPM,
      spectralFlux: this.spectralFlux
    };
  }
}
