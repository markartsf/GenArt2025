import { TempoAnalyzer, AestheticState, OrbitingCamera } from '../aestheticSystem-v3.js';

class KaleidoscopeShape {
  constructor(points, colorIndex, aesthetic) {
    this.points = points; // Array of {x, y} relative to center
    this.colorIndex = colorIndex;
    this.life = 1;
    this.maxLife = 1;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.02;
    this.scale = 1;
    this.warmth = aesthetic.warmth;
  }

  update(aesthetic) {
    this.rotation += this.rotationSpeed;
    this.warmth += (aesthetic.warmth - this.warmth) * 0.05;

    // Life decay
    this.life -= 0.002 + (aesthetic.speed * 0.003);

    // Scale changes
    this.scale += 0.005;
  }

  isDead() {
    return this.life <= 0;
  }
}

export class ChromaticKaleidoscope {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.shapes = [];

    // V3 systems
    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();
    this.camera = new OrbitingCamera();

    // Kaleidoscope parameters
    this.symmetryOrder = 6; // Number of reflections (6-fold symmetry)
    this.globalRotation = 0;
    this.frameCount = 0;
  }

  reset() {
    this.shapes = [];
    this.symmetryOrder = 6;
    this.globalRotation = 0;
    this.frameCount = 0;
    this.tempoAnalyzer.reset();
    this.aesthetic.reset();
    this.camera.reset();
  }

  // Detect dominant frequencies and map to pitch classes
  detectPitchClass(spectrum) {
    // Find top 3 peaks in spectrum
    const peaks = [];

    for (let i = 10; i < spectrum.length - 10; i++) {
      if (spectrum[i] > spectrum[i - 1] && spectrum[i] > spectrum[i + 1] && spectrum[i] > 0.1) {
        peaks.push({ bin: i, magnitude: spectrum[i] });
      }
    }

    // Sort by magnitude
    peaks.sort((a, b) => b.magnitude - a.magnitude);

    if (peaks.length === 0) {
      return { pitchClass: 0, harmony: 0 };
    }

    // Convert top peak to frequency
    const sampleRate = 44100;
    const frequency = (peaks[0].bin * sampleRate) / (spectrum.length * 2);

    // Map to pitch class (0-11 for C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
    const noteNumber = 12 * Math.log2(frequency / 440) + 69; // MIDI note number
    const pitchClass = Math.floor(noteNumber % 12);

    // Calculate harmony (presence of multiple strong peaks indicates harmony)
    const harmonyScore = peaks.length >= 2 ? peaks[1].magnitude / peaks[0].magnitude : 0;

    return {
      pitchClass: Math.max(0, Math.min(11, pitchClass)),
      harmony: harmonyScore,
      numPeaks: peaks.length
    };
  }

  // Create shape from waveform sample
  createShapeFromWaveform(waveform, radius, colorIndex) {
    const points = [];
    const sampleStep = Math.floor(waveform.length / 32); // 32 points

    for (let i = 0; i < waveform.length; i += sampleStep) {
      const angle = (i / waveform.length) * Math.PI * 2;
      const amplitude = waveform[i];

      // Distance from center based on amplitude
      const distance = radius + (amplitude * radius * 0.8);

      points.push({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance
      });
    }

    return new KaleidoscopeShape(points, colorIndex, this.aesthetic.current);
  }

  // Create geometric shape based on aesthetic
  createGeometricShape(radius, sides, colorIndex) {
    const points = [];

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const distance = radius * (0.8 + Math.random() * 0.4);

      points.push({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance
      });
    }

    return new KaleidoscopeShape(points, colorIndex, this.aesthetic.current);
  }

  drawShapeWithSymmetry(shape, aesthetic) {
    const alpha = shape.life * 0.6;
    const color = aesthetic.getColor(shape.colorIndex, alpha);

    this.ctx.strokeStyle = color;
    // Much lower fill opacity for translucent layering effect
    this.ctx.fillStyle = aesthetic.getColor(shape.colorIndex, alpha * 0.1);

    // Line thickness based on aesthetic
    const lineWidth = 2 + (aesthetic.current.lineThickness * 0.1);
    this.ctx.lineWidth = lineWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Glow in urban mode
    let glowAmount = 0;
    if (aesthetic.current.speed > 0.6) {
      glowAmount = 12 + (aesthetic.current.speed * 20);
    }
    if (aesthetic.tempoAccelerationGlow > 0.2) {
      glowAmount += aesthetic.tempoAccelerationGlow * 18;
    }
    if (aesthetic.transientBurst > 0.4) {
      glowAmount += aesthetic.transientBurst * 25;
    }

    if (glowAmount > 0) {
      this.ctx.shadowBlur = glowAmount;
      this.ctx.shadowColor = aesthetic.getColor(shape.colorIndex, 0.6);
    }

    // Draw with radial symmetry
    for (let sym = 0; sym < this.symmetryOrder; sym++) {
      const symAngle = (sym / this.symmetryOrder) * Math.PI * 2;

      this.ctx.save();
      this.ctx.rotate(symAngle + shape.rotation);
      this.ctx.scale(shape.scale, shape.scale);

      this.ctx.beginPath();
      for (let i = 0; i < shape.points.length; i++) {
        const point = shape.points[i];
        if (i === 0) {
          this.ctx.moveTo(point.x, point.y);
        } else {
          this.ctx.lineTo(point.x, point.y);
        }
      }
      this.ctx.closePath();

      this.ctx.stroke();
      this.ctx.fill();

      this.ctx.restore();
    }

    this.ctx.shadowBlur = 0;
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

    // Frame counter for color variety
    this.frameCount++;

    // Adaptive fade
    this.ctx.fillStyle = `rgba(26, 10, 10, ${this.aesthetic.current.trailFade + 0.03})`;
    this.ctx.fillRect(0, 0, width, height);

    // Detect pitch class and harmony
    const musicalInfo = this.detectPitchClass(audioFeatures.amplitudeSpectrum);

    // Update symmetry order based on harmony and aesthetic
    // Country = 3-6 fold symmetry (simple)
    // Urban = 8-16 fold symmetry (complex)
    const baseSymmetry = Math.floor(3 + this.aesthetic.current.speed * 10);

    // Harmony adds to symmetry
    const harmonyBonus = Math.floor(musicalInfo.harmony * 4);
    this.symmetryOrder = baseSymmetry + harmonyBonus;

    // Slow global rotation
    const rotationSpeed = 0.001 + (this.aesthetic.current.speed * 0.008);
    this.globalRotation += rotationSpeed;

    // Create new shapes more frequently for more layers (every 3 frames)
    const shouldCreateShape = audioFeatures.rms > 0.02 || this.frameCount % 3 === 0;

    if (shouldCreateShape) {
      // Map pitch class to color index - cycle through colors for variety
      // Use frame count to ensure color variety even if pitch detection fails
      const colorIndex = Math.floor(((musicalInfo.pitchClass + this.frameCount * 0.1) / 12) * 7) % 7;

      // Shape radius based on RMS (MUCH BIGGER - 3-5x larger)
      const radius = 150 + audioFeatures.rms * 450;

      // Create shape based on aesthetic
      let newShape;
      if (this.aesthetic.current.speed < 0.5) {
        // Country = organic waveform shapes
        newShape = this.createShapeFromWaveform(audioFeatures.waveform, radius, colorIndex);
      } else {
        // Urban = geometric shapes
        const sides = Math.floor(3 + this.aesthetic.current.speed * 9);
        newShape = this.createGeometricShape(radius, sides, colorIndex);
      }

      this.shapes.push(newShape);

      // Allow many more shapes for rich layering (40 instead of 20)
      if (this.shapes.length > 40) {
        this.shapes.shift();
      }
    }

    // Transient bursts create extra geometric shapes (BIGGER)
    if (this.aesthetic.transientBurst > 0.5) {
      const colorIndex = Math.floor(Math.random() * 7);
      const radius = 200 + this.aesthetic.transientBurst * 350;
      const sides = Math.floor(4 + Math.random() * 8);

      const burstShape = this.createGeometricShape(radius, sides, colorIndex);
      this.shapes.push(burstShape);
    }

    // Draw with camera orbit and global rotation
    this.camera.apply(this.ctx, width, height);
    this.ctx.rotate(this.globalRotation);

    // Update and draw shapes
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const shape = this.shapes[i];
      shape.update(this.aesthetic.current);

      if (shape.isDead()) {
        this.shapes.splice(i, 1);
      } else {
        this.drawShapeWithSymmetry(shape, this.aesthetic);
      }
    }

    // Draw central mandala core (MUCH BIGGER)
    const coreRadius = 40 + audioFeatures.bass * 100;
    // Use frame count for core color variety
    const coreColorIndex = Math.floor((this.aesthetic.current.warmth * 7 + this.frameCount * 0.05)) % 7;

    this.ctx.fillStyle = this.aesthetic.getColor(coreColorIndex, 0.8);

    const coreGlow = 40 + audioFeatures.bass * 70 + (this.aesthetic.transientBurst * 80);
    this.ctx.shadowBlur = coreGlow;
    this.ctx.shadowColor = this.aesthetic.getColor(coreColorIndex, 0.7);

    // Draw symmetrical core pattern
    for (let i = 0; i < this.symmetryOrder; i++) {
      const angle = (i / this.symmetryOrder) * Math.PI * 2;
      const x = Math.cos(angle) * coreRadius * 0.5;
      const y = Math.sin(angle) * coreRadius * 0.5;

      this.ctx.beginPath();
      this.ctx.arc(x, y, coreRadius * 0.3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Central circle
    this.ctx.beginPath();
    this.ctx.arc(0, 0, coreRadius * 0.4, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = this.aesthetic.getColor(0, 0.9);
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    this.ctx.shadowBlur = 0;

    this.camera.restore(this.ctx);

    // Debug info
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
    this.ctx.font = '12px monospace';
    const pitchNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const label = `Tempo: ${bpm.toFixed(0)} BPM | Symmetry: ${this.symmetryOrder}-fold | Pitch: ${pitchNames[musicalInfo.pitchClass]} | ${this.getAestheticLabel(bpm)}`;
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
