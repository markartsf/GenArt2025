import { TempoAnalyzer, AestheticState } from '../aestheticSystem-v3.js';

// V3: RADICAL SIMPLIFICATION
// Focus: Long persistent trails that fill the screen
// Philosophy: Continuous motion, trails NEVER clear, very slow fade

class PersistentBeam {
  constructor(width, height, instrumentType, colorIndex) {
    this.width = width;
    this.height = height;
    this.instrumentType = instrumentType;
    this.colorIndex = colorIndex;

    // Random starting position
    this.x = Math.random() * width;
    this.y = Math.random() * height;

    // Movement - continuous curved motion
    this.angle = Math.random() * Math.PI * 2;
    this.speed = 3 + Math.random() * 5;
    this.angularVelocity = (Math.random() - 0.5) * 0.08;

    // Sine wave for guaranteed curves
    this.sinePhase = Math.random() * Math.PI * 2;
    this.sineFrequency = 0.04 + Math.random() * 0.06;
    this.sineAmplitude = 0.4 + Math.random() * 0.4;

    // Width variety
    const thicknessRand = Math.random();
    if (thicknessRand < 0.25) {
      this.thickness = 2 + Math.random() * 3; // Thin: 2-5px
    } else if (thicknessRand < 0.6) {
      this.thickness = 8 + Math.random() * 8; // Medium: 8-16px
    } else {
      this.thickness = 18 + Math.random() * 15; // Thick: 18-33px
    }

    // Reduced brightness for color
    this.brightness = 0.35 + Math.random() * 0.25; // 0.35-0.6

    // CRITICAL: Trail using circular buffer for performance
    this.maxTrailPoints = 500; // Cap at 500 points for performance
    this.trail = new Array(this.maxTrailPoints);
    for (let i = 0; i < this.maxTrailPoints; i++) {
      this.trail[i] = { x: 0, y: 0 };
    }
    this.trailIndex = 0;
    this.trailCount = 0;
  }

  update(audioFeatures, aesthetic) {
    // Audio-driven speed based on instrument type
    let speedMultiplier = 1;

    switch(this.instrumentType) {
      case 'violin':
        // Violin: spectral centroid + mid
        const violinActive = audioFeatures.spectralCentroid > 2500 && audioFeatures.mid > 0.2;
        speedMultiplier = violinActive ? 1.2 + audioFeatures.mid * 1.5 : 0.5;
        break;

      case 'synth':
        // Synth: high frequencies
        const synthActive = audioFeatures.high > 0.3 || audioFeatures.spectralRolloff > 6500;
        speedMultiplier = synthActive ? 1.5 + audioFeatures.high * 2 : 0.5;
        break;

      case 'bass':
        // Bass: low frequencies + transients
        const bassActive = audioFeatures.bass > 0.3 || aesthetic.transientBurst > 0.4;
        speedMultiplier = bassActive ? 1.3 + audioFeatures.bass * 2 : 0.4;
        break;
    }

    // Continuous angle changes for curves
    this.angularVelocity += (Math.random() - 0.5) * 0.1;
    this.angularVelocity = Math.max(-0.3, Math.min(0.3, this.angularVelocity));

    // Sine modulation for guaranteed curves
    this.sinePhase += this.sineFrequency;
    const sineModulation = Math.sin(this.sinePhase) * this.sineAmplitude;

    // Update angle
    this.angle += this.angularVelocity + sineModulation;

    // Calculate velocity
    const finalSpeed = this.speed * speedMultiplier * aesthetic.current.speed;
    const vx = Math.cos(this.angle) * finalSpeed;
    const vy = Math.sin(this.angle) * finalSpeed;

    // Update position
    this.x += vx;
    this.y += vy;

    // Wrap around screen (don't reset, just wrap)
    if (this.x < -100) this.x = this.width + 100;
    if (this.x > this.width + 100) this.x = -100;
    if (this.y < -100) this.y = this.height + 100;
    if (this.y > this.height + 100) this.y = -100;

    // Add current position to trail - circular buffer
    this.trail[this.trailIndex].x = this.x;
    this.trail[this.trailIndex].y = this.y;
    this.trailIndex = (this.trailIndex + 1) % this.maxTrailPoints;
    if (this.trailCount < this.maxTrailPoints) {
      this.trailCount++;
    }
  }

  draw(ctx, aesthetic) {
    if (this.trailCount < 2) return;

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Read from circular buffer in correct order
    const startIdx = this.trailCount < this.maxTrailPoints ? 0 : this.trailIndex;

    // Build path once using Path2D for better performance
    const path = new Path2D();
    const firstIdx = startIdx % this.maxTrailPoints;
    path.moveTo(this.trail[firstIdx].x, this.trail[firstIdx].y);

    for (let i = 1; i < this.trailCount; i++) {
      const idx = (startIdx + i) % this.maxTrailPoints;
      path.lineTo(this.trail[idx].x, this.trail[idx].y);
    }

    // Outer colored stroke
    ctx.strokeStyle = aesthetic.getColor(this.colorIndex, this.brightness * 0.7);
    ctx.lineWidth = this.thickness;
    ctx.shadowBlur = 10;
    ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.4);
    ctx.stroke(path);

    // Inner lighter core - reuse the same path
    ctx.strokeStyle = aesthetic.getColor(this.colorIndex, this.brightness * 0.35);
    ctx.lineWidth = this.thickness * 0.25;
    ctx.shadowBlur = 0;
    ctx.stroke(path);

    // Draw small colored head
    const lastIdx = (startIdx + this.trailCount - 1) % this.maxTrailPoints;
    const lastPoint = this.trail[lastIdx];
    ctx.fillStyle = aesthetic.getColor(this.colorIndex, this.brightness * 0.8);
    ctx.shadowBlur = 15;
    ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.5);

    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, this.thickness * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
  }
}

export class LongExposureBeamsV3 {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();

    this.beams = [];

    this.initialize();
  }

  initialize() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.beams = [];

    // FEWER beams but MUCH more presence
    const numBeams = 8 + Math.floor(Math.random() * 4); // 8-11 beams

    for (let i = 0; i < numBeams; i++) {
      let instrumentType, colorIndex;
      const rand = Math.random();

      if (rand < 0.35) {
        // Violin: warm colors
        instrumentType = 'violin';
        colorIndex = [0, 10, 9, 8][Math.floor(Math.random() * 4)];
      } else if (rand < 0.7) {
        // Synth: cool colors
        instrumentType = 'synth';
        colorIndex = [5, 6, 7, 1][Math.floor(Math.random() * 4)];
      } else {
        // Bass: deep reds
        instrumentType = 'bass';
        colorIndex = [2, 3, 4][Math.floor(Math.random() * 3)];
      }

      this.beams.push(new PersistentBeam(width, height, instrumentType, colorIndex));
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

    const bpm = this.tempoAnalyzer.analyze(audioFeatures);

    this.aesthetic.updateTempo(bpm);
    this.aesthetic.update(this.tempoAnalyzer);

    // VERY SLOW FADE - trails last 20-30 seconds
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = `rgba(40, 8, 8, 0.008)`; // MUCH slower fade (was 0.04)
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

    // Show trail lengths to verify persistence
    const avgTrailLength = this.beams.reduce((sum, b) => sum + b.trailCount, 0) / this.beams.length;
    const label = `V3: Persistent Trails | BPM: ${bpm.toFixed(0)} | Avg Trail: ${avgTrailLength.toFixed(0)} pts | ${this.getAestheticLabel(bpm)}`;
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
