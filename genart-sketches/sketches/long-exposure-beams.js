import { TempoAnalyzer, AestheticState } from '../aestheticSystem-v3.js';

class LightBeam {
  constructor(x, y, width, height, type, colorIndex) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type; // 'bass', 'mid', 'high'
    this.colorIndex = colorIndex;

    // Movement properties - angle-based for organic curves
    this.angle = Math.random() * Math.PI * 2; // Current direction
    this.speed = 5 + Math.random() * 8; // Base speed
    this.angularVelocity = (Math.random() - 0.5) * 0.15; // Turning speed
    this.curviness = 0.5 + Math.random() * 1.5; // How much it curves

    // Sine wave modulation for guaranteed curves (no straight lines)
    this.sinePhase = Math.random() * Math.PI * 2;
    this.sineFrequency = 0.05 + Math.random() * 0.08;
    this.sineAmplitude = 0.6 + Math.random() * 0.6; // EXTREME amplitude: 0.6-1.2 radians (34-69 degrees!)

    // Trail properties
    this.trailLength = 20 + Math.random() * 15; // Shorter trails for performance
    this.trail = [];

    // Visual properties - VARIED THICKNESS (Strategy 3)
    // Reference image has thin, medium, and thick beams
    const thicknessRand = Math.random();
    if (thicknessRand < 0.3) {
      this.thickness = 3 + Math.random() * 2; // Thin: 3-5px
    } else if (thicknessRand < 0.7) {
      this.thickness = 8 + Math.random() * 4; // Medium: 8-12px
    } else {
      this.thickness = 15 + Math.random() * 10; // Thick: 15-25px
    }
    this.brightness = 0.6 + Math.random() * 0.4;

    // Perpendicular wobble parameters (Strategy 1)
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.wobbleFrequency = 0.08 + Math.random() * 0.12;
    this.wobbleAmplitude = 15 + Math.random() * 25; // EXTREME: 15-40px perpendicular offset!

