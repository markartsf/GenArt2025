import { TempoAnalyzer, AestheticState, OrbitingCamera } from '../aestheticSystem-v3.js';

class SpiralPoint {
  constructor(radius, angle, octave, pitch, aesthetic) {
    this.radius = radius;
    this.angle = angle;
    this.octave = octave; // 0-7
    this.pitch = pitch; // 0-1 normalized
    this.life = 1;
    this.maxLife = 1;

    // Color based on aesthetic warmth
    this.warmth = aesthetic.warmth;

    // Size based on octave (MUCH BIGGER)
    this.size = 8 + octave * 3;
  }

  update(aesthetic) {
    // Update warmth to match current aesthetic
    this.warmth += (aesthetic.warmth - this.warmth) * 0.05;

    // Life decay (much slower for longer, more visible spirals)
    const decay = 0.0005 + (aesthetic.speed * 0.001);
    this.life -= decay;
  }

  isDead() {
    return this.life <= 0;
  }
}

export class SpiralGalaxy {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.spiralArms = []; // Array of arrays, one per octave

    // V3 systems
    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();
    this.camera = new OrbitingCamera();

    // Spiral parameters
    this.globalRotation = 0;
    this.radiusGrowth = 0;
    this.timeCounter = 0;

    // Initialize 8 octave spirals
    for (let i = 0; i < 8; i++) {
      this.spiralArms[i] = [];
    }
  }

  reset() {
    for (let i = 0; i < 8; i++) {
      this.spiralArms[i] = [];
    }
    this.globalRotation = 0;
    this.radiusGrowth = 0;
    this.timeCounter = 0;
    this.tempoAnalyzer.reset();
    this.aesthetic.reset();
    this.camera.reset();
  }

  // Detect dominant pitch from spectrum
  detectPitch(spectrum) {
    let maxMagnitude = 0;
    let maxBin = 0;

    // Find peak in spectrum
    for (let i = 5; i < spectrum.length; i++) {
      if (spectrum[i] > maxMagnitude) {
        maxMagnitude = spectrum[i];
        maxBin = i;
      }
    }

    // Convert bin to approximate frequency
    const sampleRate = 44100;
    const frequency = (maxBin * sampleRate) / (spectrum.length * 2);

    // Map frequency to octave (A0 = 27.5 Hz, A7 = 3520 Hz)
    const octave = Math.floor(Math.log2(frequency / 27.5));
    const clampedOctave = Math.max(0, Math.min(7, octave));

    // Pitch within octave (0-1)
    const pitchInOctave = (frequency / 27.5 / Math.pow(2, octave)) % 1;

    return {
      octave: clampedOctave,
      pitch: pitchInOctave,
      frequency: frequency,
      magnitude: maxMagnitude
    };
  }

  draw(audioFeatures) {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Analyze tempo
    const bpm = this.tempoAnalyzer.analyze(audioFeatures);

    // Update aesthetic state
    this.aesthetic.updateTempo(bpm);
    this.aesthetic.update(this.tempoAnalyzer);

    // Adaptive fade
    this.ctx.fillStyle = `rgba(26, 10, 10, ${this.aesthetic.current.trailFade + 0.02})`;
    this.ctx.fillRect(0, 0, width, height);

    // Increment time for continuous generation
    this.timeCounter++;

    // Detect current pitch
    const pitchInfo = this.detectPitch(audioFeatures.amplitudeSpectrum);

    // Global rotation based on aesthetic
    // Country = slow rotation, Urban = fast rotation
    const rotationSpeed = 0.005 + (this.aesthetic.current.speed * 0.025);
    this.globalRotation += rotationSpeed;

    // Radius growth based on tempo and audio energy (MUCH FASTER)
    const growthRate = 2.5 + (this.aesthetic.current.speed * 5) + (audioFeatures.rms * 8);
    this.radiusGrowth += growthRate;

    // Spiral tightness (loose in country, tight in urban)
    const spiralTightness = 0.08 + (this.aesthetic.current.speed * 0.25);

    // Reset radius growth when it gets too large to keep spirals on screen
    if (this.radiusGrowth > 400) {
      this.radiusGrowth = 0;
    }

    // Add new points continuously - ALWAYS generate to ensure visible spirals
    // Use pitch info to emphasize certain octaves, but always generate multiple arms
    const primaryOctave = pitchInfo.magnitude > 0.05 ? pitchInfo.octave : 3;

    // Generate 3-5 arms per frame for fuller spirals
    const octavesToGenerate = [
      primaryOctave,
      (primaryOctave + 1) % 8,
      (primaryOctave + 2) % 8,
      (primaryOctave + 4) % 8
    ];

    // Add extra arms when audio is strong
    if (audioFeatures.rms > 0.05) {
      octavesToGenerate.push((primaryOctave + 3) % 8);
    }

    for (const octave of octavesToGenerate) {
      // Each octave gets its own spiral arm offset
      const armOffset = (octave / 8) * Math.PI * 2;

      // Calculate spiral position (MUCH LARGER RADIUS)
      const angle = this.globalRotation + armOffset + (pitchInfo.pitch * Math.PI * 0.5);
      const radius = this.radiusGrowth + (octave * 40); // Much larger spacing

      this.spiralArms[octave].push(new SpiralPoint(
        radius,
        angle,
        octave,
        pitchInfo.pitch,
        this.aesthetic.current
      ));
    }

    // Transient bursts create extra points across all active octaves
    if (this.aesthetic.transientBurst > 0.6) {
      for (let oct = 0; oct < 8; oct++) {
        const armOffset = (oct / 8) * Math.PI * 2;
        const angle = this.globalRotation + armOffset;
        const radius = this.radiusGrowth + (oct * 40); // Larger radius

        this.spiralArms[oct].push(new SpiralPoint(
          radius,
          angle,
          oct,
          Math.random(),
          this.aesthetic.current
        ));
      }
    }

    // Center coordinate system (no camera orbit to avoid disorienting rotation)
    this.ctx.save();
    this.ctx.translate(width / 2, height / 2);

    // Draw each octave spiral
    for (let octave = 0; octave < 8; octave++) {
      const arm = this.spiralArms[octave];

      // Update and remove dead points
      for (let i = arm.length - 1; i >= 0; i--) {
        const point = arm[i];
        point.update(this.aesthetic.current);

        if (point.isDead()) {
          arm.splice(i, 1);
        }
      }

      // Draw spiral points
      for (let i = 0; i < arm.length; i++) {
        const point = arm[i];

        // Calculate spiral position
        const spiralAngle = point.angle + (point.radius * spiralTightness);
        const x = Math.cos(spiralAngle) * point.radius;
        const y = Math.sin(spiralAngle) * point.radius;

        // Color based on octave and aesthetic warmth
        const colorIndex = Math.floor((octave / 8) * 7 + point.warmth * 2) % 7;
        const alpha = point.life * 0.7;
        const color = this.aesthetic.getColor(colorIndex, alpha);

        this.ctx.fillStyle = color;

        // Size based on octave and life
        const size = point.size * (0.7 + point.life * 0.3);

        // Glow in urban mode or on transient bursts
        let glowAmount = 0;
        if (this.aesthetic.current.speed > 0.6) {
          glowAmount = 10 + (this.aesthetic.current.speed * 20);
        }
        if (this.aesthetic.tempoAccelerationGlow > 0.2) {
          glowAmount += this.aesthetic.tempoAccelerationGlow * 15;
        }
        if (this.aesthetic.transientBurst > 0.4) {
          glowAmount += this.aesthetic.transientBurst * 25;
        }

        if (glowAmount > 0) {
          this.ctx.shadowBlur = glowAmount;
          this.ctx.shadowColor = this.aesthetic.getColor(colorIndex, 0.6);
        }

        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.shadowBlur = 0;

        // Draw connections between ALL nearby points in same arm for fuller spirals
        if (i > 0) {
          const prevPoint = arm[i - 1];
          const prevSpiralAngle = prevPoint.angle + (prevPoint.radius * spiralTightness);
          const prevX = Math.cos(prevSpiralAngle) * prevPoint.radius;
          const prevY = Math.sin(prevSpiralAngle) * prevPoint.radius;

          const connectionAlpha = Math.min(point.life, prevPoint.life) * 0.6;
          const connectionColor = this.aesthetic.getColor(colorIndex, connectionAlpha);

          this.ctx.strokeStyle = connectionColor;
          // MUCH thicker lines for visible spirals
          this.ctx.lineWidth = 6 + (this.aesthetic.current.lineThickness * 0.3);
          this.ctx.lineCap = 'round';

          // Add glow to connection lines too
          if (glowAmount > 0) {
            this.ctx.shadowBlur = glowAmount * 0.5;
            this.ctx.shadowColor = this.aesthetic.getColor(colorIndex, 0.4);
          }

          this.ctx.beginPath();
          this.ctx.moveTo(prevX, prevY);
          this.ctx.lineTo(x, y);
          this.ctx.stroke();

          this.ctx.shadowBlur = 0;
        }
      }
    }

    // Draw central core (pulsing with bass) - MUCH BIGGER
    const coreRadius = 25 + (audioFeatures.bass * 80) + (this.aesthetic.current.speed * 30);
    const coreColor = this.aesthetic.getColor(
      Math.floor(this.aesthetic.current.warmth * 7),
      0.8
    );

    this.ctx.fillStyle = coreColor;

    const coreGlow = 40 + (audioFeatures.bass * 60) + (this.aesthetic.transientBurst * 70);
    this.ctx.shadowBlur = coreGlow;
    this.ctx.shadowColor = this.aesthetic.getColor(
      Math.floor(this.aesthetic.current.warmth * 7),
      0.7
    );

    this.ctx.beginPath();
    this.ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Core outline
    this.ctx.strokeStyle = this.aesthetic.getColor(0, 0.9);
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    this.ctx.shadowBlur = 0;

    this.ctx.restore();

    // Debug info
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
    this.ctx.font = '12px monospace';
    const totalPoints = this.spiralArms.reduce((sum, arm) => sum + arm.length, 0);
    const label = `Tempo: ${bpm.toFixed(0)} BPM | Points: ${totalPoints} | Octave: ${pitchInfo.octave} | ${this.getAestheticLabel(bpm)}`;
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
