import { TempoAnalyzer, AestheticState, OrbitingCamera } from '../aestheticSystem-v3.js';

class ParticleV3 {
  constructor(x, y, width, height, aesthetic) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    // Velocity based on aesthetic (faster in urban, slower in country)
    // Increased for better screen coverage
    const speedFactor = 2 + aesthetic.speed * 4;
    this.vx = (Math.random() - 0.5) * speedFactor;
    this.vy = (Math.random() - 0.5) * speedFactor;

    this.life = 1;
    this.maxLife = 1;

    // Size varies with aesthetic (larger in country, smaller in urban)
    this.baseSize = 12 - (aesthetic.speed * 5);

    // Trail history for motion blur effect - using circular buffer
    this.maxTrailLength = 25; // Shorter trails for better performance
    this.trail = new Array(this.maxTrailLength);
    for (let i = 0; i < this.maxTrailLength; i++) {
      this.trail[i] = { x: 0, y: 0 };
    }
    this.trailIndex = 0;
    this.trailCount = 0; // Track how many valid trail points we have

    // Color - assign random color from palette for variety (now 12 colors)
    this.colorIndex = Math.floor(Math.random() * 12);
  }

  update(aesthetic, noiseField, transientBurst) {
    // Store current position in trail before moving - circular buffer
    this.trail[this.trailIndex].x = this.x;
    this.trail[this.trailIndex].y = this.y;
    this.trailIndex = (this.trailIndex + 1) % this.maxTrailLength;
    if (this.trailCount < this.maxTrailLength) {
      this.trailCount++;
    }

    // Get flow field influence from noise
    const noiseX = Math.floor(this.x / 20) % noiseField.length;
    const noiseY = Math.floor(this.y / 20) % noiseField[0].length;
    const angle = noiseField[noiseX][noiseY] || 0;

    // Flow force based on aesthetic density (increased for better movement)
    const flowForce = 0.8 + aesthetic.density * 1.5;

    this.vx += Math.cos(angle) * flowForce;
    this.vy += Math.sin(angle) * flowForce;

    // Apply velocity with damping
    const damping = 0.92 + (aesthetic.speed * 0.06); // Less damping in urban
    this.vx *= damping;
    this.vy *= damping;

    // Speed multiplier based on aesthetic
    const speedMult = 0.8 + aesthetic.speed * 1.5;
    this.x += this.vx * speedMult;
    this.y += this.vy * speedMult;

    // Burst effect on transients
    if (transientBurst > 0.5) {
      const burstAngle = Math.random() * Math.PI * 2;
      this.vx += Math.cos(burstAngle) * transientBurst * 3;
      this.vy += Math.sin(burstAngle) * transientBurst * 3;
    }

    // Wrap around edges
    if (this.x < 0) this.x = this.width;
    if (this.x > this.width) this.x = 0;
    if (this.y < 0) this.y = this.height;
    if (this.y > this.height) this.y = 0;

    // Life decay (slower in country for longer trails)
    const decay = 0.0005 + (aesthetic.speed * 0.001);
    this.life -= decay;
  }

  draw(ctx, aesthetic) {
    // Draw motion blur trail - like long exposure photography
    if (this.trailCount < 2) return;

    // Pre-calculate glow settings once
    const useGlow = aesthetic.current.speed > 0.6 || aesthetic.transientBurst > 0.3;
    const glowAmount = useGlow ? 8 + (aesthetic.current.speed * 15) + (aesthetic.transientBurst * 20) : 0;
    const shadowColor = useGlow ? aesthetic.getColor(this.colorIndex, 0.6) : null;

    // Set common properties once
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Read from circular buffer in correct order (oldest to newest)
    const startIdx = this.trailCount < this.maxTrailLength ? 0 : this.trailIndex;

    // Draw trail segments
    for (let i = 1; i < this.trailCount; i++) {
      const prevIdx = (startIdx + i - 1) % this.maxTrailLength;
      const currIdx = (startIdx + i) % this.maxTrailLength;
      const prevPoint = this.trail[prevIdx];
      const currPoint = this.trail[currIdx];

      // Trail fade: older parts are more transparent
      const trailProgress = i / this.trailCount;
      const alpha = trailProgress * this.life * 0.8;

      // Color from palette - each particle has its own color
      ctx.strokeStyle = aesthetic.getColor(this.colorIndex, alpha);

      // Line thickness based on trail position (thicker at front)
      ctx.lineWidth = 2 + (trailProgress * 4);

      // Apply glow if needed (only set once per particle)
      if (useGlow && i === 1) {
        ctx.shadowBlur = glowAmount;
        ctx.shadowColor = shadowColor;
      }

      ctx.beginPath();
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(currPoint.x, currPoint.y);
      ctx.stroke();
    }

    // Clear shadow once at the end
    if (useGlow) {
      ctx.shadowBlur = 0;
    }
  }

  isDead() {
    return this.life <= 0;
  }
}

