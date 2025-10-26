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
    this.sineFrequency = 0.03 + Math.random() * 0.05;
    this.sineAmplitude = 0.25 + Math.random() * 0.35; // MUCH larger amplitude for dramatic curves

    // Trail properties
    this.trailLength = 20 + Math.random() * 15; // Shorter trails for performance
    this.trail = [];

    // Visual properties
    this.thickness = 10 + Math.random() * 8; // 10-18px thick
    this.brightness = 0.6 + Math.random() * 0.4;

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

    // Continuously change angle for organic curves
    this.angularVelocity += (Math.random() - 0.5) * 0.12 * this.curviness * curveMultiplier;

    // Keep angular velocity in reasonable range but NEVER zero
    this.angularVelocity = Math.max(-0.3, Math.min(0.3, this.angularVelocity));

    // Prevent settling into straight lines - ensure minimum curvature
    if (Math.abs(this.angularVelocity) < 0.03) {
      this.angularVelocity += (Math.random() - 0.5) * 0.15;
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
      // Force a large angle change to break out of straight line
      this.angle += (Math.random() - 0.5) * 0.4 + (Math.random() > 0.5 ? 0.3 : -0.3);
    }

    // Force minimum angle change every frame (never stay straight)
    const minAngleChange = 0.04;
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

    // Draw trail using quadratic curves for smooth, organic appearance
    const midPoint = Math.floor(this.trail.length / 2);

    // Helper function to draw smooth curve through points
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

      // Draw smooth curves using quadratic curves
      for (let i = startIdx + 1; i < endIdx - 1; i++) {
        const current = this.trail[i];
        const next = this.trail[i + 1];

        // Control point is the current point
        // End point is midway to next point
        const cpx = current.x;
        const cpy = current.y;
        const endX = (current.x + next.x) / 2;
        const endY = (current.y + next.y) / 2;

        ctx.quadraticCurveTo(cpx, cpy, endX, endY);
      }

      // Draw final segment
      if (endIdx - 1 >= startIdx) {
        ctx.lineTo(this.trail[endIdx - 1].x, this.trail[endIdx - 1].y);
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
