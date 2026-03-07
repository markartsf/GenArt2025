import { TempoAnalyzer, AestheticState } from '../aestheticSystem-v3.js';

class BeatPulse {
  constructor(x, y, size, colorIndex, energy) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.maxSize = size;
    this.colorIndex = colorIndex;
    this.energy = energy;
    this.life = 1;

    // Pulse grows outward
    this.currentSize = 0;
    this.growthRate = size * 0.15;
  }

  update() {
    this.currentSize += this.growthRate;
    this.life = 1 - (this.currentSize / this.maxSize);
  }

  draw(ctx, aesthetic) {
    if (this.life <= 0) return;

    const alpha = this.life * 0.7;
    const color = aesthetic.getColor(this.colorIndex, alpha);

    ctx.strokeStyle = color;
    ctx.lineWidth = 3 + this.energy * 8;
    ctx.lineCap = 'round';

    // Glow
    ctx.shadowBlur = 15 + this.energy * 30;
    ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.6);

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.currentSize, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  isDead() {
    return this.life <= 0;
  }
}

export class RhythmGrid {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // V3 systems
    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();

    // Beat detection
    this.lastBeatTime = 0;
    this.beatInterval = 500; // milliseconds
    this.beatThreshold = 0.3;

    // Visual elements
    this.pulses = [];
    this.gridPoints = [];

    // Energy history for beat detection
    this.energyHistory = [];
    this.maxHistory = 10;

    this.initializeGrid();
  }

  initializeGrid() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.gridPoints = [];

    // Create grid points
    const cols = 8;
    const rows = 6;
    const spacingX = width / (cols + 1);
    const spacingY = height / (rows + 1);

    for (let i = 1; i <= cols; i++) {
      for (let j = 1; j <= rows; j++) {
        this.gridPoints.push({
          x: i * spacingX,
          y: j * spacingY,
          baseSize: 40 + Math.random() * 40
        });
      }
    }
  }

  reset() {
    this.pulses = [];
    this.energyHistory = [];
    this.lastBeatTime = 0;
    this.initializeGrid();
    this.tempoAnalyzer.reset();
    this.aesthetic.reset();
  }

  detectBeat(audioFeatures) {
    const now = Date.now();

    // Calculate total energy
    const energy = (audioFeatures.bass * 2 + audioFeatures.mid + audioFeatures.high) / 4;

    this.energyHistory.push(energy);
    if (this.energyHistory.length > this.maxHistory) {
      this.energyHistory.shift();
    }

    if (this.energyHistory.length < this.maxHistory) return false;

    // Beat detected if current energy is significantly higher than average
    const avgEnergy = this.energyHistory.slice(0, -1).reduce((a, b) => a + b, 0) / (this.maxHistory - 1);
    const isBeat = energy > avgEnergy * 1.5 && energy > this.beatThreshold;

    // Throttle beat detection
    if (isBeat && (now - this.lastBeatTime) > this.beatInterval) {
      this.lastBeatTime = now;
      return true;
    }

    return false;
  }

  draw(audioFeatures) {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Analyze tempo
    const bpm = this.tempoAnalyzer.analyze(audioFeatures);

    // Update aesthetic state
    this.aesthetic.updateTempo(bpm);
    this.aesthetic.update(this.tempoAnalyzer);

    // Update beat interval based on detected BPM
    if (bpm > 0) {
      this.beatInterval = (60000 / bpm) * 0.8; // Slightly faster for responsiveness
    }

    // Fade background
    this.ctx.fillStyle = `rgba(26, 10, 10, 0.15)`;
    this.ctx.fillRect(0, 0, width, height);

    // Detect beat
    const isBeat = this.detectBeat(audioFeatures);

    // On beat, create pulses at grid points
    if (isBeat || this.aesthetic.transientBurst > 0.6) {
      const energy = (audioFeatures.bass * 2 + audioFeatures.mid + audioFeatures.high) / 4;

      // Create pulse at random grid points
      const numPulses = Math.floor(2 + energy * 6);
      for (let i = 0; i < numPulses && i < this.gridPoints.length; i++) {
        const point = this.gridPoints[Math.floor(Math.random() * this.gridPoints.length)];
        const colorIndex = Math.floor(Math.random() * 12);

        this.pulses.push(new BeatPulse(
          point.x,
          point.y,
          point.baseSize * (0.8 + energy * 0.7),
          colorIndex,
          energy
        ));
      }
    }

    // Bass creates pulses from center
    if (audioFeatures.bass > 0.4) {
      const colorIndex = 5; // Warm colors
      this.pulses.push(new BeatPulse(
        width / 2,
        height / 2,
        60 + audioFeatures.bass * 100,
        colorIndex,
        audioFeatures.bass
      ));
    }

    // High frequencies create pulses from edges
    if (audioFeatures.high > 0.35) {
      const edge = Math.floor(Math.random() * 4);
      let x, y;

      switch(edge) {
        case 0: x = Math.random() * width; y = 0; break;
        case 1: x = width; y = Math.random() * height; break;
        case 2: x = Math.random() * width; y = height; break;
        case 3: x = 0; y = Math.random() * height; break;
      }

      const colorIndex = 3; // Bright colors
      this.pulses.push(new BeatPulse(
        x, y,
        30 + audioFeatures.high * 60,
        colorIndex,
        audioFeatures.high
      ));
    }

    // Update and draw pulses
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      this.pulses[i].update();
      this.pulses[i].draw(this.ctx, this.aesthetic);

      if (this.pulses[i].isDead()) {
        this.pulses.splice(i, 1);
      }
    }

    // Draw grid points (subtle)
    const totalEnergy = (audioFeatures.bass + audioFeatures.mid + audioFeatures.high) / 3;
    for (const point of this.gridPoints) {
      const alpha = 0.1 + totalEnergy * 0.2;
      this.ctx.fillStyle = this.aesthetic.getColor(0, alpha);
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Debug info
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
    this.ctx.font = '12px monospace';
    const label = `Tempo: ${bpm.toFixed(0)} BPM | Pulses: ${this.pulses.length} | ${this.getAestheticLabel(bpm)}`;
    this.ctx.fillText(label, 10, height - 10);
    this.ctx.restore();
  }

  getAestheticLabel(bpm) {
    if (bpm < 85) return 'Country / Ethereal';
    if (bpm < 100) return 'Countryside';
    if (bpm < 115) return 'Suburban';
    return 'Urban / Vibrant';
  }
}
