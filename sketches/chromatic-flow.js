import { TempoAnalyzer, AestheticState } from '../aestheticSystem-v3.js';

class FlowRibbon {
  constructor(yPosition, colorIndex, frequencyBand, aesthetic) {
    this.baseY = yPosition;
    this.colorIndex = colorIndex;
    this.frequencyBand = frequencyBand; // 'bass', 'mid', 'high'
    this.phase = Math.random() * Math.PI * 2;
    this.life = 1;
    this.opacity = 0.7;

    // Wave parameters
    this.wavelength = 100 + Math.random() * 200;
    this.amplitude = 30 + Math.random() * 50;
    this.speed = (Math.random() - 0.5) * 0.02;

    // Thickness based on frequency
    this.baseThickness = frequencyBand === 'bass' ? 40 :
                        frequencyBand === 'mid' ? 25 : 15;

    this.trail = [];
    this.maxTrailPoints = 200; // Many points for smooth curves
  }

  update(audioFeatures, aesthetic, time) {
    // Get energy for this frequency band
    let energy = 0;
    if (this.frequencyBand === 'bass') {
      energy = audioFeatures.bass;
    } else if (this.frequencyBand === 'mid') {
      energy = audioFeatures.mid;
    } else {
      energy = audioFeatures.high;
    }

    // Audio affects wave parameters
    this.amplitude = (30 + energy * 80) * (1 + aesthetic.speed * 0.5);
    this.wavelength = 100 + (1 - energy) * 200 - aesthetic.speed * 50;

    // Phase advances over time (creates flowing motion)
    this.phase += this.speed * (1 + aesthetic.speed * 2);

    // Very slow life decay
    this.life -= 0.00005;
  }

  draw(ctx, aesthetic, audioFeatures, width, height, time) {
    if (this.life <= 0) return;

    // Get energy for this frequency band
    let energy = 0;
    if (this.frequencyBand === 'bass') {
      energy = audioFeatures.bass;
    } else if (this.frequencyBand === 'mid') {
      energy = audioFeatures.mid;
    } else {
      energy = audioFeatures.high;
    }

    // Generate wave points
    const points = [];
    const numPoints = 150;

    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * width;

      // Multiple sine waves for organic flow
      const wave1 = Math.sin((x / this.wavelength) * Math.PI * 2 + this.phase);
      const wave2 = Math.sin((x / (this.wavelength * 1.3)) * Math.PI * 2 + this.phase * 0.7);
      const wave3 = Math.sin((x / (this.wavelength * 0.8)) * Math.PI * 2 + this.phase * 1.3);

      const y = this.baseY + (wave1 + wave2 * 0.5 + wave3 * 0.3) * this.amplitude;

      points.push({ x, y });
    }

    // Draw ribbon as thick glowing line
    const alpha = this.life * this.opacity * (0.6 + energy * 0.4);
    const color = aesthetic.getColor(this.colorIndex, alpha);

    ctx.strokeStyle = color;

    // Thickness varies with energy and position
    const thickness = this.baseThickness * (0.8 + energy * 0.8);
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Heavy glow for ribbon effect
    const glowAmount = 35 + energy * 50 + aesthetic.transientBurst * 40;
    ctx.shadowBlur = glowAmount;
    ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.6);

    // Draw smooth curve through points
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 2; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }

    // Last segment
    const lastPoint = points[points.length - 1];
    const secondLast = points[points.length - 2];
    ctx.quadraticCurveTo(secondLast.x, secondLast.y, lastPoint.x, lastPoint.y);

    ctx.stroke();

    // Add subtle inner glow
    ctx.shadowBlur = glowAmount * 0.3;
    ctx.lineWidth = thickness * 0.5;
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  isDead() {
    return this.life <= 0;
  }
}

export class ChromaticFlow {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.ribbons = [];

    // V3 systems
    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();

    this.time = 0;

    this.initializeRibbons();
  }

  initializeRibbons() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.ribbons = [];

    // Create initial ribbons at different vertical positions
    const numRibbons = 12;
    const bands = ['bass', 'mid', 'high'];

    for (let i = 0; i < numRibbons; i++) {
      const yPosition = (height / (numRibbons + 1)) * (i + 1);
      const colorIndex = i % 7;
      const frequencyBand = bands[i % 3];

      this.ribbons.push(new FlowRibbon(
        yPosition,
        colorIndex,
        frequencyBand,
        this.aesthetic.current
      ));
    }
  }

  reset() {
    this.initializeRibbons();
    this.time = 0;
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

    this.time++;

    // Very slow fade for flowing trails
    this.ctx.fillStyle = `rgba(26, 10, 10, 0.02)`;
    this.ctx.fillRect(0, 0, width, height);

    // Update and draw ribbons
    for (let i = this.ribbons.length - 1; i >= 0; i--) {
      const ribbon = this.ribbons[i];
      ribbon.update(audioFeatures, this.aesthetic.current, this.time);

      if (ribbon.isDead()) {
        this.ribbons.splice(i, 1);
      } else {
        ribbon.draw(this.ctx, this.aesthetic, audioFeatures, width, height, this.time);
      }
    }

    // Maintain ribbon count
    const targetCount = 12 + Math.floor(this.aesthetic.current.density * 8);

    while (this.ribbons.length < targetCount) {
      const yPosition = Math.random() * height;
      const colorIndex = Math.floor(Math.random() * 7);
      const bands = ['bass', 'mid', 'high'];
      const frequencyBand = bands[Math.floor(Math.random() * 3)];

      this.ribbons.push(new FlowRibbon(
        yPosition,
        colorIndex,
        frequencyBand,
        this.aesthetic.current
      ));
    }

    // Transient bursts create extra ribbons
    if (this.aesthetic.transientBurst > 0.6 && this.ribbons.length < 25) {
      const yPosition = height / 2 + (Math.random() - 0.5) * height * 0.8;
      const colorIndex = Math.floor(Math.random() * 7);
      const bands = ['bass', 'mid', 'high'];
      const frequencyBand = bands[Math.floor(Math.random() * 3)];

      this.ribbons.push(new FlowRibbon(
        yPosition,
        colorIndex,
        frequencyBand,
        this.aesthetic.current
      ));
    }

    // Debug info
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
    this.ctx.font = '12px monospace';
    const label = `Tempo: ${bpm.toFixed(0)} BPM | Ribbons: ${this.ribbons.length} | ${this.getAestheticLabel(bpm)}`;
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
