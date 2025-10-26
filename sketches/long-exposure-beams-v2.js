import { TempoAnalyzer, AestheticState } from '../aestheticSystem-v3.js';

// NEW APPROACH: Pre-compute curved paths using Bézier curves
// Instead of trying to force point-by-point motion to curve,
// we calculate complete curved paths and animate along them

class CurvedBeam {
  constructor(width, height, type, colorIndex) {
    this.width = width;
    this.height = height;
    this.type = type;
    this.colorIndex = colorIndex;

    // Visual properties - varied thickness
    const thicknessRand = Math.random();
    if (thicknessRand < 0.3) {
      this.thickness = 3 + Math.random() * 2; // Thin: 3-5px
    } else if (thicknessRand < 0.7) {
      this.thickness = 8 + Math.random() * 4; // Medium: 8-12px
    } else {
      this.thickness = 15 + Math.random() * 10; // Thick: 15-25px
    }
    this.brightness = 0.6 + Math.random() * 0.4;

    // Trail
    this.trail = [];
    this.maxTrailLength = 25 + Math.random() * 15;

    // Path following
    this.pathProgress = 0;
    this.pathSpeed = 0.005 + Math.random() * 0.01;

    // Generate initial curved path
    this.generateNewPath();
  }

  generateNewPath() {
    // Generate a cubic Bézier curve with guaranteed curvature

    // Random start point
    const startX = Math.random() * this.width;
    const startY = Math.random() * this.height;

    // Random end point (far from start)
    const endX = Math.random() * this.width;
    const endY = Math.random() * this.height;

    // Control points that create dramatic curves
    // Place them perpendicular to the direct path
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    // Vector from start to end
    const dx = endX - startX;
    const dy = endY - startY;

    // Perpendicular vector (rotated 90 degrees)
    const perpX = -dy;
    const perpY = dx;

    // Normalize and scale for dramatic curvature
    const length = Math.sqrt(perpX * perpX + perpY * perpY);
    const curvature = 0.3 + Math.random() * 0.7; // 30-100% of path length

    const cp1Offset = curvature * (Math.random() - 0.5) * 2;
    const cp2Offset = curvature * (Math.random() - 0.5) * 2;

    this.path = {
      start: { x: startX, y: startY },
      cp1: { x: midX + perpX / length * this.width * cp1Offset, y: midY + perpY / length * this.height * cp1Offset },
      cp2: { x: midX + perpX / length * this.width * cp2Offset, y: midY + perpY / length * this.height * cp2Offset },
      end: { x: endX, y: endY }
    };

    this.pathProgress = 0;
  }

  getPointOnPath(t) {
    // Cubic Bézier formula: B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    return {
      x: mt3 * this.path.start.x +
         3 * mt2 * t * this.path.cp1.x +
         3 * mt * t2 * this.path.cp2.x +
         t3 * this.path.end.x,
      y: mt3 * this.path.start.y +
         3 * mt2 * t * this.path.cp1.y +
         3 * mt * t2 * this.path.cp2.y +
         t3 * this.path.end.y
    };
  }

  update(audioFeatures, aesthetic) {
    // Audio-driven speed
    let speedMultiplier = 1;

    switch(this.type) {
      case 'bass':
        speedMultiplier = 1 + audioFeatures.bass * 2;
        break;
      case 'mid':
        speedMultiplier = 0.8 + audioFeatures.mid * 1.5;
        break;
      case 'high':
        speedMultiplier = 1.5 + audioFeatures.high * 3;
        this.brightness = 0.8 + audioFeatures.high * 0.2;
        break;
    }

    // Update progress along path
    this.pathProgress += this.pathSpeed * speedMultiplier * aesthetic.current.speed;

    // When path is complete, generate new one
    if (this.pathProgress >= 1.0) {
      this.generateNewPath();
      this.trail = []; // Clear trail when starting new path
    }

    // Get current position on path
    const pos = this.getPointOnPath(this.pathProgress);

    // Add to trail
    this.trail.push({ x: pos.x, y: pos.y, brightness: this.brightness });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }
  }

  draw(ctx, aesthetic) {
    if (this.trail.length < 2) return;

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const midPoint = Math.floor(this.trail.length / 2);

    // Draw trail in two parts
    const drawPart = (startIdx, endIdx, alpha, thickness, withShadow) => {
      if (endIdx - startIdx < 2) return;

      ctx.strokeStyle = aesthetic.getColor(this.colorIndex, alpha);
      ctx.lineWidth = thickness;

      if (withShadow) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.6);
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.moveTo(this.trail[startIdx].x, this.trail[startIdx].y);

      for (let i = startIdx + 1; i < endIdx; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }

      ctx.stroke();
    };

    // Back half - thinner
    drawPart(0, midPoint, this.brightness * 0.3, this.thickness * 0.6, false);

    // Front half - brighter with glow
    drawPart(midPoint, this.trail.length, this.brightness * 0.7, this.thickness, true);

    // Draw bright head
    const lastPoint = this.trail[this.trail.length - 1];
    ctx.fillStyle = aesthetic.getColor(this.colorIndex, this.brightness);
    ctx.shadowBlur = 25;
    ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.8);

    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, this.thickness * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
  }
}

export class LongExposureBeamsV2 {
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

    const numBeams = 20 + Math.floor(Math.random() * 5);

    for (let i = 0; i < numBeams; i++) {
      let type, colorIndex;
      const rand = Math.random();

      if (rand < 0.4) {
        type = 'bass';
        colorIndex = [1, 2, 3, 8][Math.floor(Math.random() * 4)];
      } else if (rand < 0.75) {
        type = 'mid';
        colorIndex = [5, 6, 7][Math.floor(Math.random() * 3)];
      } else {
        type = 'high';
        colorIndex = [0, 10][Math.floor(Math.random() * 2)];
      }

      this.beams.push(new CurvedBeam(width, height, type, colorIndex));
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

    // Slow fade
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = `rgba(26, 10, 10, 0.03)`;
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
    const label = `Long Exposure V2 | Tempo: ${bpm.toFixed(0)} BPM | Beams: ${this.beams.length} | ${this.getAestheticLabel(bpm)}`;
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
