import { TempoAnalyzer, AestheticState, OrbitingCamera } from '../aestheticSystem-v3.js';

export class AudioWaveformV3 {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.waveHistory = [];
    this.maxHistory = 60;
    this.mode = 0; // 0: circular, 1: linear, 2: radial spectrum
    this.modeTimer = 0;

    // V3 systems
    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();
    this.camera = new OrbitingCamera();
  }

  reset() {
    this.waveHistory = [];
    this.mode = 0;
    this.modeTimer = 0;
    this.tempoAnalyzer.reset();
    this.aesthetic.reset();
    this.camera.reset();
  }

  draw(audioFeatures) {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Analyze tempo
    const bpm = this.tempoAnalyzer.analyze(audioFeatures);

    // Update aesthetic state
    this.aesthetic.updateTempo(bpm);
    this.aesthetic.update(this.tempoAnalyzer);

    // Update camera
    this.camera.update(this.aesthetic.current);

    // Adaptive fade based on aesthetic
    this.ctx.fillStyle = `rgba(26, 10, 10, ${this.aesthetic.current.trailFade + 0.1})`;
    this.ctx.fillRect(0, 0, width, height);

    // Store waveform in history (more in urban, less in country)
    const historyRate = Math.floor(1 / (0.3 + this.aesthetic.current.speed * 0.7));
    if (this.waveHistory.length === 0 || this.modeTimer % historyRate === 0) {
      this.waveHistory.push([...audioFeatures.waveform]);
      if (this.waveHistory.length > this.maxHistory) {
        this.waveHistory.shift();
      }
    }

    // Change mode based on aesthetic transition
    this.modeTimer++;
    const modeChangeDuration = 400 - (this.aesthetic.current.speed * 200);
    if (this.modeTimer > modeChangeDuration) {
      this.mode = (this.mode + 1) % 3;
      this.modeTimer = 0;
    }

    // Draw based on current mode
    switch (this.mode) {
      case 0:
        this.drawCircularWaveform(audioFeatures, width, height);
        break;
      case 1:
        this.drawLinearWaveform(audioFeatures, width, height);
        break;
      case 2:
        this.drawRadialSpectrum(audioFeatures, width, height);
        break;
    }

    // Debug info
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
    this.ctx.font = '12px monospace';
    const modeNames = ['Circular', 'Linear', 'Radial'];
    const label = `Tempo: ${bpm.toFixed(0)} BPM | Mode: ${modeNames[this.mode]} | ${this.getAestheticLabel(bpm)}`;
    this.ctx.fillText(label, 10, height - 10);
    this.ctx.restore();
  }

  drawCircularWaveform(audioFeatures, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.15;

    // Apply camera orbit
    this.camera.apply(this.ctx, width, height);

    // Draw multiple concentric waveforms from history
    for (let h = 0; h < this.waveHistory.length; h++) {
      const waveform = this.waveHistory[h];
      const historyFactor = h / this.waveHistory.length;
      const radius = baseRadius + (h * 3);

      this.ctx.beginPath();

      for (let i = 0; i < waveform.length; i++) {
        const angle = (i / waveform.length) * Math.PI * 2;
        const amplitude = waveform[i];

        // Subtle amplitude modulation (not reactive pulsing)
        const modulation = 1 + this.aesthetic.current.speed * 1.5;
        const r = radius + (amplitude * 100 * modulation);

        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }

      this.ctx.closePath();

      // Color based on aesthetic warmth
      const colorIndex = Math.floor((historyFactor + this.aesthetic.current.warmth) * 3.5) % 7;
      const alpha = historyFactor * 0.7;
      const color = this.aesthetic.getColor(colorIndex, alpha);

      this.ctx.strokeStyle = color;

      // Line thickness based on aesthetic
      const baseThickness = this.aesthetic.current.lineThickness * 0.2; // Thinner than attractors
      this.ctx.lineWidth = baseThickness;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Glow effects
      let glowAmount = 0;
      if (this.aesthetic.current.speed > 0.6) {
        glowAmount = 10 + (this.aesthetic.current.speed * 15);
      }
      if (this.aesthetic.tempoAccelerationGlow > 0.2) {
        glowAmount += this.aesthetic.tempoAccelerationGlow * 20;
      }
      if (this.aesthetic.transientBurst > 0.4) {
        glowAmount += this.aesthetic.transientBurst * 25;
      }

      if (glowAmount > 0) {
        this.ctx.shadowBlur = glowAmount;
        this.ctx.shadowColor = this.aesthetic.getColor(colorIndex, 0.7);
      }

      this.ctx.stroke();

      // Fill with transparency for the latest ring
      if (h === this.waveHistory.length - 1 && this.aesthetic.current.density > 0.5) {
        this.ctx.fillStyle = this.aesthetic.getColor(colorIndex, alpha * 0.15);
        this.ctx.fill();
      }

      this.ctx.shadowBlur = 0;
    }

    this.camera.restore(this.ctx);
  }

  drawLinearWaveform(audioFeatures, width, height) {
    const waveform = audioFeatures.waveform;
    const centerY = height / 2;
    const step = width / waveform.length;

    this.ctx.save();
    this.ctx.translate(width / 2, height / 2);

    // Draw waveform with multiple layers
    const numLayers = Math.floor(2 + this.aesthetic.current.density * 3);

    for (let layer = 0; layer < numLayers; layer++) {
      this.ctx.beginPath();

      for (let i = 0; i < waveform.length; i++) {
        const x = (i * step) - width / 2;
        const amplitude = waveform[i];

        // Layer modulation (not pulsing)
        const layerMod = 1 + layer * 0.5;
        const modulation = 1 + this.aesthetic.current.speed * 2;
        const y = (amplitude * height * 0.35 * modulation * layerMod);

        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }

      // Color based on layer and aesthetic
      const colorIndex = Math.floor((layer / numLayers) * 7 + this.aesthetic.current.warmth * 2) % 7;
      const alpha = (1 - layer * 0.15) * 0.7;
      const color = this.aesthetic.getColor(colorIndex, alpha);

      this.ctx.strokeStyle = color;

      // Line thickness based on aesthetic
      const baseThickness = this.aesthetic.current.lineThickness * 0.25;
      this.ctx.lineWidth = Math.max(2, baseThickness - layer);
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Glow effects
      let glowAmount = 0;
      if (this.aesthetic.current.speed > 0.6 || audioFeatures.high > 0.3) {
        glowAmount = 15 + (this.aesthetic.current.speed * 20);
      }
      if (this.aesthetic.tempoAccelerationGlow > 0.2) {
        glowAmount += this.aesthetic.tempoAccelerationGlow * 25;
      }
      if (this.aesthetic.transientBurst > 0.4) {
        glowAmount += this.aesthetic.transientBurst * 30;
      }

      if (glowAmount > 0) {
        this.ctx.shadowBlur = glowAmount;
        this.ctx.shadowColor = this.aesthetic.getColor(colorIndex, 0.6);
      }

      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    }

    // Draw mirror reflection
    this.ctx.scale(1, -1);
    this.ctx.globalAlpha = 0.3;

    this.ctx.beginPath();
    for (let i = 0; i < waveform.length; i++) {
      const x = (i * step) - width / 2;
      const amplitude = waveform[i];
      const modulation = 1 + this.aesthetic.current.speed * 2;
      const y = (amplitude * height * 0.35 * modulation);

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    const reflectionColor = this.aesthetic.getColor(0, 0.6);
    this.ctx.strokeStyle = reflectionColor;
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawRadialSpectrum(audioFeatures, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const spectrum = audioFeatures.amplitudeSpectrum;
    const maxRadius = Math.min(width, height) * 0.45;

    // Apply camera orbit
    this.camera.apply(this.ctx, width, height);

    // Draw spectrum as radial bars
    const numBars = Math.min(spectrum.length, 150 + Math.floor(this.aesthetic.current.density * 100));
    const angleStep = (Math.PI * 2) / numBars;

    for (let i = 0; i < numBars; i++) {
      const angle = i * angleStep;
      const magnitude = spectrum[i] || 0;

      // Bar length based on magnitude and aesthetic
      const lengthModulation = 1.5 + this.aesthetic.current.speed * 1.5;
      const barLength = magnitude * maxRadius * lengthModulation;

      // Color based on frequency and aesthetic
      const freqRatio = i / numBars;
      const colorIndex = Math.floor((freqRatio * 5 + this.aesthetic.current.warmth * 2)) % 7;
      const alpha = 0.6 + this.aesthetic.current.density * 0.3;

      const color = this.aesthetic.getColor(colorIndex, alpha);

      // Draw bar from center outward
      const startRadius = maxRadius * 0.15;
      const startX = Math.cos(angle) * startRadius;
      const startY = Math.sin(angle) * startRadius;
      const endX = Math.cos(angle) * (startRadius + barLength);
      const endY = Math.sin(angle) * (startRadius + barLength);

      this.ctx.strokeStyle = color;

      // Bar thickness based on aesthetic
      const barThickness = 2 + (this.aesthetic.current.lineThickness * 0.15);
      this.ctx.lineWidth = barThickness;
      this.ctx.lineCap = 'round';

      // Glow for high energy bars
      let glowAmount = 0;
      if (magnitude > 0.15) {
        glowAmount = 20 * magnitude + (this.aesthetic.current.speed * 15);
      }
      if (this.aesthetic.tempoAccelerationGlow > 0.2 && magnitude > 0.1) {
        glowAmount += this.aesthetic.tempoAccelerationGlow * 20;
      }
      if (this.aesthetic.transientBurst > 0.4) {
        glowAmount += this.aesthetic.transientBurst * 25;
      }

      if (glowAmount > 0) {
        this.ctx.shadowBlur = glowAmount;
        this.ctx.shadowColor = this.aesthetic.getColor(colorIndex, 0.7);
      }

      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();

      this.ctx.shadowBlur = 0;
    }

    // Draw center circle based on aesthetic (not reactive pulsing)
    const centerRadius = 25 + (this.aesthetic.current.speed * 60);
    const centerColorIndex = Math.floor(this.aesthetic.current.warmth * 7);

    const centerColor = this.aesthetic.getColor(centerColorIndex, 0.6);
    this.ctx.fillStyle = centerColor;

    let centerGlow = 20 + (this.aesthetic.current.speed * 30);
    if (this.aesthetic.transientBurst > 0.4) {
      centerGlow += this.aesthetic.transientBurst * 40;
    }

    this.ctx.shadowBlur = centerGlow;
    this.ctx.shadowColor = this.aesthetic.getColor(centerColorIndex, 0.7);

    this.ctx.beginPath();
    this.ctx.arc(0, 0, centerRadius, 0, Math.PI * 2);
    this.ctx.fill();

    const strokeColor = this.aesthetic.getColor(centerColorIndex, 0.9);
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 2 + (this.aesthetic.current.lineThickness * 0.1);
    this.ctx.stroke();

    this.ctx.shadowBlur = 0;

    this.camera.restore(this.ctx);
  }

  getAestheticLabel(bpm) {
    if (bpm < 85) return 'Country / Ethereal';
    if (bpm < 100) return 'Countryside';
    if (bpm < 115) return 'Suburban';
    return 'Urban / Vibrant';
  }
}
