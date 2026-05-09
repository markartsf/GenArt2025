import * as Tone from 'tone';

class LayeredRibbons {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Audio
    this.player = null;
    this.compressor = null;
    this.isPlaying = false;

    // Audio features
    this.audioFeatures = {
      bass: 0,
      midLow: 0,      // Violin 250-800Hz
      midHigh: 0,     // Pluck synth 800-2000Hz
      high: 0
    };

    // DUAL LAYER RIBBONS
    // Layer 1: Violin ribbons (slow, flowing, wide)
    this.violinRibbons = [];
    this.numViolinRibbons = 4;

    // Layer 2: Pluck ribbons (fast, sharp, thin)
    this.pluckRibbons = [];
    this.numPluckRibbons = 5;

    this.pointsPerRibbon = 100;
    this.pointSpacing = 12;

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

    // Animation
    this.time = 0;
    this.flowSpeed = 2;

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
    // Compressor to boost quiet audio
    this.compressor = new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.1
    });

    // Meters for each frequency band
    this.bassMeter = new Tone.Meter({ smoothing: 0.8 });
    this.midLowMeter = new Tone.Meter({ smoothing: 0.8 });
    this.midHighMeter = new Tone.Meter({ smoothing: 0.8 });
    this.highMeter = new Tone.Meter({ smoothing: 0.8 });

    // Filters
    this.bassFilter = new Tone.Filter({ frequency: 250, type: 'lowpass' });
    this.midLowFilter = new Tone.Filter({ frequency: 800, type: 'bandpass', Q: 1 });
    this.midHighFilter = new Tone.Filter({ frequency: 1400, type: 'bandpass', Q: 1 });
    this.highFilter = new Tone.Filter({ frequency: 2000, type: 'highpass' });

    // Connect compressor to filtered meters
    this.compressor.connect(this.bassFilter);
    this.bassFilter.connect(this.bassMeter);

    this.compressor.connect(this.midLowFilter);
    this.midLowFilter.connect(this.midLowMeter);

    this.compressor.connect(this.midHighFilter);
    this.midHighFilter.connect(this.midHighMeter);

    this.compressor.connect(this.highFilter);
    this.highFilter.connect(this.highMeter);

    // Connect to destination
    this.compressor.toDestination();
  }

  setupControls() {
    const audioFileInput = document.getElementById('audioFile');
    const playPauseBtn = document.getElementById('playPause');
    const stopBtn = document.getElementById('stop');
    const resetBtn = document.getElementById('reset');
    const fullscreenBtn = document.getElementById('fullscreen');
    const statusText = document.getElementById('status');

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

    // LAYER 1: VIOLIN RIBBONS (slow, flowing, smooth)
    this.violinRibbons = [];
    const violinSpacing = height / (this.numViolinRibbons + 1);

    for (let i = 0; i < this.numViolinRibbons; i++) {
      const baseY = violinSpacing * (i + 1);
      const colorIndex = i * 2; // Use every other color

      const ribbon = {
        points: [],
        baseY: baseY,
        colorIndex: colorIndex % this.palette.length,
        phase: Math.random() * Math.PI * 2,
        amplitude: 100 + Math.random() * 80, // Large, dramatic waves
        frequency: 0.02 + Math.random() * 0.01 // Slower frequency
      };

      // Initialize points
      const startX = -this.pointSpacing * 10;
      for (let j = 0; j < this.pointsPerRibbon; j++) {
        ribbon.points.push({
          x: startX + (j * this.pointSpacing),
          y: baseY,
          baseY: baseY,
          offset: 0
        });
      }

      this.violinRibbons.push(ribbon);
    }

    // LAYER 2: PLUCK RIBBONS (fast, sharp, staccato)
    this.pluckRibbons = [];
    const pluckSpacing = height / (this.numPluckRibbons + 1);

    for (let i = 0; i < this.numPluckRibbons; i++) {
      const baseY = pluckSpacing * (i + 1);
      const colorIndex = i * 2 + 1; // Use alternating colors

      const ribbon = {
        points: [],
        baseY: baseY,
        colorIndex: colorIndex % this.palette.length,
        phase: Math.random() * Math.PI * 2,
        // Pluck ribbons have minimal base wave
        amplitude: 20 + Math.random() * 30,
        frequency: 0.08 + Math.random() * 0.04 // Faster frequency
      };

      // Initialize points
      const startX = -this.pointSpacing * 10;
      for (let j = 0; j < this.pointsPerRibbon; j++) {
        ribbon.points.push({
          x: startX + (j * this.pointSpacing),
          y: baseY,
          baseY: baseY,
          spikeEnergy: 0
        });
      }

      this.pluckRibbons.push(ribbon);
    }

    this.time = 0;
  }

  resetAudioFeatures() {
    this.audioFeatures.bass = 0;
    this.audioFeatures.midLow = 0;
    this.audioFeatures.midHigh = 0;
    this.audioFeatures.high = 0;
  }

  updateAudioFeatures() {
    if (!this.isPlaying) return;

    // Get meter values
    const bassDb = this.bassMeter.getValue();
    const midLowDb = this.midLowMeter.getValue();
    const midHighDb = this.midHighMeter.getValue();
    const highDb = this.highMeter.getValue();

    // Convert dB to linear 0-1 range
    const dbToLinear = (db) => Math.max(0, (db + 60) / 60);

    this.audioFeatures.bass = dbToLinear(bassDb);
    this.audioFeatures.midLow = dbToLinear(midLowDb);
    this.audioFeatures.midHigh = dbToLinear(midHighDb);
    this.audioFeatures.high = dbToLinear(highDb);

    // Log audio values periodically (every ~2 seconds)
    if (Math.random() < 0.008) {
      console.log('Audio values:', {
        'Violin (midLow)': this.audioFeatures.midLow.toFixed(3),
        'Pluck (midHigh)': this.audioFeatures.midHigh.toFixed(3),
        'Bass': this.audioFeatures.bass.toFixed(3),
        'High': this.audioFeatures.high.toFixed(3)
      });
    }
  }

  update() {
    this.updateAudioFeatures();
    this.time += 0.016; // ~60fps

    const width = this.canvas.width / (window.devicePixelRatio || 1);

    // UPDATE LAYER 1: VIOLIN RIBBONS (smooth, flowing waves)
    this.violinRibbons.forEach((ribbon) => {
      // Shift all points left (slow flow)
      ribbon.points.forEach(point => {
        point.x -= this.flowSpeed * 0.8; // Slower than pluck ribbons
      });

      // Remove points off-screen
      ribbon.points = ribbon.points.filter(p => p.x > -this.pointSpacing * 2);

      // Add new points on right
      while (true) {
        const lastPoint = ribbon.points[ribbon.points.length - 1];
        if (lastPoint && lastPoint.x >= width + this.pointSpacing * 10) break;

        const newX = lastPoint ? lastPoint.x + this.pointSpacing : width + this.pointSpacing;
        ribbon.points.push({
          x: newX,
          y: ribbon.baseY,
          baseY: ribbon.baseY,
          offset: 0
        });

        if (ribbon.points.length > this.pointsPerRibbon * 3) break;
      }

      // Update positions - ONLY RESPONDS TO VIOLIN
      ribbon.points.forEach((point, i) => {
        const phase = ribbon.phase + (i * ribbon.frequency) + (this.time * 0.5);
        const waveBase = Math.sin(phase) * ribbon.amplitude;

        // Strong violin response with base movement
        point.offset = waveBase * (0.3 + this.audioFeatures.midLow * 4);
        point.y = point.baseY + point.offset;
      });
    });

    // UPDATE LAYER 2: PLUCK RIBBONS (sharp vertical spikes)
    this.pluckRibbons.forEach((ribbon) => {
      // Shift all points left (faster flow)
      ribbon.points.forEach(point => {
        point.x -= this.flowSpeed * 1.2; // Faster than violin ribbons
      });

      // Remove points off-screen
      ribbon.points = ribbon.points.filter(p => p.x > -this.pointSpacing * 2);

      // Add new points on right
      while (true) {
        const lastPoint = ribbon.points[ribbon.points.length - 1];
        if (lastPoint && lastPoint.x >= width + this.pointSpacing * 10) break;

        const newX = lastPoint ? lastPoint.x + this.pointSpacing : width + this.pointSpacing;
        ribbon.points.push({
          x: newX,
          y: ribbon.baseY,
          baseY: ribbon.baseY,
          spikeEnergy: 0
        });

        if (ribbon.points.length > this.pointsPerRibbon * 3) break;
      }

      // Update positions - ONLY RESPONDS TO PLUCK SYNTH
      ribbon.points.forEach((point, i) => {
        const totalPoints = ribbon.points.length;
        const fromRight = totalPoints - i;

        // Small base wave for visual continuity
        const phase = ribbon.phase + (i * ribbon.frequency) + (this.time * 2);
        const baseWave = Math.sin(phase) * ribbon.amplitude * 0.3;

        // SHARP SPIKES on right side with pluck energy
        if (fromRight < 25) {
          // Exponential response for dramatic effect
          const pluckPower = Math.pow(this.audioFeatures.midHigh, 1.2) * 400;
          const falloff = Math.pow(1 - fromRight / 25, 0.8);
          point.spikeEnergy = pluckPower * falloff;
        } else {
          // Fast decay for sharp staccato feel
          point.spikeEnergy *= 0.85;
        }

        point.y = point.baseY + baseWave + point.spikeEnergy;
      });
    });
  }

  draw() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Fade trail effect - lighter fade for more visible trails
    this.ctx.fillStyle = 'rgba(10, 10, 10, 0.06)';
    this.ctx.fillRect(0, 0, width, height);

    // DRAW LAYER 1: VIOLIN RIBBONS (background, wide, flowing)
    this.violinRibbons.forEach((ribbon) => {
      const color = this.palette[ribbon.colorIndex];

      // Hue shift based on violin energy
      const hue = (color.h + this.audioFeatures.midLow * 80) % 360;

      // Thick ribbons that pulse with violin
      const thickness = 10 + this.audioFeatures.midLow * 18;

      // Moderate opacity
      const opacity = 0.5 + this.audioFeatures.midLow * 0.3;

      // Soft, gentle glow
      this.ctx.shadowBlur = 25 + this.audioFeatures.midLow * 30;
      this.ctx.shadowColor = `hsla(${hue}, ${color.s}%, ${color.l}%, 0.6)`;

      // Draw ribbon
      this.ctx.strokeStyle = `hsla(${hue}, ${color.s}%, ${color.l}%, ${opacity})`;
      this.ctx.lineWidth = thickness;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.beginPath();

      for (let i = 0; i < ribbon.points.length; i++) {
        const point = ribbon.points[i];

        if (i === 0) {
          this.ctx.moveTo(point.x, point.y);
        } else {
          const prevPoint = ribbon.points[i - 1];
          const midX = (prevPoint.x + point.x) / 2;
          const midY = (prevPoint.y + point.y) / 2;
          this.ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, midX, midY);
        }
      }

      this.ctx.stroke();
    });

    // DRAW LAYER 2: PLUCK RIBBONS (foreground, thin, sharp)
    this.pluckRibbons.forEach((ribbon) => {
      const color = this.palette[ribbon.colorIndex];

      // Brighter hue with pluck energy
      const hue = (color.h + this.audioFeatures.midHigh * 100) % 360;

      // Thin ribbons that flash bright with plucks
      const thickness = 3 + this.audioFeatures.midHigh * 10;

      // High opacity with bright flashes
      const opacity = 0.8 + this.audioFeatures.midHigh * 0.2;

      // Intense glow on plucks
      this.ctx.shadowBlur = 15 + this.audioFeatures.midHigh * 50;
      this.ctx.shadowColor = `hsla(${hue}, ${color.s + 20}%, ${color.l + 15}%, 0.9)`;

      // Draw ribbon with brighter colors
      const lightness = Math.min(95, color.l + this.audioFeatures.midHigh * 25);
      this.ctx.strokeStyle = `hsla(${hue}, ${color.s}%, ${lightness}%, ${opacity})`;
      this.ctx.lineWidth = thickness;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.beginPath();

      for (let i = 0; i < ribbon.points.length; i++) {
        const point = ribbon.points[i];

        if (i === 0) {
          this.ctx.moveTo(point.x, point.y);
        } else {
          const prevPoint = ribbon.points[i - 1];
          const midX = (prevPoint.x + point.x) / 2;
          const midY = (prevPoint.y + point.y) / 2;
          this.ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, midX, midY);
        }
      }

      this.ctx.stroke();
    });

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
new LayeredRibbons(canvas, ctx);
