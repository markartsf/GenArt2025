import { TempoAnalyzer, AestheticState } from '../aestheticSystem-v3.js';

class TrailDot {
  constructor(x, y, colorIndex, size) {
    this.x = x;
    this.y = y;
    this.colorIndex = colorIndex;
    this.size = size;
    this.life = 1;
    this.maxLife = 1;
  }

  update() {
    // Very slow decay for long exposure effect
    this.life -= 0.0008;
  }

  draw(ctx, aesthetic) {
    if (this.life <= 0) return;

    const alpha = this.life * 0.8;
    const color = aesthetic.getColor(this.colorIndex, alpha);

    ctx.fillStyle = color;

    // Heavy bloom/glow for open aperture effect
    const glowSize = this.size * (1 + (1 - this.life) * 0.5);
    ctx.shadowBlur = 20 + glowSize * 2;
    ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.7);

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  isDead() {
    return this.life <= 0;
  }
}

class SteppedLightSource {
  constructor(x, y, width, height, frequencyBand, aesthetic) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.frequencyBand = frequencyBand; // 'bass', 'mid', 'high'

    // Motion parameters - based on frequency
    if (frequencyBand === 'bass') {
      this.colorIndex = 5; // Warm yellows/oranges
      this.stepInterval = 6; // Move every 6 frames (slow, like highway)
      this.stepDistance = 15; // Larger steps
      this.dotSize = 12;
    } else if (frequencyBand === 'mid') {
      this.colorIndex = 1; // Blues/cyans
      this.stepInterval = 4; // Medium speed
      this.stepDistance = 10;
      this.dotSize = 8;
    } else {
      this.colorIndex = 3; // Reds/magentas
      this.stepInterval = 2; // Fast (thin erratic trails)
      this.stepDistance = 8;
      this.dotSize = 5;
    }

    this.framesSinceStep = 0;

    // Random direction
    this.angle = Math.random() * Math.PI * 2;

    // Trail dots left behind
    this.trailDots = [];

    this.life = 1;
  }

  update(audioFeatures, aesthetic) {
    this.framesSinceStep++;

    // Get energy for this frequency band
    let energy = 0;
    if (this.frequencyBand === 'bass') {
      energy = audioFeatures.bass;
    } else if (this.frequencyBand === 'mid') {
      energy = audioFeatures.mid;
    } else {
      energy = audioFeatures.high;
    }

    // Only move on step intervals (creates discrete motion)
    if (this.framesSinceStep >= this.stepInterval) {
      this.framesSinceStep = 0;

      // Leave a dot at current position
      const dotSize = this.dotSize * (0.7 + energy * 0.6);
      this.trailDots.push(new TrailDot(this.x, this.y, this.colorIndex, dotSize));

      // Move to next position
      const distance = this.stepDistance * (0.8 + energy * 0.7);

      // Smooth curves in motion
      this.angle += (Math.random() - 0.5) * 0.3;

      this.x += Math.cos(this.angle) * distance;
      this.y += Math.sin(this.angle) * distance;

      // Wrap around edges
      if (this.x < 0) this.x = this.width;
      if (this.x > this.width) this.x = 0;
      if (this.y < 0) this.y = this.height;
      if (this.y > this.height) this.y = 0;
    }

    // Update trail dots
    for (let i = this.trailDots.length - 1; i >= 0; i--) {
      this.trailDots[i].update();
      if (this.trailDots[i].isDead()) {
        this.trailDots.splice(i, 1);
      }
    }

    // Very slow life decay
    this.life -= 0.0002;
  }

  draw(ctx, aesthetic, audioFeatures) {
    // Draw all trail dots
    for (const dot of this.trailDots) {
      dot.draw(ctx, aesthetic);
    }

    // Draw current position (brighter)
    let energy = 0;
    if (this.frequencyBand === 'bass') {
      energy = audioFeatures.bass;
    } else if (this.frequencyBand === 'mid') {
      energy = audioFeatures.mid;
    } else {
      energy = audioFeatures.high;
    }

    const currentSize = this.dotSize * (1 + energy);
    const color = aesthetic.getColor(this.colorIndex, 0.95);

    ctx.fillStyle = color;
    ctx.shadowBlur = 30 + energy * 40;
    ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.9);

    ctx.beginPath();
    ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  isDead() {
    return this.life <= 0;
  }

  getTotalDots() {
    return this.trailDots.length;
  }
}

export class LightTrailsStepped {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.lightSources = [];

    // V3 systems
    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();

    this.initializeLights();
  }

  initializeLights() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.lightSources = [];

    // Create initial light sources - emphasis on bass (like highway lights)
    const bands = ['bass', 'bass', 'bass', 'bass', 'mid', 'mid', 'high', 'high'];

    for (let i = 0; i < bands.length; i++) {
      this.lightSources.push(new SteppedLightSource(
        Math.random() * width,
        Math.random() * height,
        width,
        height,
        bands[i],
        this.aesthetic.current
      ));
    }
  }

  reset() {
    this.initializeLights();
    this.tempoAnalyzer.reset();
    this.aesthetic.reset();
  }

  draw(audioFeatures) {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Analyze tempo
    const bpm = this.tempoAnalyzer.analyze(audioFeatures);

    // Update aesthetic state
    this.aesthetic.updateTempo(bpm);
    this.aesthetic.update(this.tempoAnalyzer);

    // VERY slow fade for long exposure accumulation
    this.ctx.fillStyle = `rgba(26, 10, 10, 0.005)`;
    this.ctx.fillRect(0, 0, width, height);

    // Update and draw light sources
    for (let i = this.lightSources.length - 1; i >= 0; i--) {
      const light = this.lightSources[i];
      light.update(audioFeatures, this.aesthetic.current);
      light.draw(this.ctx, this.aesthetic, audioFeatures);

      if (light.isDead()) {
        this.lightSources.splice(i, 1);
      }
    }

    // Add new lights on transient bursts
    if (this.aesthetic.transientBurst > 0.6 && this.lightSources.length < 15) {
      const bands = ['bass', 'mid', 'high'];
      const randomBand = bands[Math.floor(Math.random() * bands.length)];

      this.lightSources.push(new SteppedLightSource(
        Math.random() * width,
        Math.random() * height,
        width,
        height,
        randomBand,
        this.aesthetic.current
      ));
    }

    // Maintain minimum number of lights
    const minLights = 6 + Math.floor(this.aesthetic.current.density * 4);
    while (this.lightSources.length < minLights) {
      const bands = ['bass', 'mid', 'high'];
      const randomBand = bands[Math.floor(Math.random() * bands.length)];

      this.lightSources.push(new SteppedLightSource(
        Math.random() * width,
        Math.random() * height,
        width,
        height,
        randomBand,
        this.aesthetic.current
      ));
    }

    // Count total trail dots across all sources
    const totalDots = this.lightSources.reduce((sum, light) => sum + light.getTotalDots(), 0);

    // Debug info
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
    this.ctx.font = '12px monospace';
    const label = `Tempo: ${bpm.toFixed(0)} BPM | Light Sources: ${this.lightSources.length} | Trail Dots: ${totalDots} | ${this.getAestheticLabel(bpm)}`;
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
