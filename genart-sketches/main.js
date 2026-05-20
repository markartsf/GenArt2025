import * as Tone from 'tone';
// V1 imports
import { LorenzAttractor } from './sketches/lorenz.js';
import { ParticleField } from './sketches/particles.js';
import { RosslerAttractor } from './sketches/rossler.js';
import { AudioWaveform } from './sketches/waveform.js';
// V3 imports
import { LorenzAttractorV3 } from './sketches/lorenz-v3.js';
import { RosslerAttractorV3 } from './sketches/rossler-v3.js';
import { ParticleFieldV3 } from './sketches/particles-v3.js';
import { AudioWaveformV3 } from './sketches/waveform-v3.js';
import { SpiralGalaxy } from './sketches/spiral-galaxy.js';
import { FractalTree } from './sketches/fractal-tree.js';
import { ChromaticKaleidoscope } from './sketches/chromatic-kaleidoscope.js';
// Light Trail visualizations
import { LightHighway } from './sketches/light-highway.js';
import { NeonPainter } from './sketches/neon-painter.js';
import { ChromaticFlow } from './sketches/chromatic-flow.js';
// Audio-Responsive Visualizations
import { RhythmGrid } from './sketches/rhythm-grid.js';
import { TimbreSpectrum } from './sketches/timbre-spectrum.js';
import { LongExposureBeams } from './sketches/long-exposure-beams.js';
import { LongExposureBeamsV2 } from './sketches/long-exposure-beams-v2.js';
import { LongExposureBeamsV3 } from './sketches/long-exposure-beams-v3.js';
// import { LongExposureP5 } from './sketches/long-exposure-p5.js'; // DISABLED - breaks app
import { LorenzReactive } from './sketches/lorenz-reactive.js';
import { BoidsFlock } from './sketches/boids-flock.js';
import { ParticleLife } from './sketches/particle-life.js';
import { TwistedTorus } from './sketches/twisted-torus.js';
import { SquaxinBlooms } from './sketches/squaxin-blooms.js';

// Preloaded audio file — served from project root via Vite
const PRELOAD_AUDIO = '/geometric-morphing/circles01a.mp3';

class GenArt2025 {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.player = null;
    this.analyzer = null;
    this.fftAnalyzer = null;
    this.currentSketch = null;
    this.isPlaying = false;
    this.audioFeatures = {
      bass: 0,
      mid: 0,
      high: 0,
      spectralCentroid: 0,
      spectralRolloff: 0,
      rms: 0,
      zcr: 0,
      mfcc: new Array(13).fill(0),
      chroma: new Array(12).fill(0),
      amplitudeSpectrum: new Array(512).fill(0),
      waveform: new Array(1024).fill(0)
    };

    this.setupCanvas();
    this.setupControls();
    this.setupAudioAnalysis();
    this.initializeSketches();
    this.animate();

