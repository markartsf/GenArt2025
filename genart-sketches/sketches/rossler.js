import { FallColors, Camera } from '../colorPalette.js';

export class RosslerAttractor {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.points = [];
    this.maxPoints = 7000;

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

    // Scale and offset for drawing (much larger for visibility)
    this.scale = 40;
    this.rotationX = 0;
    this.rotationY = 0;
    this.rotationZ = 0;

    // Camera for dramatic movement
    this.camera = new Camera();
  }

  reset() {
    this.points = [];
    this.x = 0.1;
    this.y = 0;
    this.z = 0;
    this.rotationX = 0;
    this.rotationY = 0;
    this.rotationZ = 0;
    this.camera.reset();
  }

  draw(audioFeatures) {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Clear with fall background fade
    this.ctx.fillStyle = 'rgba(26, 10, 10, 0.05)';
    this.ctx.fillRect(0, 0, width, height);

    // Audio-reactive parameters - more dramatic
    const bassModulation = 1 + audioFeatures.bass * 0.8;
    const midModulation = 1 + audioFeatures.mid * 0.5;
    const highModulation = 1 + audioFeatures.high * 1.5;

    this.a = 0.2 * bassModulation;
    this.b = 0.2 * midModulation;
    this.c = 5.7 * highModulation;

    // Multi-axis rotation based on different audio features - slower
    this.rotationX += (audioFeatures.spectralCentroid / 10000) * 0.004;
    this.rotationY += audioFeatures.rms * 0.015;
    this.rotationZ += (audioFeatures.zcr / 100) * 0.008;

    // Scale based on RMS and bass - increased for drama
    const dynamicScale = this.scale + (audioFeatures.rms * 45) + (audioFeatures.bass * 25);

    // Calculate next point in the attractor
    const dx = -this.y - this.z;
    const dy = this.x + this.a * this.y;
    const dz = this.b + this.z * (this.x - this.c);

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

      // Fall colors based on position and audio - much better variety
      const progress = i / this.points.length;
      const zNormalized = (point.z + 10) / 20;
      const xNormalized = (point.x + 10) / 20;
      // Combine multiple factors for color variety
      const colorIndex = Math.floor((zNormalized * 2 + xNormalized * 2 + progress * 3) * FallColors.palette.length) % FallColors.palette.length;

      const alpha = progress * (0.6 + audioFeatures.rms * 0.4);
      const color = FallColors.getAudioColor(colorIndex, audioFeatures, alpha);

      this.ctx.strokeStyle = color;

      // Much thicker lines with bass response
      this.ctx.lineWidth = 4 + audioFeatures.bass * 12;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Add dramatic glow effect
      if (audioFeatures.high > 0.15 || audioFeatures.bass > 0.25) {
        this.ctx.shadowBlur = 20 + audioFeatures.high * 40 + audioFeatures.bass * 30;
        this.ctx.shadowColor = FallColors.getGlowColor(colorIndex, Math.max(audioFeatures.high, audioFeatures.bass));
      }

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();

      this.ctx.shadowBlur = 0;
    }

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
}
