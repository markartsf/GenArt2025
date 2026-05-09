import * as Tone from 'tone';

class GeometricMorphing {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Audio
    this.player = null;
    this.analyzer = null;
    this.fftAnalyzer = null;
    this.isPlaying = false;

    // TWO LAYERS - direct continuous audio mapping
    // Layer 1: Large background shapes (violin)
    this.backgroundShapes = [];
    this.numBackgroundShapes = 3;

    // Layer 2: Small foreground particles (pluck synth)
    this.pluckParticles = [];
    this.spawnCounter = 0;

    // GAIN AND NORMALIZATION
    this.gain = 10.0; // Adjustable multiplier
    this.maxValues = {
      bass: 0.01,
      midLow: 0.01,
      midHigh: 0.01,
      high: 0.01
    };
    this.maxDecay = 0.995; // Slowly decay max values

    this.audioFeatures = {
      // Raw values
      bass: 0,         // 60-250Hz
      midLow: 0,       // 250-800Hz
      midHigh: 0,      // 800-2000Hz
      high: 0,         // 2000-8000Hz

      // Gained values (raw * gain)
      bassGained: 0,
      midLowGained: 0,
      midHighGained: 0,
      highGained: 0,

      // Normalized values (0-1 based on recent max)
      bassNorm: 0,
      midLowNorm: 0,
      midHighNorm: 0,
      highNorm: 0,

      rms: 0,
      spectralCentroid: 0,
      timestamp: 0
    };

    // Fall colors
    this.palette = [
      { h: 48, s: 95, l: 60 },  // Cadmium Yellow
      { h: 355, s: 85, l: 50 }, // Naphthol Red
      { h: 25, s: 90, l: 55 },  // Cadmium Orange
      { h: 0, s: 80, l: 28 },   // Dark Red
      { h: 345, s: 70, l: 25 }, // Burgundy
      { h: 15, s: 65, l: 30 },  // Dark Brown
      { h: 40, s: 75, l: 58 },  // Neutral Orange
      { h: 50, s: 45, l: 65 },  // Yellow
    ];

