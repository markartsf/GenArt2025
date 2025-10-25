import { FallColors } from '../colorPalette.js';
import { AudioAnalysisV2 } from '../audioAnalysis-v2.js';

class ParticleV2 {
  constructor(x, y, width, height, octaveName, colorIndex) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 3;
    this.vy = (Math.random() - 0.5) * 3;
    this.width = width;
    this.height = height;
    this.colorIndex = colorIndex;
    this.octaveName = octaveName;
    this.life = 1;
    this.maxLife = 1;
    this.age = 0;

    // Octave-specific behaviors
    this.behaviors = {
      subBass: { speed: 0.3, size: 2.0, trail: 0.95 },  // Slow, large, long trails
      bass: { speed: 0.5, size: 1.8, trail: 0.90 },
      lowMid: { speed: 0.8, size: 1.5, trail: 0.85 },
      mid: { speed: 1.2, size: 1.2, trail: 0.80 },
      highMid: { speed: 1.6, size: 0.9, trail: 0.70 },
      presence: { speed: 2.0, size: 0.7, trail: 0.60 }, // Fast, small, short trails
      brilliance: { speed: 2.5, size: 0.5, trail: 0.50 }
    };

    this.behavior = this.behaviors[octaveName] || this.behaviors.mid;
  }

  update(audioFeatures, noiseField, octaveBands) {
    this.age++;

    // Get flow field influence
    const noiseX = Math.floor(this.x / 20) % noiseField.length;
    const noiseY = Math.floor(this.y / 20) % noiseField[0].length;
    const angle = noiseField[noiseX][noiseY] || 0;

    // Octave-specific energy
    const octaveEnergy = octaveBands[this.octaveName]?.energy || 0;

    // Velocity influenced by octave energy and behavior
    const velocityMultiplier = this.behavior.speed * (1 + octaveEnergy * 5);
    const flowForce = 0.3 + octaveEnergy;

    this.vx += Math.cos(angle) * flowForce;
    this.vy += Math.sin(angle) * flowForce;

    // Apply velocity with damping
    this.vx *= 0.96;
    this.vy *= 0.96;

    this.x += this.vx * velocityMultiplier;
    this.y += this.vy * velocityMultiplier;

    // Wrap around edges
    if (this.x < 0) this.x = this.width;
    if (this.x > this.width) this.x = 0;
    if (this.y < 0) this.y = this.height;
    if (this.y > this.height) this.y = 0;

    // Life decay based on behavior
    this.life -= 0.0005 * (1 / this.behavior.trail);
  }

  draw(ctx, audioFeatures, octaveBands) {
    const octaveEnergy = octaveBands[this.octaveName]?.energy || 0;

    // Octave-specific size
    const baseSize = 8 + audioFeatures.bass * 30;
    const size = baseSize * this.behavior.size * (1 + octaveEnergy * 2);

    // Opacity based on life and energy
    const alpha = this.life * (0.5 + octaveEnergy * 1.5);

    // Use octave-specific color
    const color = FallColors.getAudioColor(this.colorIndex, audioFeatures, alpha);

    ctx.fillStyle = color;

    // Dramatic glow based on octave energy
    if (octaveEnergy > 0.2) {
      ctx.shadowBlur = 30 + octaveEnergy * 60;
      ctx.shadowColor = FallColors.getGlowColor(this.colorIndex, octaveEnergy);
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

export class ParticleFieldV2 {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.particles = [];
    this.maxParticles = 400; // More particles in V2
    this.noiseField = [];
    this.noiseTime = 0;
    this.audioAnalyzer = new AudioAnalysisV2();

    this.initializeParticles();
    this.generateNoiseField();
  }

  initializeParticles() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.particles = [];
    // Start with some particles in each octave
    const octaveNames = Object.keys(this.audioAnalyzer.octaves);

    for (let i = 0; i < 100; i++) {
      const octaveName = octaveNames[i % octaveNames.length];
      const colorIndex = this.audioAnalyzer.octaves[octaveName].color;

      this.particles.push(new ParticleV2(
        Math.random() * width,
        Math.random() * height,
        width,
        height,
        octaveName,
        colorIndex
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
        const noise = Math.sin(x * 0.1 + this.noiseTime) *
                     Math.cos(y * 0.1 + this.noiseTime);
        this.noiseField[x][y] = noise * Math.PI * 2;
      }
    }
  }

  reset() {
    this.initializeParticles();
    this.noiseTime = 0;
  }

  draw(audioFeatures) {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // V2: Even slower fade for gorgeous trails
    this.ctx.fillStyle = 'rgba(26, 10, 10, 0.02)';
    this.ctx.fillRect(0, 0, width, height);

    // Enhanced audio analysis
    const octaveBands = this.audioAnalyzer.analyzeOctaveBands(audioFeatures.amplitudeSpectrum);
    const pitch = this.audioAnalyzer.detectPitch(audioFeatures.amplitudeSpectrum);

    // Update noise field
    this.noiseTime += 0.01 + audioFeatures.rms * 0.5;
    if (this.noiseTime % 1 < 0.1) {
      this.generateNoiseField();
    }

    // Update and draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.update(audioFeatures, this.noiseField, octaveBands);
      particle.draw(this.ctx, audioFeatures, octaveBands);

      if (particle.isDead()) {
        this.particles.splice(i, 1);
      }
    }

    // Spawn new particles based on active octaves
    for (const [octaveName, band] of Object.entries(octaveBands)) {
      if (band.energy > 0.15) {
        const spawnCount = Math.floor(band.energy * 8);

        for (let i = 0; i < spawnCount && this.particles.length < this.maxParticles; i++) {
          this.particles.push(new ParticleV2(
            Math.random() * width,
            Math.random() * height,
            width,
            height,
            octaveName,
            band.colorIndex
          ));
        }
      }
    }

    // V2: Draw connections between particles in same octave
    if (audioFeatures.bass > 0.1) {
      const connectionDistance = 100 + audioFeatures.bass * 200;

      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {
          // Only connect particles in same or adjacent octaves
          if (Math.abs(this.particles[i].colorIndex - this.particles[j].colorIndex) > 2) {
            continue;
          }

          const dx = this.particles[i].x - this.particles[j].x;
          const dy = this.particles[i].y - this.particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDistance) {
            const alpha = (1 - dist / connectionDistance) * audioFeatures.bass * 0.9;

            const avgColorIndex = Math.floor((this.particles[i].colorIndex + this.particles[j].colorIndex) / 2);
            const connectionColor = FallColors.getAudioColor(avgColorIndex, audioFeatures, alpha);

            this.ctx.strokeStyle = connectionColor;
            this.ctx.lineWidth = 3 + audioFeatures.bass * 6;
            this.ctx.lineCap = 'round';

            if (audioFeatures.high > 0.3) {
              this.ctx.shadowBlur = 15 + audioFeatures.high * 25;
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
