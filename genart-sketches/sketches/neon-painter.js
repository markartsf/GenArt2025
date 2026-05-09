import { TempoAnalyzer, AestheticState } from '../aestheticSystem-v3.js';

class LightStroke {
  constructor(points, colorIndex, thickness, aesthetic) {
    this.points = points; // Array of {x, y, pressure}
    this.colorIndex = colorIndex;
    this.thickness = thickness;
    this.life = 1;
    this.warmth = aesthetic.warmth;
  }

  update(aesthetic) {
    this.warmth += (aesthetic.warmth - this.warmth) * 0.05;
    this.life -= 0.0003; // Very slow fade
  }

  draw(ctx, aesthetic) {
    if (this.points.length < 2 || this.life <= 0) return;

    // Draw smooth bezier curve through points
    for (let i = 1; i < this.points.length; i++) {
      const p0 = this.points[i - 1];
      const p1 = this.points[i];

      const progress = i / this.points.length;
      const alpha = this.life * (0.7 + progress * 0.3);

      const color = aesthetic.getColor(this.colorIndex, alpha);
      ctx.strokeStyle = color;

      // Pressure affects thickness
      const thickness = this.thickness * p1.pressure * (0.8 + progress * 0.4);
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Glow effect
      const glowAmount = 25 + (this.thickness * 0.8) + (aesthetic.transientBurst * 30);
      ctx.shadowBlur = glowAmount;
      ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.7);

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
  }

  isDead() {
    return this.life <= 0;
  }
}

class Painter {
  constructor(width, height) {
    this.x = width / 2;
    this.y = height / 2;
    this.width = width;
    this.height = height;

    // Movement parameters
    this.angle = Math.random() * Math.PI * 2;
    this.angleVelocity = 0;
    this.speed = 0;

    // Painting state
    this.isDrawing = false;
    this.currentStroke = [];
    this.strokeColor = 0;
  }

  update(audioFeatures, aesthetic) {
    // Audio controls movement
    const totalEnergy = (audioFeatures.bass + audioFeatures.mid + audioFeatures.high) / 3;

    // Smooth angular movement - like a pendulum
    const angleChange = (Math.random() - 0.5) * 0.15;
    this.angleVelocity += angleChange;
    this.angleVelocity *= 0.95; // Damping
    this.angle += this.angleVelocity;

    // Speed based on audio energy
    this.speed = 2 + totalEnergy * 8 + aesthetic.current.speed * 5;

    // Move in current direction
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    // Bounce off edges with smooth reflection
    if (this.x < 50 || this.x > this.width - 50) {
      this.angle = Math.PI - this.angle;
      this.x = Math.max(50, Math.min(this.width - 50, this.x));
    }
    if (this.y < 50 || this.y > this.height - 50) {
      this.angle = -this.angle;
      this.y = Math.max(50, Math.min(this.height - 50, this.y));
    }

    // Add to current stroke if drawing
    if (this.isDrawing) {
      // Pressure based on audio features (different for each frequency)
      const pressure = 0.6 + audioFeatures.mid * 0.4 + Math.sin(Date.now() * 0.01) * 0.2;

      this.currentStroke.push({
        x: this.x,
        y: this.y,
        pressure: pressure
      });
    }
  }

  startStroke(colorIndex) {
    this.isDrawing = true;
    this.currentStroke = [];
    this.strokeColor = colorIndex;
  }

  endStroke() {
    this.isDrawing = false;
    const stroke = this.currentStroke;
    this.currentStroke = [];
    return stroke;
  }
}

export class NeonPainter {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.strokes = [];

    // V3 systems
    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();

    // Painter
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    this.painter = new Painter(width, height);

    // Drawing state
    this.strokeCounter = 0;
    this.strokeDuration = 0;
    this.maxStrokeDuration = 60; // frames
  }

  reset() {
    this.strokes = [];
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    this.painter = new Painter(width, height);
    this.strokeCounter = 0;
    this.strokeDuration = 0;
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

    // Very slow fade for long exposure
    this.ctx.fillStyle = `rgba(26, 10, 10, 0.008)`;
    this.ctx.fillRect(0, 0, width, height);

    // Update painter
    this.painter.update(audioFeatures, this.aesthetic);

    // Manage stroke drawing
    if (!this.painter.isDrawing) {
      // Start new stroke
      const colorIndex = Math.floor(this.strokeCounter % 7);
      this.painter.startStroke(colorIndex);
      this.strokeDuration = 0;
    }

    this.strokeDuration++;

    // End stroke based on duration or transient
    const maxDuration = this.maxStrokeDuration * (1 - this.aesthetic.current.speed * 0.5);
    const shouldEnd = this.strokeDuration > maxDuration || this.aesthetic.transientBurst > 0.7;

    if (shouldEnd && this.painter.isDrawing) {
      const strokePoints = this.painter.endStroke();

      if (strokePoints.length > 2) {
        // Calculate thickness based on audio
        const totalEnergy = (audioFeatures.bass + audioFeatures.mid + audioFeatures.high) / 3;
        const thickness = 15 + totalEnergy * 35 + this.aesthetic.current.density * 20;

        const stroke = new LightStroke(
          strokePoints,
          this.painter.strokeColor,
          thickness,
          this.aesthetic.current
        );

        this.strokes.push(stroke);
        this.strokeCounter++;

        // Limit total strokes
        if (this.strokes.length > 30) {
          this.strokes.shift();
        }
      }
    }

    // Update and draw all strokes
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      const stroke = this.strokes[i];
      stroke.update(this.aesthetic.current);

      if (stroke.isDead()) {
        this.strokes.splice(i, 1);
      } else {
        stroke.draw(this.ctx, this.aesthetic);
      }
    }

    // Draw current stroke being painted
    if (this.painter.isDrawing && this.painter.currentStroke.length > 1) {
      const points = this.painter.currentStroke;
      const colorIndex = this.painter.strokeColor;

      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];

        const progress = i / points.length;
        const color = this.aesthetic.getColor(colorIndex, 0.9);

        this.ctx.strokeStyle = color;

        const totalEnergy = (audioFeatures.bass + audioFeatures.mid + audioFeatures.high) / 3;
        const thickness = (15 + totalEnergy * 35) * p1.pressure;
        this.ctx.lineWidth = thickness;
        this.ctx.lineCap = 'round';

        // Active stroke glows more
        this.ctx.shadowBlur = 35 + totalEnergy * 40;
        this.ctx.shadowColor = this.aesthetic.getColor(colorIndex, 0.8);

        this.ctx.beginPath();
        this.ctx.moveTo(p0.x, p0.y);
        this.ctx.lineTo(p1.x, p1.y);
        this.ctx.stroke();
      }

      this.ctx.shadowBlur = 0;
    }

    // Draw painter position as a glowing point
    const totalEnergy = (audioFeatures.bass + audioFeatures.mid + audioFeatures.high) / 3;
    const painterSize = 8 + totalEnergy * 15;

    this.ctx.fillStyle = this.aesthetic.getColor(this.painter.strokeColor, 0.9);
    this.ctx.shadowBlur = 40 + totalEnergy * 30;
    this.ctx.shadowColor = this.aesthetic.getColor(this.painter.strokeColor, 0.9);

    this.ctx.beginPath();
    this.ctx.arc(this.painter.x, this.painter.y, painterSize, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.shadowBlur = 0;

    // Debug info
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
    this.ctx.font = '12px monospace';
    const label = `Tempo: ${bpm.toFixed(0)} BPM | Strokes: ${this.strokes.length} | ${this.getAestheticLabel(bpm)}`;
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