    // Auto-load the preloaded audio file
    this.preloadAudio();
  }

  setupCanvas() {
    const resizeCanvas = () => {
      const container = document.getElementById('canvas-container');
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = container.clientWidth * dpr;
      this.canvas.height = container.clientHeight * dpr;
      this.canvas.style.width = container.clientWidth + 'px';
      this.canvas.style.height = container.clientHeight + 'px';
      this.ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  setupControls() {
    const audioFileInput = document.getElementById('audioFile');
    const sketchSelect = document.getElementById('sketchSelect');
    const playPauseBtn = document.getElementById('playPause');
    const stopBtn = document.getElementById('stop');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    audioFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await this.loadAudioFile(file);
      }
    });

    sketchSelect.addEventListener('change', (e) => {
      this.switchSketch(e.target.value);
    });

    playPauseBtn.addEventListener('click', async () => {
      await this.togglePlayPause();
    });

    stopBtn.addEventListener('click', () => {
      this.stop();
    });

    fullscreenBtn.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // F key also toggles fullscreen
    document.addEventListener('keydown', (e) => {
      if (e.key === 'f' || e.key === 'F') {
        this.toggleFullscreen();
      }
    });
  }

  toggleFullscreen() {
    const container = document.getElementById('container');
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  setupAudioAnalysis() {
    this.analyzer = new Tone.Analyser('waveform', 1024);
    this.fftAnalyzer = new Tone.Analyser('fft', 512);
  }

  setStatus(msg, cls) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = cls || '';
  }

  async preloadAudio() {
    this.setStatus('Loading circles01a.mp3...', 'loading');
    try {
      const response = await fetch(PRELOAD_AUDIO);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      await this._createPlayer(url);
      this.setStatus('Ready — circles01a.mp3 loaded. Press Play.', 'ready');
    } catch (err) {
      console.error('Preload failed:', err);
      this.setStatus('Could not auto-load audio. Use "Override Audio" to pick a file.', 'error');
    }
  }

  async loadAudioFile(file) {
    this.setStatus(`Loading ${file.name}...`, 'loading');
    try {
      const url = URL.createObjectURL(file);
      await this._createPlayer(url);
      this.setStatus(`Ready — ${file.name} loaded. Press Play.`, 'ready');
    } catch (error) {
      console.error('Error loading audio file:', error);
      this.setStatus('Error loading audio file.', 'error');
    }
  }

  async _createPlayer(url) {
    // Stop and dispose of existing player
    if (this.player) {
      if (this.isPlaying) {
        this.player.stop();
        this.isPlaying = false;
        document.getElementById('playPause').textContent = 'Play';
      }
      this.player.dispose();
      this.player = null;
    }

    this.player = new Tone.Player(url).toDestination();
    this.player.volume.value = 0;
    this.player.connect(this.analyzer);
    this.player.connect(this.fftAnalyzer);

    await Tone.loaded();

    document.getElementById('playPause').disabled = false;
    document.getElementById('stop').disabled = false;
  }

  updateAudioFeatures() {
    if (!this.analyzer || !this.fftAnalyzer) return;

    const waveformValues = this.analyzer.getValue();
    for (let i = 0; i < waveformValues.length; i++) {
      this.audioFeatures.waveform[i] = waveformValues[i];
    }

    const spectrum = this.fftAnalyzer.getValue();
    const bins = spectrum.length;

    for (let i = 0; i < bins; i++) {
      this.audioFeatures.amplitudeSpectrum[i] = Math.pow(10, spectrum[i] / 20);
    }
    const linearSpectrum = this.audioFeatures.amplitudeSpectrum;

    const bassEnd = Math.floor(bins * 0.1);
    this.audioFeatures.bass = this.average(linearSpectrum.slice(0, bassEnd));

    const midEnd = Math.floor(bins * 0.5);
    this.audioFeatures.mid = this.average(linearSpectrum.slice(bassEnd, midEnd));

    this.audioFeatures.high = this.average(linearSpectrum.slice(midEnd));

    const waveform = this.audioFeatures.waveform;
    const sumSquares = waveform.reduce((sum, val) => sum + val * val, 0);
    this.audioFeatures.rms = Math.sqrt(sumSquares / waveform.length);

    let weightedSum = 0;
    let magnitudeSum = 0;
    for (let i = 0; i < linearSpectrum.length; i++) {
      weightedSum += i * linearSpectrum[i];
      magnitudeSum += linearSpectrum[i];
    }
    this.audioFeatures.spectralCentroid = magnitudeSum > 0 ? (weightedSum / magnitudeSum) * 10 : 0;

    const energyThreshold = magnitudeSum * 0.85;
    let cumulativeEnergy = 0;
    let rolloffBin = 0;
    for (let i = 0; i < linearSpectrum.length; i++) {
      cumulativeEnergy += linearSpectrum[i];
      if (cumulativeEnergy >= energyThreshold) {
        rolloffBin = i;
        break;
      }
    }
    this.audioFeatures.spectralRolloff = rolloffBin;

    let crossings = 0;
    for (let i = 1; i < waveform.length; i++) {
      if ((waveform[i] >= 0 && waveform[i - 1] < 0) || (waveform[i] < 0 && waveform[i - 1] >= 0)) {
        crossings++;
      }
    }
    this.audioFeatures.zcr = crossings / waveform.length;

    for (let i = 0; i < 13; i++) {
      const binStart = Math.floor((i / 13) * bins);
      const binEnd = Math.floor(((i + 1) / 13) * bins);
      this.audioFeatures.mfcc[i] = this.average(linearSpectrum.slice(binStart, binEnd));
    }

    for (let i = 0; i < 12; i++) {
      const binStart = Math.floor((i / 12) * bins);
      const binEnd = Math.floor(((i + 1) / 12) * bins);
      this.audioFeatures.chroma[i] = this.average(linearSpectrum.slice(binStart, binEnd));
    }

    this.updateAudioInfoDisplay();
  }

  average(array) {
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }

  updateAudioInfoDisplay() {
    const infoDiv = document.getElementById('audio-info');
    infoDiv.innerHTML = `
      <div class="info-item">
        <div class="info-label">Bass</div>
        <div class="info-value">${this.audioFeatures.bass.toFixed(4)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Mid</div>
        <div class="info-value">${this.audioFeatures.mid.toFixed(4)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">High</div>
        <div class="info-value">${this.audioFeatures.high.toFixed(4)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Spectral Centroid</div>
        <div class="info-value">${this.audioFeatures.spectralCentroid.toFixed(2)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">RMS</div>
        <div class="info-value">${this.audioFeatures.rms.toFixed(4)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Zero Crossing Rate</div>
        <div class="info-value">${this.audioFeatures.zcr.toFixed(4)}</div>
      </div>
    `;
  }

  initializeSketches() {
    this.sketches = {
      lorenz: new LorenzAttractorV3(this.canvas, this.ctx),
      particles: new ParticleFieldV3(this.canvas, this.ctx),
      rossler: new RosslerAttractorV3(this.canvas, this.ctx),
      waveform: new AudioWaveformV3(this.canvas, this.ctx),
      galaxy: new SpiralGalaxy(this.canvas, this.ctx),
      tree: new FractalTree(this.canvas, this.ctx),
      kaleidoscope: new ChromaticKaleidoscope(this.canvas, this.ctx),
      lightHighway: new LightHighway(this.canvas, this.ctx),
      neonPainter: new NeonPainter(this.canvas, this.ctx),
      chromaticFlow: new ChromaticFlow(this.canvas, this.ctx),
      rhythmGrid: new RhythmGrid(this.canvas, this.ctx),
      timbreSpectrum: new TimbreSpectrum(this.canvas, this.ctx),
      longExposureBeams: new LongExposureBeams(this.canvas, this.ctx),
      longExposureBeamsV2: new LongExposureBeamsV2(this.canvas, this.ctx),
      longExposureBeamsV3: new LongExposureBeamsV3(this.canvas, this.ctx),
      lorenzReactive: new LorenzReactive(this.canvas, this.ctx),
      boidsFlock: new BoidsFlock(this.canvas, this.ctx),
      particleLife: new ParticleLife(this.canvas, this.ctx),
      twistedTorus: new TwistedTorus(this.canvas, this.ctx),
      squaxinBlooms: new SquaxinBlooms(this.canvas, this.ctx),
    };

    // Start with Lorenz Reactive as default
    this.currentSketch = this.sketches.lorenzReactive;
  }

  switchSketch(sketchName) {
    if (this.sketches[sketchName]) {
      if (this.currentSketch && this.currentSketch.dispose) {
        this.currentSketch.dispose();
      }
      this.currentSketch = this.sketches[sketchName];
      this.currentSketch.reset();
    }
  }

  async togglePlayPause() {
    if (!this.player) return;

    if (this.isPlaying) {
      this.player.stop();
      this.isPlaying = false;
      document.getElementById('playPause').textContent = 'Play';
    } else {
      await Tone.start();
      this.player.start();
      this.isPlaying = true;
      document.getElementById('playPause').textContent = 'Pause';
    }
  }

  stop() {
    if (this.player) {
      this.player.stop();
      this.isPlaying = false;
      document.getElementById('playPause').textContent = 'Play';

      this.audioFeatures.bass = 0;
      this.audioFeatures.mid = 0;
      this.audioFeatures.high = 0;
      this.audioFeatures.rms = 0;
      this.updateAudioInfoDisplay();
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.isPlaying) {
      this.updateAudioFeatures();
    }

    if (this.currentSketch) {
      this.currentSketch.draw(this.audioFeatures);
    }
  }
}

new GenArt2025();
