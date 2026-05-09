import * as Tone from 'tone';

class StaccatoBeats {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Audio
    this.player = null;
    this.analyzer = null;
    this.fftAnalyzer = null;
    this.isPlaying = false;

    // Pluck detection — EMA-based onset
    this.emaEnergy = 0;
    this.emaAlpha = 0.12;        // EMA tracking speed
    this.pluckThreshold = 1.6;   // current must be this × EMA to trigger
    this.pluckEnergyMin = 0.03;  // minimum absolute energy
    this.lastPluckTime = 0;
    this.pluckCooldown = 90;     // ms

    // Grid of shapes across the full canvas
    this.shapes = [];
    this.numCols = 16;
    this.numRows = 5;

    // Ripple events: when a pluck fires, a ring expands and pops shapes it touches
    this.ripples = [];

    // Slow violin sway phase
    this.violinPhase = 0;

    this.audioFeatures = {
      violin: 0,
      pluck: 0,
      rms: 0,
      pluckDetected: false,
    };

    // Fall palette
    this.palette = [
      { h: 48,  s: 95, l: 60 },
      { h: 355, s: 85, l: 50 },
      { h: 25,  s: 90, l: 55 },
      { h: 0,   s: 80, l: 28 },
      { h: 345, s: 70, l: 25 },
      { h: 15,  s: 65, l: 30 },
      { h: 40,  s: 75, l: 58 },
      { h: 50,  s: 45, l: 65 },
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
    const playPauseBtn   = document.getElementById('playPause');
    const stopBtn        = document.getElementById('stop');
    const resetBtn       = document.getElementById('reset');
    const fullscreenBtn  = document.getElementById('fullscreen');
    const statusText     = document.getElementById('status');

    audioFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      statusText.textContent = 'Loading audio...';
      try {
        if (this.player) { this.player.stop(); this.player.dispose(); }
        const url = URL.createObjectURL(file);
        this.player = new Tone.Player(url).toDestination();
        this.player.volume.value = 0;
        this.player.connect(this.analyzer);
        this.player.connect(this.fftAnalyzer);
        await Tone.loaded();
        playPauseBtn.disabled = false;
        stopBtn.disabled = false;
        statusText.textContent = `✓ Loaded: ${file.name}`;
      } catch (err) {
        statusText.textContent = '✗ Error loading audio';
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

    resetBtn.addEventListener('click', () => this.reset());

    fullscreenBtn.addEventListener('click', () => {
      const container = document.getElementById('container');
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        this.reset();
        statusText.textContent = 'Reset (R)';
      }
    });
  }

