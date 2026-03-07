import { FallColors, Camera } from '../colorPalette.js';

export class LorenzAttractor {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.points = [];
    this.maxPoints = 5000;

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

    // Scale and offset for drawing (increased for more visibility)
    this.scale = 10;
    this.rotation = 0;

    // Camera for dramatic movement
    this.camera = new Camera();
  }

  reset() {
    this.points = [];
    this.x = 0.1;
    this.y = 0;
    this.z = 0;
    this.rotation = 0;
    this.camera.reset();
  }

  draw(audioFeatures) {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Clear with fall background fade
    this.ctx.fillStyle = 'rgba(26, 10, 10, 0.08)';
    this.ctx.fillRect(0, 0, width, height);

    // Audio-reactive parameters - more dramatic
    const bassModulation = 1 + audioFeatures.bass * 3;
    const midModulation = 1 + audioFeatures.mid * 15;
    const highModulation = 1 + audioFeatures.high * 0.8;

    this.sigma = 10 * bassModulation;
    this.rho = 28 * midModulation;
    this.beta = (8/3) * highModulation;

    // Rotation based on spectral centroid - slower for visibility
    this.rotation += (audioFeatures.spectralCentroid / 10000) * 0.008;

    // Scale based on RMS - increased for more drama
    const dynamicScale = this.scale + audioFeatures.rms * 35;

    // Calculate next point in the attractor
    const dx = this.sigma * (this.y - this.x);
    const dy = this.x * (this.rho - this.z) - this.y;
    const dz = this.x * this.y - this.beta * this.z;

    this.x += dx * this.dt;
    this.y += dy * this.dt;
    this.z += dz * this.dt;

    // Store point
    this.points.push({ x: this.x, y: this.y, z: this.z });
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }

    // Draw the attractor properly centered
    this.ctx.save();
    this.ctx.translate(width / 2, height / 2);

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

      // Fall colors based on position and audio - better variety
      const progress = i / this.points.length;
      const zNormalized = (point.z + 20) / 40; // Normalize z position
      const colorIndex = Math.floor((zNormalized * 3 + progress * 2) * FallColors.palette.length) % FallColors.palette.length;
      const color = FallColors.getAudioColor(colorIndex, audioFeatures, progress * (0.7 + audioFeatures.rms * 0.3));

      this.ctx.strokeStyle = color;

      // Much thicker lines with bass response
      this.ctx.lineWidth = 4 + audioFeatures.bass * 10;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Add glow effect for drama
      if (audioFeatures.high > 0.2 || audioFeatures.bass > 0.3) {
        this.ctx.shadowBlur = 15 + audioFeatures.bass * 30;
        this.ctx.shadowColor = FallColors.getGlowColor(colorIndex, audioFeatures.bass);
      }

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();

      this.ctx.shadowBlur = 0;
    }

    this.ctx.restore();
  }
}
