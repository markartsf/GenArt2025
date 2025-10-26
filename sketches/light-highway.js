import { TempoAnalyzer, AestheticState } from '../aestheticSystem-v3.js';

class LightSource {
  constructor(x, y, width, height, frequencyBand, aesthetic) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.frequencyBand = frequencyBand; // 'bass', 'mid', 'high'

    // Velocity based on frequency band
    // Bass = slow, flowing (like yellow highways)
    // High = fast, erratic (like red/blue streaks)
    const speedBase = frequencyBand === 'bass' ? 1.5 :
                     frequencyBand === 'mid' ? 2.5 : 3.5;
    this.vx = (Math.random() - 0.5) * speedBase;
    this.vy = (Math.random() - 0.5) * speedBase;

    this.life = 1;

    // Color based on frequency band
    if (frequencyBand === 'bass') {
      this.colorIndex = 5; // Warm yellows/oranges
    } else if (frequencyBand === 'mid') {
      this.colorIndex = 0; // Blues/cyans
    } else {
      this.colorIndex = 2; // Reds/magentas
    }

    // Trail history - VERY LONG for motion blur
    this.trail = [];
    this.maxTrailLength = 150; // Long exposure effect
  }

  update(audioFeatures, aesthetic) {
    // Store current position in trail
    this.trail.push({ x: this.x, y: this.y });

    // Limit trail length
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }

    // Audio-reactive speed
    let energy = 0;
    if (this.frequencyBand === 'bass') {
      energy = audioFeatures.bass;
    } else if (this.frequencyBand === 'mid') {
      energy = audioFeatures.mid;
    } else {
      energy = audioFeatures.high;
    }

    // Ensure minimum base velocity so lights never stop moving
    const minSpeed = 0.5;
    if (Math.abs(this.vx) < minSpeed) {
      this.vx = this.vx >= 0 ? minSpeed : -minSpeed;
    }
    if (Math.abs(this.vy) < minSpeed) {
      this.vy = this.vy >= 0 ? minSpeed : -minSpeed;
    }

    // Apply energy to velocity
    const speedMult = 1 + energy * 3;
    this.x += this.vx * speedMult;
    this.y += this.vy * speedMult;

    // Add smooth curves based on audio
    const curvature = Math.sin(Date.now() * 0.001 + this.x * 0.01) * (0.5 + energy * 2);
    this.vy += curvature * 0.1;

    // Much lighter damping to maintain movement
    this.vx *= 0.995;
    this.vy *= 0.995;

    // Wrap around edges
    if (this.x < 0) this.x = this.width;
    if (this.x > this.width) this.x = 0;
    if (this.y < 0) this.y = this.height;
    if (this.y > this.height) this.y = 0;

    // Very slow life decay
    this.life -= 0.0001;
  }

  draw(ctx, aesthetic, audioFeatures) {
    if (this.trail.length < 2) return;

    // Get energy for this frequency band
    let energy = 0;
    if (this.frequencyBand === 'bass') {
      energy = audioFeatures.bass;
    } else if (this.frequencyBand === 'mid') {
      energy = audioFeatures.mid;
    } else {
      energy = audioFeatures.high;
    }

    // Draw trail as glowing lines
    for (let i = 1; i < this.trail.length; i++) {
      const prevPoint = this.trail[i - 1];
      const currPoint = this.trail[i];

      // Trail fade - older = more transparent
      const trailProgress = i / this.trail.length;
      const alpha = trailProgress * this.life * 0.9;

      // Color based on frequency band and aesthetic
      const color = aesthetic.getColor(this.colorIndex, alpha);

      ctx.strokeStyle = color;

      // Line thickness - thicker for bass, thinner for treble
      const baseThickness = this.frequencyBand === 'bass' ? 25 :
                           this.frequencyBand === 'mid' ? 15 : 8;

      // Vary thickness along trail
      const thickness = baseThickness * (0.5 + trailProgress * 0.5) * (0.8 + energy * 0.5);
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Heavy glow effect - like neon lights
      const glowAmount = 30 + energy * 40 + (aesthetic.transientBurst * 50);
      ctx.shadowBlur = glowAmount;
      ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.8);

      // Draw line segment
      ctx.beginPath();
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(currPoint.x, currPoint.y);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
  }

  isDead() {
    return this.life <= 0;
  }
}

export class LightHighway {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.lightSources = [];

    // V3 systems
    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();

    this.initializeLights();
  }

  initializeLights() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.lightSources = [];

    // Create initial light sources - mix of bass, mid, high
    const bands = ['bass', 'bass', 'bass', 'mid', 'mid', 'high', 'high', 'high'];

    for (let i = 0; i < bands.length; i++) {
      this.lightSources.push(new LightSource(
        Math.random() * width,
        Math.random() * height,
        width,
        height,
        bands[i],
        this.aesthetic.current
      ));
    }
  }

  reset() {
    this.initializeLights();
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

    // VERY slow fade for long exposure effect
    this.ctx.fillStyle = `rgba(26, 10, 10, 0.01)`;
    this.ctx.fillRect(0, 0, width, height);

    // Update and draw light sources
    for (let i = this.lightSources.length - 1; i >= 0; i--) {
      const light = this.lightSources[i];
      light.update(audioFeatures, this.aesthetic.current);
      light.draw(this.ctx, this.aesthetic, audioFeatures);

      if (light.isDead()) {
        this.lightSources.splice(i, 1);
      }
    }

    // Add new lights on transient bursts
    if (this.aesthetic.transientBurst > 0.6 && this.lightSources.length < 20) {
      const bands = ['bass', 'mid', 'high'];
      const randomBand = bands[Math.floor(Math.random() * bands.length)];

      this.lightSources.push(new LightSource(
        Math.random() * width,
        Math.random() * height,
        width,
        height,
        randomBand,
        this.aesthetic.current
      ));
    }

    // Maintain minimum number of lights
    const minLights = 6 + Math.floor(this.aesthetic.current.density * 6);
    while (this.lightSources.length < minLights) {
      const bands = ['bass', 'mid', 'high'];
      const randomBand = bands[Math.floor(Math.random() * bands.length)];

      this.lightSources.push(new LightSource(
        Math.random() * width,
        Math.random() * height,
        width,
        height,
        randomBand,
        this.aesthetic.current
      ));
    }

    // Debug info
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
    this.ctx.font = '12px monospace';
    const label = `Tempo: ${bpm.toFixed(0)} BPM | Light Sources: ${this.lightSources.length} | ${this.getAestheticLabel(bpm)}`;
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
