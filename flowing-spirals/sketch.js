import * as Tone from 'tone';

class FlowingSpirals {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Audio
    this.player = null;
    this.analyzer = null;
    this.fftAnalyzer = null;
    this.isPlaying = false;

    // Spirals - Archimedean spiral parameters
    this.spirals = [];
    this.numSpiralCenters = 3; // Fewer centers, but each has multiple arms
    this.armsPerCenter = 4;     // Multiple concentric waves per center

    this.audioFeatures = {
      bass: 0,
      mid: 0,
      high: 0,
      rms: 0,
      spectrum: new Array(512).fill(0)
    };

    // Fall colors in HSL for smooth transitions
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
    this.analyzer = new Tone.Analyser('waveform', 1024);
    this.fftAnalyzer = new Tone.Analyser('fft', 512);
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
          this.player = new Tone.Player(url).toDestination();
          this.player.volume.value = 0;
          this.player.connect(this.analyzer);
          this.player.connect(this.fftAnalyzer);

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

    // Create spiral centers with multiple arms each
    this.spirals = [];

    for (let i = 0; i < this.numSpiralCenters; i++) {
      // Position centers with more screen coverage
      const centerX = (Math.random() * 0.8 + 0.1) * width;
      const centerY = (Math.random() * 0.8 + 0.1) * height;

      // Each center has multiple spiral arms (waves)
      for (let arm = 0; arm < this.armsPerCenter; arm++) {
        const armOffset = (arm / this.armsPerCenter) * Math.PI * 2;

        // Randomize spiral behavior
        const spiralType = Math.random();
        let maxTheta, reverses;

        if (spiralType < 0.4) {
          // Full complete spiral
          maxTheta = Math.PI * 10 + Math.random() * Math.PI * 6;
          reverses = false;
        } else if (spiralType < 0.7) {
          // Partial spiral that reverses direction
          maxTheta = Math.PI * 4 + Math.random() * Math.PI * 3;
          reverses = true;
        } else {
          // Short curve that changes direction frequently
          maxTheta = Math.PI * 2 + Math.random() * Math.PI * 2;
          reverses = true;
        }

        // Calculate unique color index for each spiral arm
        const spiralIndex = i * this.armsPerCenter + arm;
        const colorIndex = spiralIndex % this.palette.length;

        this.spirals.push({
          centerX: centerX,
          centerY: centerY,
          armOffset: armOffset, // Starting angle offset for this arm

          // Archimedean spiral parameters: r = a + b*θ
          a: 20 + Math.random() * 30,      // Larger starting radius
          b: 8 + Math.random() * 12,       // Larger spiral spacing

          // Animation parameters
          theta: 0,
          maxTheta: maxTheta,
          reverses: reverses,
          currentDirection: Math.random() < 0.5 ? 1 : -1,
          baseDirection: Math.random() < 0.5 ? 1 : -1,

          // Visual properties
          colorIndex: colorIndex, // Each arm gets a different color from palette
          strokeWidth: 3 + Math.random() * 4,  // Thicker strokes

          // For smooth color transitions (HSL hue shift)
          hueOffset: 0,
        });
      }
    }