export class ParticleFieldV3 {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.particles = [];
    this.maxParticles = 250; // Optimized for performance
    this.noiseField = [];
    this.noiseTime = 0;

    // V3 systems
    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();
    // No camera orbit for particles - let them fill the full frame

    this.initializeParticles();
    this.generateNoiseField();
  }

  initializeParticles() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.particles = [];
    // Start with moderate number
    for (let i = 0; i < 150; i++) {
      this.particles.push(new ParticleV3(
        Math.random() * width,
        Math.random() * height,
        width,
        height,
        this.aesthetic.current
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
        // Noise pattern based on aesthetic
        const noise = Math.sin(x * 0.1 + this.noiseTime) *
                     Math.cos(y * 0.1 + this.noiseTime);
        this.noiseField[x][y] = noise * Math.PI * 2;
      }
    }
  }

  reset() {
    this.initializeParticles();
    this.noiseTime = 0;
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

    // Adaptive fade based on aesthetic
    this.ctx.fillStyle = `rgba(26, 10, 10, ${this.aesthetic.current.trailFade})`;
    this.ctx.fillRect(0, 0, width, height);

    // Update noise field (slower in country, faster in urban)
    const noiseSpeed = 0.008 + (this.aesthetic.current.speed * 0.02);
    this.noiseTime += noiseSpeed;
    if (this.noiseTime % 1 < 0.05) {
      this.generateNoiseField();
    }

    // Update and draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.update(
        this.aesthetic.current,
        this.noiseField,
        this.aesthetic.transientBurst
      );
      particle.draw(this.ctx, this.aesthetic);

      // Remove dead particles
      if (particle.isDead()) {
        this.particles.splice(i, 1);
      }
    }

    // Add new particles based on aesthetic density
    // More in urban (high density), fewer in country (low density)
    const targetCount = Math.floor(100 + this.aesthetic.current.density * 150);
    const particleDeficit = targetCount - this.particles.length;

    if (particleDeficit > 0) {
      const spawnRate = Math.min(5, Math.ceil(particleDeficit / 20));
      for (let i = 0; i < spawnRate; i++) {
        this.particles.push(new ParticleV3(
          Math.random() * width,
          Math.random() * height,
          width,
          height,
          this.aesthetic.current
        ));
      }
    }

    // Burst particles on transient hits
    if (this.aesthetic.transientBurst > 0.6) {
      const burstCount = Math.floor(this.aesthetic.transientBurst * 15);
      for (let i = 0; i < burstCount && this.particles.length < this.maxParticles; i++) {
        this.particles.push(new ParticleV3(
          Math.random() * width,
          Math.random() * height,
          width,
          height,
          this.aesthetic.current
        ));
      }
    }


    // Debug info
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
    this.ctx.font = '12px monospace';
    const label = `Tempo: ${bpm.toFixed(0)} BPM | Particles: ${this.particles.length} | ${this.getAestheticLabel(bpm)}`;
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
