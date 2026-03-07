import * as Tone from 'tone';

class StarrySwirlField {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Audio
    this.player = null;
    this.analyzer = null;
    this.fftAnalyzer = null;
    this.isPlaying = false;

    // SIMPLIFIED SYSTEM - pure swirls
    this.swirls = [];
    this.streamers = []; // Flowing curved lines
    this.maxStreamers = 150;

    this.audioFeatures = {
      bass: 0,
      mid: 0,
      high: 0,
      rms: 0,
      spectrum: new Array(512).fill(0)
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

    // Keyboard shortcuts
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

    // Create swirl centers
    this.swirls = [];
    const numSwirls = 5 + Math.floor(Math.random() * 3);

    for (let i = 0; i < numSwirls; i++) {
      const x = (Math.random() * 0.6 + 0.2) * width;
      const y = (Math.random() * 0.6 + 0.2) * height;

      this.swirls.push({
        x: x,
        y: y,
        baseX: x, // Original position for drift reference
        baseY: y,
        driftAngle: Math.random() * Math.PI * 2, // For circular drift
        driftSpeed: 0.005 + Math.random() * 0.01, // How fast it drifts
        driftRadius: 30 + Math.random() * 50, // How far it drifts from base
        radius: 150 + Math.random() * 200,
        speed: 0.02 + Math.random() * 0.03, // Angular velocity for streamers
        direction: Math.random() < 0.5 ? 1 : -1
      });
    }

    // Create streamers (flowing curved particles)
    this.streamers = [];
    for (let i = 0; i < this.maxStreamers; i++) {
      this.streamers.push(this.createStreamer(width, height));
    }
  }

  createStreamer(width, height) {
    // Start each streamer orbiting a random swirl
    const swirl = this.swirls[Math.floor(Math.random() * this.swirls.length)];
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * swirl.radius;

    return {
      x: swirl.x + Math.cos(angle) * distance,
      y: swirl.y + Math.sin(angle) * distance,
      angle: angle, // Current orbital angle
      orbitDistance: distance,
      targetDistance: distance, // Target for spiral motion
      swirlIndex: this.swirls.indexOf(swirl),
      points: [], // Trail points
      maxPoints: 20 + Math.floor(Math.random() * 30),
      colorIndex: Math.floor(Math.random() * this.palette.length),
      width: 1.5 + Math.random() * 2.5,
      speed: 1 + Math.random() * 1.5, // Multiplier for rotation speed
      spiralPhase: Math.random() * Math.PI * 2, // For smooth spiral motion
      spiralSpeed: 0.01 + Math.random() * 0.02, // How fast it spirals in/out
      switchTimer: Math.random() * 500 + 200 // Frames until it might switch swirls
    };
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
      <div class="info-item">
        <div class="info-label">Streamers</div>
        <div class="info-value">${this.streamers.length}</div>
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
    if (this.isPlaying) {
      this.updateAudioFeatures();
    }

    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Audio affects swirl speed
    const audioSpeedMult = 1 + this.audioFeatures.rms * 3 + this.audioFeatures.high * 5;

    // UPDATE SWIRL CENTERS - make them drift in slow circles
    for (const swirl of this.swirls) {
      swirl.driftAngle += swirl.driftSpeed * (1 + this.audioFeatures.bass * 0.5);

      // Drift in a slow circle around the base position
      swirl.x = swirl.baseX + Math.cos(swirl.driftAngle) * swirl.driftRadius;
      swirl.y = swirl.baseY + Math.sin(swirl.driftAngle) * swirl.driftRadius;
    }

    // Update streamers - spiral motion
    for (const s of this.streamers) {
      // Occasionally switch to a nearby swirl (creates flowing between swirls)
      s.switchTimer--;
      if (s.switchTimer <= 0 && this.swirls.length > 1) {
        // Find a different swirl (preferably nearby)
        const currentSwirl = this.swirls[s.swirlIndex];
        let closestIndex = s.swirlIndex;
        let closestDist = Infinity;

        for (let i = 0; i < this.swirls.length; i++) {
          if (i === s.swirlIndex) continue;
          const dx = this.swirls[i].x - s.x;
          const dy = this.swirls[i].y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestDist = dist;
            closestIndex = i;
          }
        }

        // 30% chance to switch to the closest swirl
        if (Math.random() < 0.3) {
          s.swirlIndex = closestIndex;
          // Recalculate angle relative to new swirl
          const newSwirl = this.swirls[s.swirlIndex];
          s.angle = Math.atan2(s.y - newSwirl.y, s.x - newSwirl.x);
        }

        s.switchTimer = Math.random() * 500 + 200; // Reset timer
      }

      const swirl = this.swirls[s.swirlIndex];

      // Rotate around swirl center MUCH FASTER
      s.angle += swirl.speed * swirl.direction * s.speed * audioSpeedMult * 3;

      // SPIRAL MOTION: Update spiral phase to oscillate in/out
      s.spiralPhase += s.spiralSpeed * (1 + this.audioFeatures.mid * 2);

      // Calculate spiral target distance (oscillates between 30% and 100% of swirl radius)
      const minDist = swirl.radius * 0.3;
      const maxDist = swirl.radius;
      s.targetDistance = minDist + (maxDist - minDist) * (0.5 + 0.5 * Math.sin(s.spiralPhase));

      // Smoothly interpolate current distance toward target (creates smooth spiral)
      s.orbitDistance += (s.targetDistance - s.orbitDistance) * 0.05;

      // Add bass response (slight pulsing)
      const bassOffset = Math.sin(s.angle * 2) * (1 + this.audioFeatures.bass * 3);
      const finalDistance = s.orbitDistance + bassOffset;

      // Calculate new position (spiral path!)
      s.x = swirl.x + Math.cos(s.angle) * finalDistance;
      s.y = swirl.y + Math.sin(s.angle) * finalDistance;

      // Add point to trail
      s.points.push({ x: s.x, y: s.y });

      // Keep trail short for performance
      if (s.points.length > s.maxPoints) {
        s.points.shift();
      }
    }
  }

  draw() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Slower fade for trails
    this.ctx.fillStyle = 'rgba(10, 10, 10, 0.08)';
    this.ctx.fillRect(0, 0, width, height);

    // Draw streamers
    for (const s of this.streamers) {
      if (s.points.length < 2) continue;

      const color = this.palette[s.colorIndex];

      // Glow
      const glowAmount = 12 + this.audioFeatures.bass * 20 + this.audioFeatures.high * 25;
      this.ctx.shadowBlur = glowAmount;
      this.ctx.shadowColor = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.6)`;

      // Draw smooth curve through points
      this.ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.8)`;
      this.ctx.lineWidth = s.width;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.beginPath();
      this.ctx.moveTo(s.points[0].x, s.points[0].y);

      // Use quadratic curves for smoother lines
      for (let i = 1; i < s.points.length - 1; i++) {
        const xc = (s.points[i].x + s.points[i + 1].x) / 2;
        const yc = (s.points[i].y + s.points[i + 1].y) / 2;
        this.ctx.quadraticCurveTo(s.points[i].x, s.points[i].y, xc, yc);
      }

      // Draw to last point
      if (s.points.length > 1) {
        const last = s.points[s.points.length - 1];
        this.ctx.lineTo(last.x, last.y);
      }

      this.ctx.stroke();

      // Bright head
      this.ctx.shadowBlur = glowAmount * 2;
      this.ctx.fillStyle = `hsla(${color.h}, ${color.s}%, ${Math.min(100, color.l + 25)}%, 1.0)`;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.width * 2, 0, Math.PI * 2);
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
new StarrySwirlField(canvas, ctx);
