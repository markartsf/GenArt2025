import { FallColors, Camera } from '../colorPalette.js';

class Particle {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.width = width;
    this.height = height;
    this.colorIndex = Math.floor(Math.random() * FallColors.palette.length);
    this.life = 1;
    this.maxLife = 1;
  }

  update(audioFeatures, noiseField) {
    // Get flow field influence from noise
    const noiseX = Math.floor(this.x / 20) % noiseField.length;
    const noiseY = Math.floor(this.y / 20) % noiseField[0].length;
    const angle = noiseField[noiseX][noiseY] || 0;

    // Audio-reactive velocity
    const velocityMultiplier = 1 + audioFeatures.mid * 5;
    const flowForce = 0.5 + audioFeatures.spectralCentroid / 10000;

    this.vx += Math.cos(angle) * flowForce;
    this.vy += Math.sin(angle) * flowForce;

    // Apply velocity with damping
    this.vx *= 0.95;
    this.vy *= 0.95;

    this.x += this.vx * velocityMultiplier;
    this.y += this.vy * velocityMultiplier;

    // Wrap around edges
    if (this.x < 0) this.x = this.width;
    if (this.x > this.width) this.x = 0;
    if (this.y < 0) this.y = this.height;
    if (this.y > this.height) this.y = 0;

    // Cycle through fall colors based on audio
    if (audioFeatures.high > 0.3) {
      this.colorIndex = (this.colorIndex + 1) % FallColors.palette.length;
    }

    // Reduce life much more slowly for longer trails
    this.life -= 0.0008;
  }

  draw(ctx, audioFeatures) {
    // Much larger size based on bass - more dramatic
    const size = 5 + audioFeatures.bass * 25;

    // Opacity based on life and RMS
    const alpha = this.life * (0.5 + audioFeatures.rms * 1.5);

    // Fall color with audio influence
    const color = FallColors.getAudioColor(this.colorIndex, audioFeatures, alpha);

    ctx.fillStyle = color;

    // Add glow for drama
    if (audioFeatures.bass > 0.2) {
      ctx.shadowBlur = 20 + audioFeatures.bass * 40;
      ctx.shadowColor = FallColors.getGlowColor(this.colorIndex, audioFeatures.bass);
    }

    ctx.beginPath();
    ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  isDead() {
    return this.life <= 0;
  }
}

export class ParticleField {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.particles = [];
    this.maxParticles = 300;
    this.noiseField = [];
    this.noiseTime = 0;
    this.camera = new Camera();
    this.initializeParticles();
    this.generateNoiseField();
  }

  initializeParticles() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push(new Particle(
        Math.random() * width,
        Math.random() * height,
        width,
        height
      ));
    }
  }

  generateNoiseField() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    const cols = Math.ceil(width / 20);
    const rows = Math.ceil(height / 20);

    this.noiseField = [];
    for (let x = 0; x < cols; x++) {
      this.noiseField[x] = [];
      for (let y = 0; y < rows; y++) {
        // Simple noise using sine waves
        const noise = Math.sin(x * 0.1 + this.noiseTime) *
                     Math.cos(y * 0.1 + this.noiseTime);
        this.noiseField[x][y] = noise * Math.PI * 2;
      }
    }
  }

  reset() {
    this.initializeParticles();
    this.noiseTime = 0;
    this.camera.reset();
  }

  draw(audioFeatures) {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Clear with fall background fade - much slower fade for longer trails
    this.ctx.fillStyle = 'rgba(26, 10, 10, 0.03)';
    this.ctx.fillRect(0, 0, width, height);

    // Update noise field based on audio
    this.noiseTime += 0.01 + audioFeatures.rms * 0.5;
    if (this.noiseTime % 1 < 0.1) {
      this.generateNoiseField();
    }

    // Update and draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.update(audioFeatures, this.noiseField);
      particle.draw(this.ctx, audioFeatures);

      // Remove dead particles
      if (particle.isDead()) {
        this.particles.splice(i, 1);
      }
    }

    // Add new particles based on audio intensity
    const newParticleCount = Math.floor(audioFeatures.bass * 10 + audioFeatures.rms * 5);
    for (let i = 0; i < newParticleCount && this.particles.length < this.maxParticles; i++) {
      this.particles.push(new Particle(
        Math.random() * width,
        Math.random() * height,
        width,
        height
      ));
    }

    // Draw connections between nearby particles - more dramatic
    if (audioFeatures.bass > 0.15) {
      const connectionDistance = 80 + audioFeatures.bass * 150;
      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {
          const dx = this.particles[i].x - this.particles[j].x;
          const dy = this.particles[i].y - this.particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDistance) {
            const alpha = (1 - dist / connectionDistance) * audioFeatures.bass * 0.8;

            // Use fall colors for connections
            const avgColorIndex = Math.floor((this.particles[i].colorIndex + this.particles[j].colorIndex) / 2);
            const connectionColor = FallColors.getAudioColor(avgColorIndex, audioFeatures, alpha);

            this.ctx.strokeStyle = connectionColor;
            this.ctx.lineWidth = 2 + audioFeatures.bass * 4;
            this.ctx.lineCap = 'round';

            // Add glow to connections
            if (audioFeatures.high > 0.3) {
              this.ctx.shadowBlur = 10 + audioFeatures.high * 20;
              this.ctx.shadowColor = FallColors.getGlowColor(avgColorIndex, audioFeatures.high);
            }

            this.ctx.beginPath();
            this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
            this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
            this.ctx.stroke();

            this.ctx.shadowBlur = 0;
          }
        }
      }
    }
  }
}
