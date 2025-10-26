import * as Tone from 'tone';
// V1 imports
import { LorenzAttractor } from './sketches/lorenz.js';
import { ParticleField } from './sketches/particles.js';
import { RosslerAttractor } from './sketches/rossler.js';
import { AudioWaveform } from './sketches/waveform.js';
// V2 imports
import { LorenzAttractorV2 } from './sketches/lorenz-v2.js';
import { ParticleFieldV2 } from './sketches/particles-v2.js';
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
  }

  setupAudioAnalysis() {
    // Create Tone.js analyzer for waveform data
    this.analyzer = new Tone.Analyser('waveform', 1024);
    this.fftAnalyzer = new Tone.Analyser('fft', 512);
  }

  async loadAudioFile(file) {
    try {
      // Stop and dispose of existing player
      if (this.player) {
        this.player.stop();
        this.player.dispose();
      }

      // Create URL from file
      const url = URL.createObjectURL(file);

      // Create new player
      this.player = new Tone.Player(url).toDestination();
      this.player.volume.value = 0; // Set to 0 dB (full volume)
      this.player.connect(this.analyzer);
      this.player.connect(this.fftAnalyzer);

      await Tone.loaded();

      // Enable controls
      document.getElementById('playPause').disabled = false;
      document.getElementById('stop').disabled = false;

      console.log('Audio file loaded successfully');
      console.log('Tone.js context state:', Tone.context.state);
    } catch (error) {
      console.error('Error loading audio file:', error);
    }
  }

  updateAudioFeatures() {
    if (!this.analyzer || !this.fftAnalyzer) return;

    // Get waveform from Tone.js analyzer
    this.audioFeatures.waveform = this.analyzer.getValue();

    // Get frequency spectrum
    const spectrum = this.fftAnalyzer.getValue();
    const bins = spectrum.length;

    // Convert dB values to linear scale and normalize
    const linearSpectrum = spectrum.map(db => Math.pow(10, db / 20));
    this.audioFeatures.amplitudeSpectrum = linearSpectrum;

    // Bass (20-250 Hz) - roughly first 10% of spectrum
    const bassEnd = Math.floor(bins * 0.1);
    this.audioFeatures.bass = this.average(linearSpectrum.slice(0, bassEnd));

    // Mid (250-4000 Hz) - roughly 10-50% of spectrum
    const midEnd = Math.floor(bins * 0.5);
    this.audioFeatures.mid = this.average(linearSpectrum.slice(bassEnd, midEnd));

    // High (4000+ Hz) - roughly 50-100% of spectrum
    this.audioFeatures.high = this.average(linearSpectrum.slice(midEnd));

    // Calculate RMS from waveform
    const waveform = this.audioFeatures.waveform;
    const sumSquares = waveform.reduce((sum, val) => sum + val * val, 0);
    this.audioFeatures.rms = Math.sqrt(sumSquares / waveform.length);

    // Calculate spectral centroid
    let weightedSum = 0;
    let magnitudeSum = 0;
    for (let i = 0; i < linearSpectrum.length; i++) {
      weightedSum += i * linearSpectrum[i];
      magnitudeSum += linearSpectrum[i];
    }
    this.audioFeatures.spectralCentroid = magnitudeSum > 0 ? (weightedSum / magnitudeSum) * 10 : 0;

    // Calculate spectral rolloff (frequency below which 85% of energy is contained)
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

    // Calculate zero crossing rate
    let crossings = 0;
    for (let i = 1; i < waveform.length; i++) {
      if ((waveform[i] >= 0 && waveform[i - 1] < 0) || (waveform[i] < 0 && waveform[i - 1] >= 0)) {
        crossings++;
      }
    }
    this.audioFeatures.zcr = crossings / waveform.length;

    // Simplified MFCC and chroma (using spectrum distribution)
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

    // Update UI
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
    // V3 - Ethereal Transitions
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
      longExposureBeamsV2: new LongExposureBeamsV2(this.canvas, this.ctx)
    };

    // Start with Rhythm Grid
    this.currentSketch = this.sketches.rhythmGrid;
  }

  switchSketch(sketchName) {
    if (this.sketches[sketchName]) {
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
      console.log('Audio paused');
    } else {
      await Tone.start();
      console.log('Tone.js started, context state:', Tone.context.state);
      console.log('Player volume:', this.player.volume.value, 'dB');
      this.player.start();
      this.isPlaying = true;
      document.getElementById('playPause').textContent = 'Pause';
      console.log('Audio playing');
    }
  }

  stop() {
    if (this.player) {
      this.player.stop();
      this.isPlaying = false;
      document.getElementById('playPause').textContent = 'Play';

      // Reset audio features
      this.audioFeatures.bass = 0;
      this.audioFeatures.mid = 0;
      this.audioFeatures.high = 0;
      this.audioFeatures.rms = 0;
      this.updateAudioInfoDisplay();
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Update audio features when playing
    if (this.isPlaying) {
      this.updateAudioFeatures();
    }

    // Draw current sketch
    if (this.currentSketch) {
      this.currentSketch.draw(this.audioFeatures);
    }
  }
}

// Initialize the application
new GenArt2025();