    this.setupCanvas();
    this.setupAudio();
    this.setupControls();
    this.reset();
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
      this.reset();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  setupAudio() {
    // Compressor to boost quiet audio and make variations more obvious
    this.compressor = new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.1
    });

    // FFT analyzer for frequency band extraction
    this.fftAnalyzer = new Tone.Analyser('fft', 512);

    // Meters for each frequency band with smoothing
    this.bassMeter = new Tone.Meter({ smoothing: 0.8 });
    this.midLowMeter = new Tone.Meter({ smoothing: 0.8 });
    this.midHighMeter = new Tone.Meter({ smoothing: 0.8 });
    this.highMeter = new Tone.Meter({ smoothing: 0.8 });

    // Filters for each frequency band
    this.bassFilter = new Tone.Filter({ frequency: 250, type: 'lowpass' });
    this.midLowFilter = new Tone.Filter({ frequency: 800, type: 'bandpass', Q: 1 });
    this.midHighFilter = new Tone.Filter({ frequency: 1400, type: 'bandpass', Q: 1 });
    this.highFilter = new Tone.Filter({ frequency: 2000, type: 'highpass' });

    // Connect compressor to analyzers and destination
    this.compressor.connect(this.fftAnalyzer);
    this.compressor.toDestination();

    // Connect compressor to filtered meters
    this.compressor.connect(this.bassFilter);
    this.bassFilter.connect(this.bassMeter);

    this.compressor.connect(this.midLowFilter);
    this.midLowFilter.connect(this.midLowMeter);

    this.compressor.connect(this.midHighFilter);
    this.midHighFilter.connect(this.midHighMeter);

    this.compressor.connect(this.highFilter);
    this.highFilter.connect(this.highMeter);
  }

  setupControls() {
    const audioFileInput = document.getElementById('audioFile');
    const playPauseBtn = document.getElementById('playPause');
    const stopBtn = document.getElementById('stop');
    const resetBtn = document.getElementById('reset');
    const fullscreenBtn = document.getElementById('fullscreen');
    const gainSlider = document.getElementById('gainSlider');
    const gainValue = document.getElementById('gainValue');
    const statusText = document.getElementById('status');

    // Gain slider
    gainSlider.addEventListener('input', (e) => {
      this.gain = parseFloat(e.target.value);
      gainValue.textContent = this.gain.toFixed(1);
    });

    audioFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        statusText.textContent = 'Loading audio...';

        try {
          if (this.player) {
            this.player.stop();
            this.player.dispose();
          }

          const url = URL.createObjectURL(file);
          this.player = new Tone.Player(url);

          // Connect player through compressor chain
          this.player.connect(this.compressor);

          await Tone.loaded();

          playPauseBtn.disabled = false;
          stopBtn.disabled = false;
          statusText.textContent = `✓ Audio loaded: ${file.name}`;
        } catch (error) {
          console.error('Error loading audio:', error);
          statusText.textContent = '✗ Error loading audio file';
        }
      }
    });

    playPauseBtn.addEventListener('click', async () => {
      if (!this.player) return;

      if (this.isPlaying) {
        this.player.stop();
        this.isPlaying = false;
        playPauseBtn.textContent = 'Play';
        statusText.textContent = 'Paused';
      } else {
        await Tone.start();
        this.player.start();
        this.isPlaying = true;
        playPauseBtn.textContent = 'Pause';
        statusText.textContent = '▶ Playing...';
      }
    });

    stopBtn.addEventListener('click', () => {
      if (this.player) {
        this.player.stop();
        this.isPlaying = false;
        playPauseBtn.textContent = 'Play';
        statusText.textContent = 'Stopped';
        this.resetAudioFeatures();
      }
    });

    resetBtn.addEventListener('click', () => {
      this.reset();
    });

    fullscreenBtn.addEventListener('click', () => {
      const container = document.getElementById('container');
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
          console.error('Error attempting to enable fullscreen:', err);
        });
      } else {
        document.exitFullscreen();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        this.reset();
        statusText.textContent = 'Reset! (R key)';
      }
    });
  }

  reset() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // LAYER 1: Create large background shapes (driven by VIOLIN)
    this.backgroundShapes = [];
    for (let i = 0; i < this.numBackgroundShapes; i++) {
      const types = ['circle', 'triangle', 'hexagon'];
      this.backgroundShapes.push({
        type: types[i % types.length],
        x: width * 0.5,
        y: height * 0.5,
        baseSize: 150 + i * 50,
        size: 150 + i * 50,
        rotation: 0,
        colorIndex: i * 2,
        layer: i
      });
    }

    // LAYER 2: Clear pluck particles
    this.pluckParticles = [];
    this.spawnCounter = 0;

    // Clear canvas
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, width, height);
  }

  // EXACT FREQUENCY BAND EXTRACTION
  getFrequencyBand(spectrum, lowHz, highHz, sampleRate, fftSize) {
    const nyquist = sampleRate / 2;

    // Convert Hz to bin indices
    // Formula: bin = (Hz / nyquist) * fftSize
    const lowBin = Math.floor((lowHz / nyquist) * fftSize);
    const highBin = Math.floor((highHz / nyquist) * fftSize);

    // Extract slice
    const slice = spectrum.slice(lowBin, highBin + 1);

    // Average ALL bins in range
    const sum = slice.reduce((acc, val) => acc + val, 0);
    const avg = sum / slice.length;

    console.log(`Band ${lowHz}-${highHz}Hz: bins ${lowBin}-${highBin} (${slice.length} bins), avg=${avg.toFixed(4)}`);

    return avg;
  }

  updateAudioFeatures() {
    if (!this.fftAnalyzer || !this.isPlaying) return;

    // Get Tone.Meter values (already normalized, -Infinity to 0 dB)
    // Convert from dB to 0-1 range: dB range is typically -100 to 0
    const bassDb = this.bassMeter.getValue();
    const midLowDb = this.midLowMeter.getValue();
    const midHighDb = this.midHighMeter.getValue();
    const highDb = this.highMeter.getValue();

    // Log meter values every 60 frames (~1 second)
    if (Math.random() < 0.016) {
      console.log('Meter dB values:', {
        bass: bassDb.toFixed(2),
        midLow: midLowDb.toFixed(2),
        midHigh: midHighDb.toFixed(2),
        high: highDb.toFixed(2)
      });
    }

    // Convert dB to linear 0-1 range (assuming -60dB to 0dB range)
    const dbToLinear = (db) => {
      const normalized = Math.max(0, (db + 60) / 60);
      return normalized;
    };

    // Extract RAW frequency bands from meters
    this.audioFeatures.bass = dbToLinear(bassDb);
    this.audioFeatures.midLow = dbToLinear(midLowDb);
    this.audioFeatures.midHigh = dbToLinear(midHighDb);
    this.audioFeatures.high = dbToLinear(highDb);

    // APPLY GAIN
    this.audioFeatures.bassGained = this.audioFeatures.bass * this.gain;
    this.audioFeatures.midLowGained = this.audioFeatures.midLow * this.gain;
    this.audioFeatures.midHighGained = this.audioFeatures.midHigh * this.gain;
    this.audioFeatures.highGained = this.audioFeatures.high * this.gain;

    // UPDATE MAX VALUES (with slow decay)
    this.maxValues.bass = Math.max(this.maxValues.bass * this.maxDecay, this.audioFeatures.bassGained);
    this.maxValues.midLow = Math.max(this.maxValues.midLow * this.maxDecay, this.audioFeatures.midLowGained);
    this.maxValues.midHigh = Math.max(this.maxValues.midHigh * this.maxDecay, this.audioFeatures.midHighGained);
    this.maxValues.high = Math.max(this.maxValues.high * this.maxDecay, this.audioFeatures.highGained);

    // NORMALIZE (0-1 based on recent max)
    this.audioFeatures.bassNorm = this.maxValues.bass > 0 ? this.audioFeatures.bassGained / this.maxValues.bass : 0;
    this.audioFeatures.midLowNorm = this.maxValues.midLow > 0 ? this.audioFeatures.midLowGained / this.maxValues.midLow : 0;
    this.audioFeatures.midHighNorm = this.maxValues.midHigh > 0 ? this.audioFeatures.midHighGained / this.maxValues.midHigh : 0;
    this.audioFeatures.highNorm = this.maxValues.high > 0 ? this.audioFeatures.highGained / this.maxValues.high : 0;

    // Get FFT spectrum for spectral centroid calculation
    const spectrum = this.fftAnalyzer.getValue();
    const fftSize = spectrum.length;
    const linearSpectrum = spectrum.map(db => Math.pow(10, db / 20));
    const sampleRate = 44100;
    const nyquist = sampleRate / 2;

    // RMS from compressed signal (use bass meter as proxy)
    this.audioFeatures.rms = this.audioFeatures.bass;

    // Spectral centroid (weighted average of frequencies)
    let weightedSum = 0;
    let magnitudeSum = 0;
    for (let i = 0; i < linearSpectrum.length; i++) {
      const freq = (i / fftSize) * nyquist;
      weightedSum += freq * linearSpectrum[i];
      magnitudeSum += linearSpectrum[i];
    }
    this.audioFeatures.spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;

    // Timestamp
    this.audioFeatures.timestamp = this.player ? this.player.immediate() : 0;

    this.updateAudioInfoDisplay();
  }

  average(array) {
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }

  updateAudioInfoDisplay() {
    const infoDiv = document.getElementById('audio-info');
    infoDiv.innerHTML = `
      <div class="info-item">
        <div class="info-label">BASS (60-250Hz)</div>
        <div class="info-value">${(this.audioFeatures.bass * 100).toFixed(1)}%</div>
      </div>
      <div class="info-item">
        <div class="info-label">MID-LOW (250-800Hz)</div>
        <div class="info-value">${(this.audioFeatures.midLow * 100).toFixed(1)}%</div>
      </div>
      <div class="info-item">
        <div class="info-label">MID-HIGH (800-2000Hz)</div>
        <div class="info-value">${(this.audioFeatures.midHigh * 100).toFixed(1)}%</div>
      </div>
      <div class="info-item">
        <div class="info-label">HIGH (2000-8000Hz)</div>
        <div class="info-value">${(this.audioFeatures.high * 100).toFixed(1)}%</div>
      </div>
      <div class="info-item">
        <div class="info-label">RMS</div>
        <div class="info-value">${(this.audioFeatures.rms * 100).toFixed(1)}%</div>
      </div>
      <div class="info-item">
        <div class="info-label">Centroid</div>
        <div class="info-value">${this.audioFeatures.spectralCentroid.toFixed(0)} Hz</div>
      </div>
    `;
  }

  resetAudioFeatures() {
    this.audioFeatures.bass = 0;
    this.audioFeatures.midLow = 0;
    this.audioFeatures.midHigh = 0;
    this.audioFeatures.high = 0;
    this.audioFeatures.bassGained = 0;
    this.audioFeatures.midLowGained = 0;
    this.audioFeatures.midHighGained = 0;
    this.audioFeatures.highGained = 0;
    this.audioFeatures.bassNorm = 0;
    this.audioFeatures.midLowNorm = 0;
    this.audioFeatures.midHighNorm = 0;
    this.audioFeatures.highNorm = 0;
    this.audioFeatures.rms = 0;
    this.audioFeatures.spectralCentroid = 0;
    this.audioFeatures.timestamp = 0;
    this.updateAudioInfoDisplay();
  }

  update() {
    if (!this.isPlaying) return;

    this.updateAudioFeatures();

    // DEBUG MODE - no visual updates, just show the data
  }

  drawBackgroundShape(shape) {
    const color = this.palette[shape.colorIndex];

    // Hue shift based on violin
    const hue = (color.h + this.audioFeatures.violin * 50) % 360;

    // Glow based on violin
    this.ctx.shadowBlur = 15 + this.audioFeatures.violin * 30;
    this.ctx.shadowColor = `hsla(${hue}, ${color.s}%, ${color.l}%, 0.5)`;

    this.ctx.save();
    this.ctx.translate(shape.x, shape.y);
    this.ctx.rotate(shape.rotation);

    // Stroke only
    this.ctx.strokeStyle = `hsla(${hue}, ${color.s}%, ${color.l}%, 0.6)`;
    this.ctx.lineWidth = 4 + this.audioFeatures.violin * 6;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();

    switch (shape.type) {
      case 'circle':
        this.ctx.arc(0, 0, shape.size, 0, Math.PI * 2);
        break;

      case 'triangle':
        for (let i = 0; i < 3; i++) {
          const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(angle) * shape.size;
          const y = Math.sin(angle) * shape.size;
          if (i === 0) this.ctx.moveTo(x, y);
          else this.ctx.lineTo(x, y);
        }
        this.ctx.closePath();
        break;

      case 'hexagon':
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const x = Math.cos(angle) * shape.size;
          const y = Math.sin(angle) * shape.size;
          if (i === 0) this.ctx.moveTo(x, y);
          else this.ctx.lineTo(x, y);
        }
        this.ctx.closePath();
        break;
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  drawDebugDisplay() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.ctx.shadowBlur = 0;
    this.ctx.font = 'bold 18px monospace';

    const barWidth = 500;
    const barHeight = 35;
    const spacing = 90;
    const startY = 50;
    const startX = 50;

    // Draw each frequency band
    const bands = [
      {
        label: 'BASS (60-250Hz)',
        raw: this.audioFeatures.bass,
        gained: this.audioFeatures.bassGained,
        norm: this.audioFeatures.bassNorm,
        max: this.maxValues.bass,
        color: '#ff4444'
      },
      {
        label: 'MID-LOW (250-800Hz)',
        raw: this.audioFeatures.midLow,
        gained: this.audioFeatures.midLowGained,
        norm: this.audioFeatures.midLowNorm,
        max: this.maxValues.midLow,
        color: '#ff8844'
      },
      {
        label: 'MID-HIGH (800-2000Hz)',
        raw: this.audioFeatures.midHigh,
        gained: this.audioFeatures.midHighGained,
        norm: this.audioFeatures.midHighNorm,
        max: this.maxValues.midHigh,
        color: '#ffbb44'
      },
      {
        label: 'HIGH (2000-8000Hz)',
        raw: this.audioFeatures.high,
        gained: this.audioFeatures.highGained,
        norm: this.audioFeatures.highNorm,
        max: this.maxValues.high,
        color: '#44ff44'
      }
    ];

    bands.forEach((band, i) => {
      const y = startY + i * spacing;

      // Label
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(band.label, startX, y);

      // Values (Raw, Gained, Normalized)
      this.ctx.font = 'bold 14px monospace';
      this.ctx.fillText(`Raw: ${band.raw.toFixed(4)}`, startX, y + 18);
      this.ctx.fillText(`x${this.gain.toFixed(1)} = ${band.gained.toFixed(3)}`, startX + 150, y + 18);
      this.ctx.fillText(`Norm: ${(band.norm * 100).toFixed(0)}%`, startX + 320, y + 18);
      this.ctx.font = 'bold 18px monospace';

      // Bar background
      this.ctx.fillStyle = '#222222';
      this.ctx.fillRect(startX, y + 25, barWidth, barHeight);

      // Bar foreground (using NORMALIZED value)
      const barFill = Math.min(1, band.norm) * barWidth;
      this.ctx.fillStyle = band.color;
      this.ctx.fillRect(startX, y + 25, barFill, barHeight);

      // Bar border
      this.ctx.strokeStyle = '#666666';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(startX, y + 25, barWidth, barHeight);

      // Max value indicator
      this.ctx.fillStyle = '#666666';
      this.ctx.font = 'bold 11px monospace';
      this.ctx.fillText(`Max: ${band.max.toFixed(3)}`, startX + barWidth + 10, y + 45);
      this.ctx.font = 'bold 18px monospace';
    });

    // Additional info
    const infoY = startY + bands.length * spacing + 20;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 18px monospace';
    this.ctx.fillText(`RMS: ${(this.audioFeatures.rms * 100).toFixed(1)}%`, startX, infoY);
    this.ctx.fillText(`Spectral Centroid: ${this.audioFeatures.spectralCentroid.toFixed(0)} Hz`, startX, infoY + 30);
    this.ctx.fillText(`Time: ${this.audioFeatures.timestamp.toFixed(2)}s`, startX, infoY + 60);
    this.ctx.fillText(`Gain: ${this.gain.toFixed(1)}x`, startX, infoY + 90);
  }

  draw() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Clear background
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, width, height);

    // Draw BIG DEBUG DISPLAY
    this.drawDebugDisplay();

    this.ctx.shadowBlur = 0;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.update();
    this.draw();
  }
}

// Initialize
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
new GeometricMorphing(canvas, ctx);
