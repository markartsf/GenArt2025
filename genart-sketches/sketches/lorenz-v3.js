import { TempoAnalyzer, AestheticState, OrbitingCamera } from '../aestheticSystem-v3.js';

export class LorenzAttractorV3 {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.points = [];
    this.baseMaxPoints = 10000;
    this.maxPoints = 10000; // Varies with audio intensity

    // Lorenz parameters
    this.sigma = 10;
    this.rho = 28;
    this.beta = 8/3;

    // Current position
    this.x = 0.1;
    this.y = 0;
    this.z = 0;

    // Time step
    this.dt = 0.01;

    // Scale - larger for V3
    this.scale = 14;
    this.rotation = 0;

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
    this.rotation = 0;
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

    // ENHANCED: Lorenz parameters respond DRAMATICALLY to audio
    const tempoInfluence = this.aesthetic.current.speed;

    // MUCH MORE RESPONSIVE: High frequencies dramatically influence sigma
    const sigmaInfluence = (audioFeatures.spectralCentroid / 5000) * 3; // 3x more influence
    const highInfluence = audioFeatures.high * 2; // Direct high frequency boost
    this.sigma = 10 * (1 + tempoInfluence * 2 + sigmaInfluence * 1.5 + highInfluence);

    // MUCH MORE RESPONSIVE: Mid frequencies dramatically influence rho
    const rhoInfluence = audioFeatures.mid * 2.5; // 5x more influence
    const rmsBoost = audioFeatures.rms * 1.5; // Overall energy boost
    this.rho = 28 * (1 + tempoInfluence * 0.5 + rhoInfluence + rmsBoost);

    // MUCH MORE RESPONSIVE: Bass dramatically influences beta
    const betaInfluence = audioFeatures.bass * 1.8; // 6x more influence
    this.beta = (8/3) * (1 + tempoInfluence * 0.3 + betaInfluence);

    // ENHANCED: Much more dramatic rotation response
    const rotationSpeed = 0.003 + (this.aesthetic.current.speed * 0.025) + (audioFeatures.high * 0.015);
    this.rotation += rotationSpeed;

    // ENHANCED: Much more dramatic scale changes with audio
    const audioScaleBoost = (audioFeatures.bass * 40) + (audioFeatures.mid * 30) + (audioFeatures.high * 20);
    const dynamicScale = this.scale + (this.aesthetic.current.speed * 30) + audioScaleBoost;

    // ENHANCED: More dramatic trail length variation
    this.maxPoints = Math.floor(this.baseMaxPoints * (0.5 + audioFeatures.rms * 1.5));

    // Calculate next point
    const dx = this.sigma * (this.y - this.x);
    const dy = this.x * (this.rho - this.z) - this.y;
    const dz = this.x * this.y - this.beta * this.z;

    this.x += dx * this.dt;
    this.y += dy * this.dt;
    this.z += dz * this.dt;

    // Store point
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

      // Rotate points
      const rotatedX = point.x * Math.cos(this.rotation) - point.y * Math.sin(this.rotation);
      const rotatedY = point.x * Math.sin(this.rotation) + point.y * Math.cos(this.rotation);
      const rotatedPrevX = prevPoint.x * Math.cos(this.rotation) - prevPoint.y * Math.sin(this.rotation);
      const rotatedPrevY = prevPoint.x * Math.sin(this.rotation) + prevPoint.y * Math.cos(this.rotation);

      // Map 3D to 2D
      const x1 = rotatedPrevX * dynamicScale;
      const y1 = (rotatedPrevY - prevPoint.z) * dynamicScale * 0.5;
      const x2 = rotatedX * dynamicScale;
      const y2 = (rotatedY - point.z) * dynamicScale * 0.5;

      // Color based on aesthetic warmth + subtle audio influence
      // Warm (country) = burgundy/brown, Cool (urban) = yellow/orange
      const zNormalized = (point.z + 20) / 40;

      // Color cycling influenced by spectral centroid (brighter sounds = faster cycling)
      const colorCycleSpeed = audioFeatures.spectralCentroid / 3000;

      let colorIndex;

      if (point.aestheticWarmth > 0.7) {
        // Country palette - deeper, earthy
        colorIndex = Math.floor((zNormalized * 2) + 4 + colorCycleSpeed) % 7; // Browns, burgundy
      } else if (point.aestheticWarmth < 0.4) {
        // Urban palette - bright, vibrant
        colorIndex = Math.floor(zNormalized * 3 + colorCycleSpeed * 2); // Yellows, oranges
      } else {
        // Transition
        colorIndex = Math.floor(zNormalized * 7 + colorCycleSpeed);
      }

      const progress = i / this.points.length;
      const alpha = progress * (0.6 + audioFeatures.rms * 0.4);

      const color = this.aesthetic.getColor(colorIndex, alpha);
      this.ctx.strokeStyle = color;

      // ENHANCED: MUCH MORE AUDIO-RESPONSIVE THICKNESS
      const baseThickness = this.aesthetic.current.lineThickness;

      // Variation along path
      const pathVariation = Math.sin(i * 0.05) * 5;

      // DRAMATICALLY MORE audio influence
      const audioInfluence = (audioFeatures.rms * 10) + (audioFeatures.bass * 12) + (audioFeatures.mid * 8);

      const lineWidth = baseThickness + pathVariation + audioInfluence;

      this.ctx.lineWidth = lineWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Glow based on aesthetic (more glow in urban for vibrancy)
      let glowAmount = 0;
      if (this.aesthetic.current.speed > 0.6 || audioFeatures.high > 0.3) {
        glowAmount = 12 + (this.aesthetic.current.speed * 25);
      }

      // Enhanced glow during tempo acceleration (urban areas getting faster)
      if (this.aesthetic.tempoAccelerationGlow > 0.2) {
        glowAmount += this.aesthetic.tempoAccelerationGlow * 20;
      }

      // Bright flash on staccato synth hits
      if (this.aesthetic.transientBurst > 0.4) {
        glowAmount += this.aesthetic.transientBurst * 30;
      }

      if (glowAmount > 0) {
        this.ctx.shadowBlur = glowAmount;
        this.ctx.shadowColor = this.aesthetic.getColor(colorIndex, 0.6);
      }

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();

      this.ctx.shadowBlur = 0;
    }

    this.camera.restore(this.ctx);

    // Debug info (optional - shows current aesthetic)
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
    this.ctx.font = '12px monospace';
    const label = `Tempo: ${bpm.toFixed(0)} BPM | Aesthetic: ${this.getAestheticLabel(bpm)}`;
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