    // Strobing (for segmented trails)
    this.strobeInterval = Math.random() > 0.7 ? Math.floor(3 + Math.random() * 4) : 0;
    this.strobeCounter = 0;
    this.isVisible = true;
  }

  update(audioFeatures, aesthetic) {
    // Audio-driven behavior based on type
    let speedMultiplier = 1;
    let curveMultiplier = 1;

    switch(this.type) {
      case 'bass':
        // Red/magenta - fast sweeping curves
        speedMultiplier = 1 + audioFeatures.bass * 2;
        curveMultiplier = 1 + audioFeatures.bass * 0.5;
        break;

      case 'mid':
        // Blue/cyan - tighter looping curves
        speedMultiplier = 0.8 + audioFeatures.mid * 1.5;
        curveMultiplier = 1.5 + audioFeatures.mid * 1.0; // More curviness
        break;

      case 'high':
        // Yellow/white - very fast with gentle curves
        speedMultiplier = 1.5 + audioFeatures.high * 3;
        curveMultiplier = 0.7 + audioFeatures.high * 0.3;
        this.brightness = 0.8 + audioFeatures.high * 0.2;
        break;
    }

    // Tempo affects overall speed
    const tempoMultiplier = aesthetic.current.speed;

    // Continuously change angle for organic curves (MUCH MORE AGGRESSIVE)
    this.angularVelocity += (Math.random() - 0.5) * 0.25 * this.curviness * curveMultiplier;

    // Keep angular velocity in WIDER range but NEVER zero
    this.angularVelocity = Math.max(-0.5, Math.min(0.5, this.angularVelocity));

    // Prevent settling into straight lines - MUCH LARGER minimum curvature
    if (Math.abs(this.angularVelocity) < 0.08) {
      this.angularVelocity += (Math.random() - 0.5) * 0.3;
    }

    // Add sine wave modulation to GUARANTEE curves (no straight lines possible)
    this.sinePhase += this.sineFrequency;
    const sineModulation = Math.sin(this.sinePhase) * this.sineAmplitude * curveMultiplier;

    // Update angle with both angular velocity AND sine modulation
    this.angle += this.angularVelocity + sineModulation;

    // CRITICAL: Detect and break cardinal directions (0°, 90°, 180°, 270°)
    // Normalize angle to 0-2π
    const normalizedAngle = ((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const cardinalThreshold = 0.1; // Within ~6 degrees of cardinal
    const isNearCardinal =
      Math.abs(normalizedAngle) < cardinalThreshold || // 0° (horizontal right)
      Math.abs(normalizedAngle - Math.PI / 2) < cardinalThreshold || // 90° (vertical down)
      Math.abs(normalizedAngle - Math.PI) < cardinalThreshold || // 180° (horizontal left)
      Math.abs(normalizedAngle - Math.PI * 1.5) < cardinalThreshold || // 270° (vertical up)
      Math.abs(normalizedAngle - Math.PI * 2) < cardinalThreshold; // 360°/0°

    if (isNearCardinal) {
      // Force a MASSIVE angle change to break out of straight line
      this.angle += (Math.random() - 0.5) * 0.8 + (Math.random() > 0.5 ? 0.6 : -0.6);
    }

    // Force LARGER minimum angle change every frame (never stay straight)
    const minAngleChange = 0.1; // Increased from 0.04 to 0.1
    const totalChange = Math.abs(this.angularVelocity + sineModulation);
    if (totalChange < minAngleChange) {
      this.angle += (Math.random() > 0.5 ? minAngleChange : -minAngleChange);
    }

    // Calculate velocity from angle and speed
    const finalSpeed = this.speed * speedMultiplier * tempoMultiplier;
    const vx = Math.cos(this.angle) * finalSpeed;
    const vy = Math.sin(this.angle) * finalSpeed;

    // Update position
    this.x += vx;
    this.y += vy;

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
      // Strategy 1: Add perpendicular wobble to force curvature
      this.wobblePhase += this.wobbleFrequency;
      const wobbleOffset = Math.sin(this.wobblePhase) * this.wobbleAmplitude;

      // Calculate perpendicular direction (90° from current angle)
      const perpAngle = this.angle + Math.PI / 2;
      const wobbleX = Math.cos(perpAngle) * wobbleOffset;
      const wobbleY = Math.sin(perpAngle) * wobbleOffset;

      // Strategy 4: Add random micro-adjustments (increased)
      const microJitterX = (Math.random() - 0.5) * 5;
      const microJitterY = (Math.random() - 0.5) * 5;

      // Store position with wobble and jitter applied
      this.trail.push({
        x: this.x + wobbleX + microJitterX,
        y: this.y + wobbleY + microJitterY,
        brightness: this.brightness
      });

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

    // Draw trail using quadratic curves for smooth, organic appearance
    const midPoint = Math.floor(this.trail.length / 2);

    // Strategy 2: Better control point calculation using Catmull-Rom-like curves
    const drawCurvedPath = (startIdx, endIdx, alpha, thickness, withShadow) => {
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

      // Draw smooth curves using improved control points
      for (let i = startIdx; i < endIdx - 1; i++) {
        const p0 = this.trail[Math.max(startIdx, i - 1)];
        const p1 = this.trail[i];
        const p2 = this.trail[i + 1];
        const p3 = this.trail[Math.min(endIdx - 1, i + 2)];

        // Calculate control points using Catmull-Rom tangents
        // This ensures smooth curves through all points
        const tension = 0.5; // Controls curve tightness

        const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
        const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
        const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
        const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }

      ctx.stroke();
    };

    // Back half - thinner, more transparent
    if (this.trail.length > 3) {
      drawCurvedPath(0, midPoint, this.brightness * 0.3, this.thickness * 0.6, false);
    }

    // Front half - thicker, brighter with glow
    drawCurvedPath(midPoint, this.trail.length, this.brightness * 0.7, this.thickness, true);

    // Draw bright head/core
    if (this.isVisible) {
      const lastPoint = this.trail[this.trail.length - 1];
      ctx.fillStyle = aesthetic.getColor(this.colorIndex, this.brightness);
      ctx.shadowBlur = 25;
      ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.8);

      ctx.beginPath();
      ctx.arc(lastPoint.x, lastPoint.y, this.thickness * 0.5, 0, Math.PI * 2);
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

    // Create 20-25 light beams for better performance
    const numBeams = 20 + Math.floor(Math.random() * 5);

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

    // Slow fade for long exposure effect (slightly faster for performance)
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = `rgba(26, 10, 10, 0.03)`; // Balanced fade
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
