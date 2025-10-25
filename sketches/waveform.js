import { FallColors, Camera } from '../colorPalette.js';

export class AudioWaveform {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.waveHistory = [];
    this.maxHistory = 60;
    this.mode = 0; // 0: circular, 1: linear, 2: radial spectrum
    this.modeTimer = 0;
    this.camera = new Camera();
  }

  reset() {
    this.waveHistory = [];
    this.mode = 0;
    this.modeTimer = 0;
    this.camera.reset();
  }

  draw(audioFeatures) {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Clear with fall background fade
    this.ctx.fillStyle = 'rgba(26, 10, 10, 0.18)';
    this.ctx.fillRect(0, 0, width, height);

    // Store waveform in history
    this.waveHistory.push([...audioFeatures.waveform]);
    if (this.waveHistory.length > this.maxHistory) {
      this.waveHistory.shift();
    }

    // Change mode based on spectral centroid
    this.modeTimer++;
    if (this.modeTimer > 300 || audioFeatures.bass > 0.5) {
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
  }

  drawCircularWaveform(audioFeatures, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.15;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);

    // Draw multiple concentric waveforms from history
    for (let h = 0; h < this.waveHistory.length; h++) {
      const waveform = this.waveHistory[h];
      const historyFactor = h / this.waveHistory.length;
      const radius = baseRadius + (h * 4);

      this.ctx.beginPath();

      for (let i = 0; i < waveform.length; i++) {
        const angle = (i / waveform.length) * Math.PI * 2;
        const amplitude = waveform[i];

        // More dramatic audio-reactive radius modulation
        const bassBoost = 1 + audioFeatures.bass * 3.5;
        const r = radius + (amplitude * 150 * bassBoost);

        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }

      this.ctx.closePath();

      // Fall colors based on history position
      const colorIndex = Math.floor(historyFactor * FallColors.palette.length);
      const alpha = historyFactor * (0.5 + audioFeatures.rms * 0.5);
      const color = FallColors.getAudioColor(colorIndex, audioFeatures, alpha);

      this.ctx.strokeStyle = color;

      // Much thicker lines
      this.ctx.lineWidth = 3 + audioFeatures.bass * 8;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Add glow
      if (audioFeatures.bass > 0.2 || audioFeatures.high > 0.2) {
        this.ctx.shadowBlur = 15 + audioFeatures.bass * 35;
        this.ctx.shadowColor = FallColors.getGlowColor(colorIndex, Math.max(audioFeatures.bass, audioFeatures.high));
      }

      this.ctx.stroke();

      // Fill with transparency for the latest ring
      if (h === this.waveHistory.length - 1) {
        this.ctx.fillStyle = FallColors.getAudioColor(colorIndex, audioFeatures, alpha * 0.15);
        this.ctx.fill();
      }

      this.ctx.shadowBlur = 0;
    }

    this.ctx.restore();
  }

  drawLinearWaveform(audioFeatures, width, height) {
    const waveform = audioFeatures.waveform;
    const centerY = height / 2;
    const step = width / waveform.length;

    // Draw waveform with multiple layers - more dramatic
    for (let layer = 0; layer < 4; layer++) {
      this.ctx.beginPath();

      for (let i = 0; i < waveform.length; i++) {
        const x = i * step;
        const amplitude = waveform[i];

        // Different amplitude modulation per layer - more pronounced
        const layerMod = 1 + layer * 0.7;
        const bassBoost = 1 + audioFeatures.bass * 5;
        const y = centerY + (amplitude * height * 0.45 * bassBoost * layerMod);

        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }

      // Fall colors based on layer
      const colorIndex = (layer * 2) % FallColors.palette.length;
      const alpha = (1 - layer * 0.2) * (0.6 + audioFeatures.rms * 0.4);
      const color = FallColors.getAudioColor(colorIndex, audioFeatures, alpha);

      this.ctx.strokeStyle = color;

      // Much thicker lines
      this.ctx.lineWidth = 4 + audioFeatures.bass * 8 - layer;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Dramatic glow effect
      if (audioFeatures.high > 0.15 || audioFeatures.bass > 0.2) {
        this.ctx.shadowBlur = 20 + audioFeatures.high * 40;
        this.ctx.shadowColor = FallColors.getGlowColor(colorIndex, Math.max(audioFeatures.high, audioFeatures.bass));
      }

      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    }

    // Draw mirror reflection with fall colors
    this.ctx.save();
    this.ctx.scale(1, -1);
    this.ctx.translate(0, -height);
    this.ctx.globalAlpha = 0.4;

    this.ctx.beginPath();
    for (let i = 0; i < waveform.length; i++) {
      const x = i * step;
      const amplitude = waveform[i];
      const bassBoost = 1 + audioFeatures.bass * 5;
      const y = centerY + (amplitude * height * 0.45 * bassBoost);

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    const reflectionColor = FallColors.getColor(0, 0.6);
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

    this.ctx.save();
    this.ctx.translate(centerX, centerY);

    // Draw spectrum as radial bars - more dramatic
    const numBars = Math.min(spectrum.length, 200);
    const angleStep = (Math.PI * 2) / numBars;

    for (let i = 0; i < numBars; i++) {
      const angle = i * angleStep;
      const magnitude = spectrum[i] || 0;

      // More dramatic audio-reactive bar length
      const barLength = magnitude * maxRadius * 3;

      // Fall colors based on frequency
      const freqRatio = i / numBars;
      const colorIndex = Math.floor(freqRatio * FallColors.palette.length);
      const alpha = 0.7 + audioFeatures.rms * 0.3;

      const color = FallColors.getSpectralColor(freqRatio, audioFeatures, alpha);

      // Draw bar from center outward
      const startRadius = maxRadius * 0.15;
      const startX = Math.cos(angle) * startRadius;
      const startY = Math.sin(angle) * startRadius;
      const endX = Math.cos(angle) * (startRadius + barLength);
      const endY = Math.sin(angle) * (startRadius + barLength);

      this.ctx.strokeStyle = color;

      // Much thicker bars
      this.ctx.lineWidth = 4 + audioFeatures.bass * 6;
      this.ctx.lineCap = 'round';

      // Dramatic glow for high energy bars
      if (magnitude > 0.2) {
        this.ctx.shadowBlur = 25 * magnitude + audioFeatures.bass * 20;
        this.ctx.shadowColor = FallColors.getGlowColor(colorIndex, magnitude);
      }

      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();

      this.ctx.shadowBlur = 0;
    }

    // Draw center circle pulsing with bass - fall colored
    const centerRadius = 30 + audioFeatures.bass * 80;
    const centerColorIndex = Math.floor((audioFeatures.spectralCentroid / 100) % FallColors.palette.length);

    const centerColor = FallColors.getAudioColor(centerColorIndex, audioFeatures, 0.6);
    this.ctx.fillStyle = centerColor;

    this.ctx.shadowBlur = 30 + audioFeatures.bass * 40;
    this.ctx.shadowColor = FallColors.getGlowColor(centerColorIndex, audioFeatures.bass);

    this.ctx.beginPath();
    this.ctx.arc(0, 0, centerRadius, 0, Math.PI * 2);
    this.ctx.fill();

    const strokeColor = FallColors.getAudioColor(centerColorIndex, audioFeatures, 0.9);
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 3 + audioFeatures.rms * 5;
    this.ctx.stroke();

    this.ctx.shadowBlur = 0;
    this.ctx.restore();
  }
}
