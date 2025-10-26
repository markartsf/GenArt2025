import { TempoAnalyzer, AestheticState } from '../aestheticSystem-v3.js';

class LightBeam {
  constructor(x, y, width, height, type, colorIndex) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type; // 'bass', 'mid', 'high'
    this.colorIndex = colorIndex;

    // Movement properties - LARGE horizontal bias
    this.vx = (Math.random() - 0.5) * 15; // Strong horizontal
    this.vy = (Math.random() - 0.5) * 3;  // Subtle vertical

    // Ensure strong horizontal movement
    if (Math.abs(this.vx) < 5) {
      this.vx = Math.random() > 0.5 ? 8 : -8;
    }

    // Trail properties
    this.trailLength = 40 + Math.random() * 30; // Long trails
    this.trail = [];

    // Visual properties
    this.thickness = 8 + Math.random() * 12; // 8-20px thick
    this.brightness = 0.6 + Math.random() * 0.4;

    // Strobing (for segmented trails)
    this.strobeInterval = Math.random() > 0.7 ? Math.floor(3 + Math.random() * 4) : 0;
    this.strobeCounter = 0;
    this.isVisible = true;
  }

  update(audioFeatures, aesthetic) {
    // Audio-driven behavior based on type
    let speedMultiplier = 1;

    switch(this.type) {
      case 'bass':
        // Red/magenta - fast horizontal sweeps
        speedMultiplier = 1 + audioFeatures.bass * 2;
        // Add some waviness
        this.vy += Math.sin(Date.now() * 0.001) * 0.1;
        break;

      case 'mid':
        // Blue/cyan - curved looping paths
        speedMultiplier = 0.8 + audioFeatures.mid * 1.5;
        // More vertical variation for curves
        this.vy += (Math.random() - 0.5) * audioFeatures.mid * 0.5;
        break;

      case 'high':
        // Yellow/white - very fast, bright
        speedMultiplier = 1.5 + audioFeatures.high * 3;
        this.brightness = 0.8 + audioFeatures.high * 0.2;
        break;
    }

    // Tempo affects overall speed
    const tempoMultiplier = aesthetic.current.speed;

    // Update position
    this.x += this.vx * speedMultiplier * tempoMultiplier;
    this.y += this.vy * speedMultiplier * tempoMultiplier;

    // Subtle drift to create curves
    this.vx += (Math.random() - 0.5) * 0.1;
    this.vy += (Math.random() - 0.5) * 0.1;

    // Maintain horizontal bias
    if (Math.abs(this.vx) < 3) {
      this.vx += this.vx > 0 ? 0.2 : -0.2;
    }

    // Wrap around screen
    if (this.x < -100) this.x = this.width + 100;
    if (this.x > this.width + 100) this.x = -100;
    if (this.y < -100) this.y = this.height + 100;
    if (this.y > this.height + 100) this.y = -100;

    // Strobe effect for segmented trails
    if (this.strobeInterval > 0) {
      this.strobeCounter++;
      if (this.strobeCounter >= this.strobeInterval) {
        this.isVisible = !this.isVisible;
        this.strobeCounter = 0;
      }
    }

    // Update trail (only when visible)
    if (this.isVisible) {
      this.trail.push({ x: this.x, y: this.y, brightness: this.brightness });
      if (this.trail.length > this.trailLength) {
        this.trail.shift();
      }
    }
  }

  draw(ctx, aesthetic) {
    if (this.trail.length < 2) return;

    // Draw thick ribbon trail with additive blending
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw trail segments
    for (let i = 1; i < this.trail.length; i++) {
      const point = this.trail[i];
      const prevPoint = this.trail[i - 1];

      // Fade trail from back to front
      const alpha = (i / this.trail.length) * this.brightness;
      const thickness = this.thickness * (0.5 + (i / this.trail.length) * 0.5);

      // Get color based on type
      const color = aesthetic.getColor(this.colorIndex, alpha);

      // Draw with glow
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.shadowBlur = 15 + this.brightness * 25;
      ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.8);

      ctx.beginPath();
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    // Draw bright head/core
    if (this.isVisible) {
      const lastPoint = this.trail[this.trail.length - 1];
      ctx.fillStyle = aesthetic.getColor(this.colorIndex, this.brightness);
      ctx.shadowBlur = 30 + this.brightness * 40;
      ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.9);

      ctx.beginPath();
      ctx.arc(lastPoint.x, lastPoint.y, this.thickness * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
  }
}

export class LongExposureBeams {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // V3 systems
    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();

    // Light beams
    this.beams = [];

    this.initialize();
  }

  initialize() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.beams = [];

    // Create 30-40 light beams with variety
    const numBeams = 30 + Math.floor(Math.random() * 10);

    for (let i = 0; i < numBeams; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;

      // Distribute types: more bass/mid, fewer high (high is very bright)
      let type, colorIndex;
      const rand = Math.random();

      if (rand < 0.4) {
        // Bass - reds/magentas
        type = 'bass';
        colorIndex = [1, 2, 3, 8].at(Math.floor(Math.random() * 4)); // reds, oranges
      } else if (rand < 0.75) {
        // Mid - blues/cyans
        type = 'mid';
        colorIndex = [5, 6, 7].at(Math.floor(Math.random() * 3)); // violets, purples
      } else {
        // High - yellows/whites
        type = 'high';
        colorIndex = [0, 10].at(Math.floor(Math.random() * 2)); // bright yellows
      }

      this.beams.push(new LightBeam(x, y, width, height, type, colorIndex));
    }
  }

  reset() {
    this.initialize();
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

    // VERY slow fade for long exposure effect
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = `rgba(26, 10, 10, 0.01)`; // Almost no fade
    this.ctx.fillRect(0, 0, width, height);

    // Update and draw all beams
    for (const beam of this.beams) {
      beam.update(audioFeatures, this.aesthetic);
      beam.draw(this.ctx, this.aesthetic);
    }

    // Debug info
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
    this.ctx.font = '12px monospace';
    const label = `Tempo: ${bpm.toFixed(0)} BPM | Beams: ${this.beams.length} | ${this.getAestheticLabel(bpm)}`;
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
