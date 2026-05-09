import { TempoAnalyzer, AestheticState, OrbitingCamera } from '../aestheticSystem-v3.js';

export class RosslerAttractorV3 {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.points = [];
    this.maxPoints = 18000; // Even more points for V3 to fill screen

    // Rössler parameters
    this.a = 0.2;
    this.b = 0.2;
    this.c = 5.7;

    // Current position
    this.x = 0.1;
    this.y = 0;
    this.z = 0;

    // Time step
    this.dt = 0.05;

    // Scale - START HUGE for V3
    this.scale = 160; // VERY large initial scale
    this.scaleGrowth = 0; // Gradual growth over time
    this.rotationX = 0;
    this.rotationY = 0;
    this.rotationZ = 0;

    // V3 systems
    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();
    this.camera = new OrbitingCamera();
  }

  reset() {
    this.points = [];
    this.x = 0.1;
    this.y = 0;
    this.z = 0;
    this.scaleGrowth = 0;
    this.rotationX = 0;
    this.rotationY = 0;
    this.rotationZ = 0;
    this.tempoAnalyzer.reset();
    this.aesthetic.reset();
    this.camera.reset();
  }

  draw(audioFeatures) {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Analyze tempo
    const bpm = this.tempoAnalyzer.analyze(audioFeatures);

    // Update aesthetic state
    this.aesthetic.updateTempo(bpm);
    this.aesthetic.update(this.tempoAnalyzer);

    // Update camera
    this.camera.update(this.aesthetic.current);

    // V3: Deep dark English red background with adaptive fade
    this.ctx.fillStyle = `rgba(40, 8, 8, ${this.aesthetic.current.trailFade})`;
    this.ctx.fillRect(0, 0, width, height);

    // ENHANCED: Rössler parameters respond DRAMATICALLY to audio
    const tempoInfluence = this.aesthetic.current.speed;

    // MUCH MORE RESPONSIVE: Audio features dramatically influence parameters
    const highInfluence = audioFeatures.high * 2.5;
    const midInfluence = audioFeatures.mid * 2.0;
    const bassInfluence = audioFeatures.bass * 1.8;
    const rmsBoost = audioFeatures.rms * 1.5;

    this.a = 0.2 * (1 + tempoInfluence * 0.5 + highInfluence + midInfluence);
    this.b = 0.2 * (1 + tempoInfluence * 0.3 + bassInfluence + rmsBoost);
    this.c = 5.7 * (1 + tempoInfluence * 0.8 + midInfluence + rmsBoost);

    // ENHANCED: Much more dramatic multi-axis rotation with audio
    const rotationBase = 0.002 + (this.aesthetic.current.speed * 0.025);
    const audioRotationBoost = (audioFeatures.high * 0.02) + (audioFeatures.mid * 0.015);

    this.rotationX += (rotationBase * 0.8) + (audioFeatures.bass * 0.01);
    this.rotationY += (rotationBase * 1.2) + (audioFeatures.mid * 0.012);
    this.rotationZ += (rotationBase * 0.5) + (audioFeatures.high * 0.008);

    // Gradual scale growth over time (fills screen gradually)
    this.scaleGrowth += 0.005;
    const growthBonus = Math.min(30, this.scaleGrowth);

    // ENHANCED: Much more dramatic scale changes with audio
    const audioScaleBoost = (audioFeatures.bass * 50) + (audioFeatures.mid * 40) + (audioFeatures.high * 30);
    const dynamicScale = this.scale + growthBonus + (this.aesthetic.current.speed * 40) + audioScaleBoost;

    // Calculate next point
    const dx = -this.y - this.z;
    const dy = this.x + this.a * this.y;
    const dz = this.b + this.z * (this.x - this.c);

    this.x += dx * this.dt;
    this.y += dy * this.dt;
    this.z += dz * this.dt;

    // Store point with aesthetic state
    this.points.push({
      x: this.x,
      y: this.y,
      z: this.z,
      aestheticSpeed: this.aesthetic.current.speed,
      aestheticWarmth: this.aesthetic.current.warmth
    });

    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }

    // Draw with orbiting camera
    this.camera.apply(this.ctx, width, height);

    for (let i = 1; i < this.points.length; i++) {
      const point = this.points[i];
      const prevPoint = this.points[i - 1];

      // Apply 3D rotations
      const rotatedPoint = this.rotate3D(point.x, point.y, point.z);
      const rotatedPrevPoint = this.rotate3D(prevPoint.x, prevPoint.y, prevPoint.z);

      // Map 3D to 2D with perspective
      const perspective = 500;
      const z1 = rotatedPrevPoint.z + perspective;
      const z2 = rotatedPoint.z + perspective;

      const x1 = (rotatedPrevPoint.x * dynamicScale * perspective) / z1;
      const y1 = (rotatedPrevPoint.y * dynamicScale * perspective) / z1;
      const x2 = (rotatedPoint.x * dynamicScale * perspective) / z2;
      const y2 = (rotatedPoint.y * dynamicScale * perspective) / z2;

      // FIXED: Color cycling through FULL palette (13 colors) with audio influence
      const zNormalized = (point.z + 10) / 20;
      const xNormalized = (point.x + 10) / 20;

      // Audio-driven color cycling
      const audioColorShift = (audioFeatures.spectralCentroid / 5000) * 3 + (audioFeatures.high * 2);

      let colorIndex;

      if (point.aestheticWarmth > 0.7) {
        // Country - cycle through earthy warm colors (reds, browns, burgundy)
        colorIndex = Math.floor((zNormalized + xNormalized) * 4 + audioColorShift) % 13;
        // Bias towards reds/browns (indices 2-4)
        if (colorIndex > 8) colorIndex = 2 + (colorIndex % 3);
      } else if (point.aestheticWarmth < 0.4) {
        // Urban - cycle through bright colors (yellows, oranges, purples)
        colorIndex = Math.floor((zNormalized + xNormalized) * 5 + audioColorShift) % 13;
        // Bias towards yellows/purples (indices 0,1,5-7,9-11)
      } else {
        // Transition - use FULL palette
        colorIndex = Math.floor((zNormalized + xNormalized) * 6.5 + audioColorShift) % 13;
      }

      const progress = i / this.points.length;
      // ENHANCED: More dramatic alpha changes with audio for visibility
      const alpha = progress * (0.4 + audioFeatures.rms * 0.6);

      const color = this.aesthetic.getColor(colorIndex, alpha);
      this.ctx.strokeStyle = color;

      // ENHANCED: MUCH MORE AUDIO-RESPONSIVE THICKNESS
      const baseThickness = this.aesthetic.current.lineThickness - 2; // Slightly thinner than Lorenz

      // Variation based on depth (3D position)
      const depthVariation = (1 - (rotatedPoint.z + 50) / 100) * 5;

      // Path variation
      const pathVariation = Math.sin(i * 0.08) * 4;

      // DRAMATICALLY MORE audio influence
      const audioInfluence = (audioFeatures.rms * 12) + (audioFeatures.bass * 15) + (audioFeatures.mid * 10);

      const lineWidth = baseThickness + depthVariation + pathVariation + audioInfluence;

      this.ctx.lineWidth = Math.max(10, lineWidth); // Minimum 10px
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Dramatic glow in urban mode
      let glowAmount = 0;
      let glowAlpha = 0.7;

      if (this.aesthetic.current.speed > 0.65) {
        glowAmount = 15 + (this.aesthetic.current.speed * 30);
      } else if (audioFeatures.high > 0.25) {
        // Subtle glow in country mode on high frequencies
        glowAmount = 10 + audioFeatures.high * 15;
        glowAlpha = 0.4;
      }

      // Enhanced glow during tempo acceleration
      if (this.aesthetic.tempoAccelerationGlow > 0.2) {
        glowAmount += this.aesthetic.tempoAccelerationGlow * 25;
        glowAlpha = 0.75;
      }

      // Bright burst on staccato synth hits
      if (this.aesthetic.transientBurst > 0.4) {
        glowAmount += this.aesthetic.transientBurst * 35;
        glowAlpha = 0.85;
      }

      if (glowAmount > 0) {
        this.ctx.shadowBlur = glowAmount;
        this.ctx.shadowColor = this.aesthetic.getColor(colorIndex, glowAlpha);
      }

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();

      this.ctx.shadowBlur = 0;
    }

    this.camera.restore(this.ctx);

    // Debug info
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
    this.ctx.font = '12px monospace';
    const label = `Tempo: ${bpm.toFixed(0)} BPM | ${this.getAestheticLabel(bpm)}`;
    this.ctx.fillText(label, 10, height - 10);
    this.ctx.restore();
  }

  rotate3D(x, y, z) {
    // Rotate around X axis
    let y1 = y * Math.cos(this.rotationX) - z * Math.sin(this.rotationX);
    let z1 = y * Math.sin(this.rotationX) + z * Math.cos(this.rotationX);

    // Rotate around Y axis
    let x2 = x * Math.cos(this.rotationY) + z1 * Math.sin(this.rotationY);
    let z2 = -x * Math.sin(this.rotationY) + z1 * Math.cos(this.rotationY);

    // Rotate around Z axis
    let x3 = x2 * Math.cos(this.rotationZ) - y1 * Math.sin(this.rotationZ);
    let y3 = x2 * Math.sin(this.rotationZ) + y1 * Math.cos(this.rotationZ);

    return { x: x3, y: y3, z: z2 };
  }

  getAestheticLabel(bpm) {
    if (bpm < 85) return 'Country / Ethereal';
    if (bpm < 100) return 'Countryside';
    if (bpm < 115) return 'Suburban';
    return 'Urban / Vibrant';
  }
}