  reset() {
    const W = this.canvas.width  / (window.devicePixelRatio || 1);
    const H = this.canvas.height / (window.devicePixelRatio || 1);

    this.shapes = [];
    this.ripples = [];

    const padX  = W * 0.04;
    const padY  = H * 0.10;
    const cellW = (W - padX * 2) / this.numCols;
    const cellH = (H - padY * 2) / this.numRows;

    for (let row = 0; row < this.numRows; row++) {
      for (let col = 0; col < this.numCols; col++) {
        const baseX = padX + col * cellW + cellW * 0.5;
        const baseY = padY + row * cellH + cellH * 0.5;

        // Alternate rows: even = arcs, odd = triangles (with some randomness)
        const type = (row + col) % 3 === 0 ? 'arc' : 'triangle';

        this.shapes.push({
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          type,
          colorIndex:   Math.floor(Math.random() * this.palette.length),
          baseSize:     10 + Math.random() * 12,

          // Spring physics for pop
          scale:        1.0,
          springVel:    0,

          // Sway (violin)
          swayPhase:    Math.random() * Math.PI * 2,
          swayFreq:     0.4 + Math.random() * 0.4,

          // Per-shape orientation (static)
          angle:        Math.random() * Math.PI * 2,

          // Glow energy (fades after pop)
          glow:         0,
        });
      }
    }

    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, W, H);
  }

  // ── Audio analysis ────────────────────────────────────────────────────────

  updateAudioFeatures() {
    if (!this.analyzer || !this.fftAnalyzer || !this.isPlaying) return;

    const waveform  = this.analyzer.getValue();
    const spectrum  = this.fftAnalyzer.getValue();
    const bins      = spectrum.length;
    const nyquist   = 22050;

    const linear  = spectrum.map(db => Math.pow(10, db / 20));
    const ftb     = f => Math.min(bins - 1, Math.floor((f / nyquist) * bins));

    // Violin: 200–800 Hz
    this.audioFeatures.violin =
      this.avg(linear, ftb(200), ftb(800));

    // Pluck synth: 800–3000 Hz  (widened to catch more synth content)
    this.audioFeatures.pluck =
      this.avg(linear, ftb(800), ftb(3000));

    // RMS
    const sumSq = waveform.reduce((s, v) => s + v * v, 0);
    this.audioFeatures.rms = Math.sqrt(sumSq / waveform.length);

    // ── EMA-based onset detection ──────────────────────────────────────────
    // Update exponential moving average of pluck energy
    this.emaEnergy = this.emaAlpha * this.audioFeatures.pluck
                   + (1 - this.emaAlpha) * this.emaEnergy;

    const ratio = this.emaEnergy > 0.001
      ? this.audioFeatures.pluck / this.emaEnergy
      : 0;

    const now = Date.now();
    this.audioFeatures.pluckDetected = false;

    if (ratio > this.pluckThreshold &&
        this.audioFeatures.pluck > this.pluckEnergyMin &&
        (now - this.lastPluckTime) > this.pluckCooldown) {

      this.audioFeatures.pluckDetected = true;
      this.lastPluckTime = now;
      this.spawnRipple();
      console.log(`PLUCK  energy=${this.audioFeatures.pluck.toFixed(3)}  ratio=${ratio.toFixed(2)}`);
    }

    this.updateInfoDisplay();
  }

  avg(arr, from, to) {
    if (to <= from) return 0;
    let sum = 0;
    for (let i = from; i < to; i++) sum += arr[i];
    return sum / (to - from);
  }

  resetAudioFeatures() {
    this.audioFeatures.violin = 0;
    this.audioFeatures.pluck  = 0;
    this.audioFeatures.rms    = 0;
    this.audioFeatures.pluckDetected = false;
    this.emaEnergy = 0;
    this.updateInfoDisplay();
  }

  updateInfoDisplay() {
    const infoDiv = document.getElementById('audio-info');
    const pluckInd = this.audioFeatures.pluckDetected ? '🔴 PLUCK!' : '⚫';
    const ratio = this.emaEnergy > 0.001
      ? (this.audioFeatures.pluck / this.emaEnergy).toFixed(2)
      : '0.00';
    infoDiv.innerHTML = `
      <div class="info-item">
        <div class="info-label">Violin 200–800Hz</div>
        <div class="info-value">${(this.audioFeatures.violin * 100).toFixed(1)}%</div>
      </div>
      <div class="info-item">
        <div class="info-label">Pluck 800–3kHz</div>
        <div class="info-value">${(this.audioFeatures.pluck * 100).toFixed(1)}%</div>
      </div>
      <div class="info-item">
        <div class="info-label">Onset ratio</div>
        <div class="info-value">${ratio}×</div>
      </div>
      <div class="info-item">
        <div class="info-label">Pluck</div>
        <div class="info-value">${pluckInd}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Ripples</div>
        <div class="info-value">${this.ripples.length}</div>
      </div>
    `;
  }

  // ── Ripple spawning ───────────────────────────────────────────────────────

  spawnRipple() {
    const W = this.canvas.width  / (window.devicePixelRatio || 1);
    const H = this.canvas.height / (window.devicePixelRatio || 1);

    // Spawn from random X across the full canvas width, vertically centred
    this.ripples.push({
      x:        W * (0.1 + Math.random() * 0.8),
      y:        H * (0.3 + Math.random() * 0.4),
      radius:   0,
      speed:    350 + Math.random() * 200,  // px/s
      strength: 0.7 + Math.random() * 0.5,
      maxRadius: Math.max(W, H) * 0.8,
      lastTime: performance.now(),
    });
  }

  // ── Update loop ───────────────────────────────────────────────────────────

  update(dt) {
    if (!this.isPlaying) {
      // Still animate sway even when paused (for preview)
      dt = 0;
    }

    this.updateAudioFeatures();

    const t = performance.now() * 0.001;
    const violin = this.audioFeatures.violin;
    const W = this.canvas.width  / (window.devicePixelRatio || 1);

    // Advance ripples
    for (let r = this.ripples.length - 1; r >= 0; r--) {
      const rip = this.ripples[r];
      rip.radius += rip.speed * dt;

      // Check each shape for intersection with ripple ring
      const ringWidth = 30;
      for (const shape of this.shapes) {
        const dx   = shape.x - rip.x;
        const dy   = shape.y - rip.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Did the ripple ring just pass through this shape?
        if (dist >= rip.radius - rip.speed * dt &&
            dist <= rip.radius + ringWidth) {
          // Spring pop: scale up then spring back
          shape.scale     = 1.0 + rip.strength * 2.2;
          shape.springVel = 0;
          shape.glow      = 1.0;
        }
      }

      if (rip.radius > rip.maxRadius) this.ripples.splice(r, 1);
    }

    // Update each shape
    for (const shape of this.shapes) {
      // Spring physics: pull scale back to 1.0
      const spring   = 18;
      const damping  = 0.55;
      const delta    = 1.0 - shape.scale;
      shape.springVel = shape.springVel * damping + delta * spring * dt;
      shape.scale    += shape.springVel;
      shape.scale     = Math.max(0.05, shape.scale);

      // Glow decay
      shape.glow *= 0.88;

      // Sway offset from violin — subtle vertical float
      const swayAmt = violin * 18;
      shape.y = shape.baseY
        + Math.sin(t * shape.swayFreq + shape.swayPhase) * (4 + swayAmt);
    }
  }

  // ── Draw ─────────────────────────────────────────────────────────────────

  draw() {
    const W = this.canvas.width  / (window.devicePixelRatio || 1);
    const H = this.canvas.height / (window.devicePixelRatio || 1);

    // Soft fade for motion blur feel
    this.ctx.fillStyle = 'rgba(10, 10, 10, 0.35)';
    this.ctx.fillRect(0, 0, W, H);

    // Draw ripple rings (subtle)
    for (const rip of this.ripples) {
      const alpha = Math.max(0, 1 - rip.radius / rip.maxRadius) * 0.25;
      this.ctx.strokeStyle = `rgba(200, 160, 100, ${alpha})`;
      this.ctx.lineWidth   = 2;
      this.ctx.shadowBlur  = 0;
      this.ctx.beginPath();
      this.ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Draw shapes
    for (const shape of this.shapes) {
      const pal  = this.palette[shape.colorIndex];
      const s    = shape.scale * shape.baseSize;
      const glow = shape.glow;

      // Hue shift on violin
      const hue  = (pal.h + this.audioFeatures.violin * 25) % 360;
      const lit  = Math.min(95, pal.l + glow * 40);
      const alpha = 0.55 + glow * 0.45;

      this.ctx.shadowBlur  = glow > 0.05 ? 8 + glow * 40 : 0;
      this.ctx.shadowColor = `hsla(${hue}, ${pal.s}%, ${lit}%, ${glow * 0.8})`;
      this.ctx.fillStyle   = `hsla(${hue}, ${pal.s}%, ${lit}%, ${alpha})`;

      this.ctx.save();
      this.ctx.translate(shape.x, shape.y);
      this.ctx.rotate(shape.angle);

      if (shape.type === 'arc') {
        this.drawArc(s);
      } else {
        this.drawTriangle(s);
      }

      this.ctx.restore();
    }

    this.ctx.shadowBlur = 0;
  }

  drawArc(size) {
    // Open arc (270° sweep)
    const startAngle = -Math.PI * 0.2;
    const endAngle   =  Math.PI * 1.8;
    this.ctx.lineWidth  = Math.max(1.5, size * 0.22);
    this.ctx.strokeStyle = this.ctx.fillStyle;
    this.ctx.fillStyle   = 'transparent';

    this.ctx.beginPath();
    this.ctx.arc(0, 0, size, startAngle, endAngle);
    this.ctx.stroke();

    // Restore fill for other shapes
    this.ctx.fillStyle = this.ctx.strokeStyle;
  }

  drawTriangle(size) {
    const h = size * 0.866;
    this.ctx.beginPath();
    this.ctx.moveTo(0,      -size * 0.7);
    this.ctx.lineTo( h * 0.7,  size * 0.45);
    this.ctx.lineTo(-h * 0.7,  size * 0.45);
    this.ctx.closePath();
    this.ctx.fill();
  }

  // ── Main animation loop ───────────────────────────────────────────────────

  animate(timestamp) {
    requestAnimationFrame((ts) => this.animate(ts));

    const dt = Math.min(0.05, ((timestamp || 0) - (this._lastTs || 0)) / 1000);
    this._lastTs = timestamp || 0;

    this.update(dt);
    this.draw();
  }
}

// Init
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
new StaccatoBeats(canvas, ctx);
