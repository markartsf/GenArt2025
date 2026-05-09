import { TempoAnalyzer, AestheticState } from '../aestheticSystem-v3.js';
import { Camera } from '../colorPalette.js';

// V2 ENHANCEMENTS: Instrument-like audio mapping, camera movement, varied persistence

class CurvedBeam {
  constructor(width, height, instrumentType, colorIndex) {
    this.width = width;
    this.height = height;
    this.instrumentType = instrumentType; // 'violin', 'synth', 'bass'
    this.colorIndex = colorIndex;

    // IMPROVED: Much wider thickness variety (1px to 30px)
    const thicknessRand = Math.random();
    if (thicknessRand < 0.2) {
      this.thickness = 1 + Math.random() * 2; // Ultra-thin: 1-3px
    } else if (thicknessRand < 0.4) {
      this.thickness = 4 + Math.random() * 4; // Thin: 4-8px
    } else if (thicknessRand < 0.7) {
      this.thickness = 10 + Math.random() * 8; // Medium: 10-18px
    } else {
      this.thickness = 20 + Math.random() * 10; // Thick: 20-30px
    }

    // REDUCED BRIGHTNESS: Much less white, more color
    this.brightness = 0.25 + Math.random() * 0.25; // Now 0.25-0.5 (was 0.4-0.7)

    // Trail
    this.trail = [];

    // ENHANCED: MUCH LONGER & MORE PERSISTENT trails
    switch(instrumentType) {
      case 'violin':
        this.maxTrailLength = 150 + Math.random() * 100; // Very long, flowing trails (150-250)
        this.fadeRate = 0.008; // Very slow fade
        break;
      case 'synth':
        this.maxTrailLength = 100 + Math.random() * 80; // Long trails (100-180)
        this.fadeRate = 0.015; // Slow fade
        break;
      case 'bass':
        this.maxTrailLength = 60 + Math.random() * 60; // Medium-long trails (60-120)
        this.fadeRate = 0.025; // Medium fade
        break;
    }

    // Path following
    this.pathProgress = 0;

    // Speed varies by instrument type
    if (instrumentType === 'violin') {
      this.pathSpeed = 0.003 + Math.random() * 0.006; // Slower, graceful
    } else if (instrumentType === 'synth') {
      this.pathSpeed = 0.008 + Math.random() * 0.012; // Fast, energetic
    } else {
      this.pathSpeed = 0.005 + Math.random() * 0.008; // Medium
    }

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
    // ENHANCED: MUCH MORE DRAMATIC instrument-specific audio mapping
    let speedMultiplier = 1;
    let isActive = false;
    let sizeBoost = 0;

    switch(this.instrumentType) {
      case 'violin':
        // Violin: High spectral centroid + mid frequency energy
        const violinScore = (audioFeatures.spectralCentroid / 5000) * audioFeatures.mid;
        speedMultiplier = 0.8 + violinScore * 4.0; // 2.6x more responsive
        isActive = audioFeatures.spectralCentroid > 2000 && audioFeatures.mid > 0.2;
        sizeBoost = violinScore * 8; // Make visible when active
        // Enhance brightness slightly when active (but keep it lower to avoid white)
        if (isActive) {
          this.brightness = Math.min(0.55, this.brightness + 0.1);
        }
        break;

      case 'synth':
        // Synth: High frequencies or wide spectral rolloff
        const synthScore = audioFeatures.high + (audioFeatures.spectralRolloff / 10000);
        speedMultiplier = 1.5 + synthScore * 5.0; // 2.5x more responsive
        isActive = audioFeatures.high > 0.25 || audioFeatures.spectralRolloff > 6000;
        sizeBoost = synthScore * 12; // Very visible when active
        break;

      case 'bass':
        // Bass/Drums: Low frequencies + transients
        const bassScore = audioFeatures.bass + aesthetic.transientBurst;
        speedMultiplier = 1.2 + bassScore * 6.0; // 2.4x more responsive
        isActive = audioFeatures.bass > 0.25 || aesthetic.transientBurst > 0.4;
        sizeBoost = bassScore * 10; // Very visible when active
        break;
    }

    // Store size boost for drawing
    this.currentSizeBoost = sizeBoost;

    // More dramatic activity difference (move faster when active)
    const activityMultiplier = isActive ? 1.5 : 0.2;

    // Update progress along path with more dramatic speed
    this.pathProgress += this.pathSpeed * speedMultiplier * aesthetic.current.speed * activityMultiplier;

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

    // ENHANCED: Apply audio-driven size boost to thickness
    const dynamicThickness = this.thickness + (this.currentSizeBoost || 0);

    // ENHANCED: Draw with colored stroke - REDUCED brightness to avoid white
    const drawPart = (startIdx, endIdx, alpha, thickness, withShadow) => {
      if (endIdx - startIdx < 2) return;

      // Outer colored stroke (vibrant but not too bright)
      ctx.strokeStyle = aesthetic.getColor(this.colorIndex, alpha * 0.6); // Reduced from 0.8
      ctx.lineWidth = thickness;

      if (withShadow) {
        ctx.shadowBlur = 15 + (this.currentSizeBoost || 0) * 1.5; // Reduced glow
        ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.4); // Reduced from 0.6
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.moveTo(this.trail[startIdx].x, this.trail[startIdx].y);

      for (let i = startIdx + 1; i < endIdx; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }

      ctx.stroke();

      // Inner lighter core (subtle, not white)
      ctx.strokeStyle = aesthetic.getColor(this.colorIndex, alpha * 0.25); // Reduced from 0.4
      ctx.lineWidth = thickness * 0.25; // Thinner core
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.moveTo(this.trail[startIdx].x, this.trail[startIdx].y);

      for (let i = startIdx + 1; i < endIdx; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }

      ctx.stroke();
    };

    // Back half - thinner, faded
    drawPart(0, midPoint, this.brightness * 0.25, dynamicThickness * 0.7, false); // Reduced from 0.3

    // Front half - with glow (use dynamic thickness)
    drawPart(midPoint, this.trail.length, this.brightness * 0.55, dynamicThickness, true); // Reduced from 0.7

    // Draw colored head when active (smaller, less bright)
    const lastPoint = this.trail[this.trail.length - 1];
    ctx.fillStyle = aesthetic.getColor(this.colorIndex, this.brightness * 0.6); // Reduced from 0.8
    ctx.shadowBlur = 18 + (this.currentSizeBoost || 0) * 2; // Reduced from 24
    ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.5); // Reduced from 0.7

    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, dynamicThickness * 0.4, 0, Math.PI * 2);
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
    this.camera = new Camera(); // ADDED: Camera system

    this.beams = [];

    this.initialize();
  }

  initialize() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.beams = [];

    // ENHANCED: More beams for fuller screen
    const numBeams = 25 + Math.floor(Math.random() * 10);

    for (let i = 0; i < numBeams; i++) {
      let instrumentType, colorIndex;
      const rand = Math.random();

      // INSTRUMENT-LIKE MAPPING
      if (rand < 0.35) {
        // Violin/Strings: Warm yellows, oranges
        instrumentType = 'violin';
        colorIndex = [0, 10, 9, 8][Math.floor(Math.random() * 4)]; // yellows, oranges
      } else if (rand < 0.7) {
        // Synth: Cool purples, blues, magentas
        instrumentType = 'synth';
        colorIndex = [5, 6, 7, 1][Math.floor(Math.random() * 4)]; // violets, purples, reds
      } else {
        // Bass/Drums: Deep reds, dark browns
        instrumentType = 'bass';
        colorIndex = [2, 3, 4][Math.floor(Math.random() * 3)]; // dark reds, burgundy, brown
      }

      this.beams.push(new CurvedBeam(width, height, instrumentType, colorIndex));
    }
  }

  reset() {
    this.initialize();
    this.tempoAnalyzer.reset();
    this.aesthetic.reset();
    this.camera.reset();
  }

  draw(audioFeatures) {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    const bpm = this.tempoAnalyzer.analyze(audioFeatures);

    this.aesthetic.updateTempo(bpm);
    this.aesthetic.update(this.tempoAnalyzer);

    // CAMERA: Update audio-driven camera movement
    this.camera.update(audioFeatures);

    // DEEP ENGLISH RED BACKGROUND with VERY slow fade for more persistence
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = `rgba(40, 8, 8, 0.02)`; // Very slow fade (was 0.04)
    this.ctx.fillRect(0, 0, width, height);

    // Apply camera transformation
    this.camera.apply(this.ctx, width, height);

    // Update and draw all beams
    for (const beam of this.beams) {
      beam.update(audioFeatures, this.aesthetic);
      beam.draw(this.ctx, this.aesthetic);
    }

    // Restore camera transformation
    this.camera.restore(this.ctx);

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