    // Clear canvas
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, width, height);
  }

  updateAudioFeatures() {
    if (!this.analyzer || !this.fftAnalyzer || !this.isPlaying) return;

    const waveform = this.analyzer.getValue();
    const spectrum = this.fftAnalyzer.getValue();
    const bins = spectrum.length;

    const linearSpectrum = spectrum.map(db => Math.pow(10, db / 20));

    const bassEnd = Math.floor(bins * 0.1);
    const midEnd = Math.floor(bins * 0.5);

    this.audioFeatures.bass = this.average(linearSpectrum.slice(0, bassEnd));
    this.audioFeatures.mid = this.average(linearSpectrum.slice(bassEnd, midEnd));
    this.audioFeatures.high = this.average(linearSpectrum.slice(midEnd));

    const sumSquares = waveform.reduce((sum, val) => sum + val * val, 0);
    this.audioFeatures.rms = Math.sqrt(sumSquares / waveform.length);

    this.audioFeatures.spectrum = linearSpectrum;

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
        <div class="info-value">${(this.audioFeatures.bass * 100).toFixed(1)}%</div>
      </div>
      <div class="info-item">
        <div class="info-label">Mid</div>
        <div class="info-value">${(this.audioFeatures.mid * 100).toFixed(1)}%</div>
      </div>
      <div class="info-item">
        <div class="info-label">High</div>
        <div class="info-value">${(this.audioFeatures.high * 100).toFixed(1)}%</div>
      </div>
      <div class="info-item">
        <div class="info-label">Energy</div>
        <div class="info-value">${(this.audioFeatures.rms * 100).toFixed(1)}%</div>
      </div>
    `;
  }

  resetAudioFeatures() {
    this.audioFeatures.bass = 0;
    this.audioFeatures.mid = 0;
    this.audioFeatures.high = 0;
    this.audioFeatures.rms = 0;
    this.updateAudioInfoDisplay();
  }

  update() {
    if (!this.isPlaying) return; // PURE AUDIO REACTIVE

    this.updateAudioFeatures();

    // Update spiral theta based on audio - AMPLIFIED response
    for (const spiral of this.spirals) {
      // MUCH MORE DRAMATIC audio response
      const growthSpeed = 0.08 + this.audioFeatures.mid * 1.2 + this.audioFeatures.high * 2.0;

      spiral.theta += growthSpeed * spiral.currentDirection;

      // Handle reversals and bounds
      if (spiral.reverses) {
        // Reverse direction at bounds
        if (spiral.theta >= spiral.maxTheta) {
          spiral.currentDirection = -1;
        } else if (spiral.theta <= 0) {
          spiral.currentDirection = 1;
        }
      } else {
        // Complete spirals loop back
        if (spiral.theta > spiral.maxTheta) {
          spiral.theta = 0;
        } else if (spiral.theta < 0) {
          spiral.theta = spiral.maxTheta;
        }
      }

      // Dramatic hue shift based on bass
      spiral.hueOffset += this.audioFeatures.bass * 5 + this.audioFeatures.mid * 2;
    }
  }

  // Generate Archimedean spiral points: r = a + b*θ
  getSpiralPoint(spiral, theta) {
    const r = spiral.a + spiral.b * theta;
    // Add arm offset so each arm starts at different angle
    const adjustedTheta = theta + spiral.armOffset;
    const x = spiral.centerX + r * Math.cos(adjustedTheta);
    const y = spiral.centerY + r * Math.sin(adjustedTheta);
    return { x, y, r };
  }

  // Calculate tangent vector at a point on the spiral (for bezier control points)
  getSpiralTangent(spiral, theta) {
    // Derivative of Archimedean spiral in polar coords
    // dx/dθ = b*cos(θ) - (a + b*θ)*sin(θ)
    // dy/dθ = b*sin(θ) + (a + b*θ)*cos(θ)

    const adjustedTheta = theta + spiral.armOffset;
    const r = spiral.a + spiral.b * theta;
    const dx = spiral.b * Math.cos(adjustedTheta) - r * Math.sin(adjustedTheta);
    const dy = spiral.b * Math.sin(adjustedTheta) + r * Math.cos(adjustedTheta);

    // Normalize
    const mag = Math.sqrt(dx * dx + dy * dy);
    return { dx: dx / mag, dy: dy / mag };
  }

  draw() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Slower fade for longer trails
    this.ctx.fillStyle = 'rgba(10, 10, 10, 0.04)';
    this.ctx.fillRect(0, 0, width, height);

    // Draw each spiral using continuous bezier curves
    for (const spiral of this.spirals) {
      if (Math.abs(spiral.theta) < 0.1) continue;

      const baseColor = this.palette[spiral.colorIndex];

      // Smooth HSL color transition
      const hue = (baseColor.h + spiral.hueOffset) % 360;
      const sat = baseColor.s;
      const lit = baseColor.l;

      // DRAMATIC glow based on audio - much more pronounced
      const glowAmount = 15 + this.audioFeatures.rms * 40 + this.audioFeatures.high * 60;
      this.ctx.shadowBlur = glowAmount;
      this.ctx.shadowColor = `hsla(${hue}, ${sat}%, ${lit}%, 0.8)`;

      // Draw spiral as smooth bezier curve with audio-reactive opacity
      const alpha = 0.6 + this.audioFeatures.mid * 0.3 + this.audioFeatures.high * 0.1;
      this.ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${alpha})`;

      // Much more dramatic width pulsing
      this.ctx.lineWidth = spiral.strokeWidth * (1 + this.audioFeatures.bass * 3 + this.audioFeatures.rms * 2);
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.beginPath();

      // Start point
      const startPoint = this.getSpiralPoint(spiral, 0);
      this.ctx.moveTo(startPoint.x, startPoint.y);

      // Draw spiral using cubic bezier curves
      // Divide theta range into segments for bezier approximation
      const segments = Math.max(20, Math.floor(Math.abs(spiral.theta) / (Math.PI / 4)));
      const dTheta = spiral.theta / segments;

      for (let i = 0; i < segments; i++) {
        const t1 = i * dTheta;
        const t2 = (i + 1) * dTheta;

        const p1 = this.getSpiralPoint(spiral, t1);
        const p2 = this.getSpiralPoint(spiral, t2);

        // Get tangent vectors for control points
        const tan1 = this.getSpiralTangent(spiral, t1);
        const tan2 = this.getSpiralTangent(spiral, t2);

        // Control points along tangent direction
        // Distance proportional to segment length for smooth curves
        const controlDist = Math.abs(dTheta) * spiral.b * 0.5;

        const cp1x = p1.x + tan1.dx * controlDist;
        const cp1y = p1.y + tan1.dy * controlDist;
        const cp2x = p2.x - tan2.dx * controlDist;
        const cp2y = p2.y - tan2.dy * controlDist;

        // Draw cubic bezier curve segment
        this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }

      this.ctx.stroke();

      // Draw VERY bright head at current position - highly responsive
      const headPoint = this.getSpiralPoint(spiral, spiral.theta);
      this.ctx.shadowBlur = glowAmount * 2.5;

      // Pulsing head size based on audio
      const headSize = spiral.strokeWidth * (3 + this.audioFeatures.bass * 4 + this.audioFeatures.high * 3);

      this.ctx.fillStyle = `hsla(${hue}, ${sat}%, ${Math.min(100, lit + 40)}%, 0.95)`;
      this.ctx.beginPath();
      this.ctx.arc(headPoint.x, headPoint.y, headSize, 0, Math.PI * 2);
      this.ctx.fill();
    }

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
new FlowingSpirals(canvas, ctx);
