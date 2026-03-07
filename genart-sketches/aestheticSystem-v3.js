import { FallColors } from './colorPalette.js';

// Tempo detection and aesthetic state management for V3
export class TempoAnalyzer {
  constructor() {
    this.history = [];
    this.maxHistory = 100; // 100 frames of history
    this.currentBPM = 90;
    this.smoothedBPM = 90;
    this.lastBPM = 90;
    this.tempoMomentum = 0; // Rate of BPM change (acceleration)
    this.transientStrength = 0; // Strength of percussive hits
    this.lastSpectrum = null;
  }

  // Analyze tempo from spectral flux
  analyze(audioFeatures) {
    // Initialize lastSpectrum array if needed
    if (!this.lastSpectrum) {
      this.lastSpectrum = new Array(audioFeatures.amplitudeSpectrum.length);
      for (let i = 0; i < audioFeatures.amplitudeSpectrum.length; i++) {
        this.lastSpectrum[i] = audioFeatures.amplitudeSpectrum[i];
      }
      return this.smoothedBPM;
    }

    // Calculate spectral flux (change in spectrum over time)
    let flux = 0;
    let highFlux = 0; // High-frequency flux for transient detection

    for (let i = 0; i < audioFeatures.amplitudeSpectrum.length; i++) {
      const diff = audioFeatures.amplitudeSpectrum[i] - this.lastSpectrum[i];
      flux += Math.abs(diff);

      // Track high-frequency changes (upper 50% of spectrum)
      if (i > audioFeatures.amplitudeSpectrum.length / 2) {
        highFlux += Math.max(0, diff); // Only positive changes (onsets)
      }

      // Copy to lastSpectrum for next frame
      this.lastSpectrum[i] = audioFeatures.amplitudeSpectrum[i];
    }

    this.history.push({
      flux: flux,
      highFlux: highFlux,
      rms: audioFeatures.rms,
      high: audioFeatures.high,
      spectralCentroid: audioFeatures.spectralCentroid,
      timestamp: Date.now()
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Estimate BPM from recent history
    if (this.history.length > 20) {
      this.estimateBPM();
    }

    // Calculate tempo momentum (acceleration/deceleration)
    const bpmChange = this.smoothedBPM - this.lastBPM;
    this.tempoMomentum += (bpmChange - this.tempoMomentum) * 0.05;
    this.lastBPM = this.smoothedBPM;

    // Smooth BPM changes (no sudden jumps)
    this.smoothedBPM += (this.currentBPM - this.smoothedBPM) * 0.01;

    // Detect transients (staccato synth hits)
    this.detectTransients(audioFeatures);

    return this.smoothedBPM;
  }

  // Detect percussive transients (staccato hits)
  detectTransients(audioFeatures) {
    if (this.history.length < 5) {
      this.transientStrength = 0;
      return;
    }

    const recent = this.history.slice(-5);
    const avgHighFlux = recent.slice(0, 4).reduce((sum, h) => sum + h.highFlux, 0) / 4;
    const currentHighFlux = recent[4].highFlux;

    // Transient detected if current high-frequency flux is much higher than average
    // AND high-frequency energy is present
    if (currentHighFlux > avgHighFlux * 2.5 && audioFeatures.high > 0.2) {
      this.transientStrength = Math.min(1, (currentHighFlux / avgHighFlux) / 5);
    } else {
      // Decay transient strength quickly
      this.transientStrength *= 0.7;
    }
  }

  estimateBPM() {
    // Look for periodicity in flux
    const window = this.history.slice(-40); // Last 40 frames
    const avgFlux = window.reduce((sum, h) => sum + h.flux, 0) / window.length;

    // Count peaks
    let peaks = 0;
    for (let i = 1; i < window.length - 1; i++) {
      if (window[i].flux > avgFlux * 1.5 &&
          window[i].flux > window[i-1].flux &&
          window[i].flux > window[i+1].flux) {
        peaks++;
      }
    }

    // Estimate BPM from peak frequency
    // Assuming ~60fps, 40 frames ≈ 0.67 seconds
    const peaksPerSecond = peaks / 0.67;
    const estimatedBPM = peaksPerSecond * 60;

    // Clamp to reasonable range
    this.currentBPM = Math.max(60, Math.min(180, estimatedBPM || 90));

    // Also use RMS energy as a factor
    const avgRMS = window.reduce((sum, h) => sum + h.rms, 0) / window.length;
    if (avgRMS < 0.1) {
      // Very quiet = likely slow
      this.currentBPM = Math.min(this.currentBPM, 90);
    } else if (avgRMS > 0.5) {
      // Very loud = likely fast
      this.currentBPM = Math.max(this.currentBPM, 100);
    }
  }

  reset() {
    this.history = [];
    this.currentBPM = 90;
    this.smoothedBPM = 90;
    this.lastBPM = 90;
    this.tempoMomentum = 0;
    this.transientStrength = 0;
    this.lastSpectrum = null;
  }
}

// Aesthetic state with smooth transitions
export class AestheticState {
  constructor() {
    this.current = {
      speed: 0.5,           // 0 = still/country, 1 = fast/urban
      density: 0.5,         // 0 = sparse, 1 = dense
      warmth: 0.7,          // 0 = cool/bright, 1 = warm/earth
      lineThickness: 20,    // px
      orbitSpeed: 0.015,    // camera revolution speed
      trailFade: 0.05       // background fade amount
    };

    this.target = { ...this.current };
    this.transitionSpeed = 0.01; // Very slow, smooth transitions

    // Visual effects for tempo changes and transients
    this.tempoAccelerationGlow = 0;  // Glow when tempo is increasing
    this.transientBurst = 0;          // Flash on staccato hits

    // Color cache for performance (cache up to 144 colors: 12 indices × 12 alpha values)
    this.colorCache = new Map();
    this.cachedWarmth = this.current.warmth;
  }

  // Update based on tempo
  updateTempo(bpm) {
    if (bpm < 85) {
      // Country aesthetic - Slow, contemplative (strings)
      this.target.speed = 0.2;
      this.target.density = 0.25;
      this.target.warmth = 0.85;
      this.target.lineThickness = 28;
      this.target.orbitSpeed = 0.008;
      this.target.trailFade = 0.03;

    } else if (bpm < 100) {
      // Countryside transition
      this.target.speed = 0.4;
      this.target.density = 0.4;
      this.target.warmth = 0.65;
      this.target.lineThickness = 24;
      this.target.orbitSpeed = 0.012;
      this.target.trailFade = 0.04;

    } else if (bpm < 115) {
      // Suburban - moderate energy
      this.target.speed = 0.6;
      this.target.density = 0.6;
      this.target.warmth = 0.5;
      this.target.lineThickness = 20;
      this.target.orbitSpeed = 0.018;
      this.target.trailFade = 0.06;

    } else {
      // Urban aesthetic - Fast, vibrant, exciting
      this.target.speed = 0.85;
      this.target.density = 0.85;
      this.target.warmth = 0.25;
      this.target.lineThickness = 16;
      this.target.orbitSpeed = 0.025;
      this.target.trailFade = 0.08;
    }
  }

  // Smooth interpolation toward target
  update(tempoAnalyzer = null) {
    for (let key in this.current) {
      const diff = this.target[key] - this.current[key];
      this.current[key] += diff * this.transitionSpeed;
    }

    // Update visual effects if tempo analyzer is provided
    if (tempoAnalyzer) {
      // Tempo acceleration glow (when BPM is increasing)
      if (tempoAnalyzer.tempoMomentum > 0.1) {
        // Tempo is accelerating - add glow
        this.tempoAccelerationGlow = Math.min(1, tempoAnalyzer.tempoMomentum * 5);
      } else {
        // Decay glow
        this.tempoAccelerationGlow *= 0.9;
      }

      // Transient burst (staccato hits)
      if (tempoAnalyzer.transientStrength > 0.3) {
        this.transientBurst = tempoAnalyzer.transientStrength;
      } else {
        // Fast decay
        this.transientBurst *= 0.85;
      }
    }
  }

  // Get color based on warmth
  getColor(index, alpha = 1) {
    // Clear cache if warmth has changed significantly (> 0.01 change)
    if (Math.abs(this.current.warmth - this.cachedWarmth) > 0.01) {
      this.colorCache.clear();
      this.cachedWarmth = this.current.warmth;
    }

    // Round alpha to 2 decimal places for cache key
    const alphaKey = Math.round(alpha * 100) / 100;
    const cacheKey = `${index}-${alphaKey}`;

    // Return cached color if available
    if (this.colorCache.has(cacheKey)) {
      return this.colorCache.get(cacheKey);
    }

    // Generate color string
    const color = FallColors.palette[index % FallColors.palette.length];

    // Adjust lightness based on warmth
    // Warm = deeper colors, Cool = brighter colors
    const lightnessAdjust = (1 - this.current.warmth) * 20;
    const lightness = Math.min(85, color.l + lightnessAdjust);

    // Adjust saturation
    const saturation = color.s + (this.current.warmth * 15);

    const colorString = `hsla(${color.h}, ${saturation}%, ${lightness}%, ${alpha})`;

    // Cache the result
    this.colorCache.set(cacheKey, colorString);

    return colorString;
  }

  reset() {
    this.current = {
      speed: 0.5,
      density: 0.5,
      warmth: 0.7,
      lineThickness: 20,
      orbitSpeed: 0.015,
      trailFade: 0.05
    };
    this.target = { ...this.current };
    this.tempoAccelerationGlow = 0;
    this.transientBurst = 0;
    this.colorCache.clear();
    this.cachedWarmth = this.current.warmth;
  }
}

// Orbiting camera for V3
export class OrbitingCamera {
  constructor() {
    this.angle = 0;
    this.radius = 40;
    this.height = 0;
    this.tilt = 0;
    this.zoom = 1;
  }

  update(aesthetic) {
    // Revolution speed matches aesthetic tempo
    this.angle += aesthetic.orbitSpeed;

    // Gentle radius breathing
    this.radius = 40 + Math.sin(this.angle * 0.4) * 12;

    // Height variation creates depth
    this.height = Math.sin(this.angle * 0.6) * 18 * (1 - aesthetic.speed);

    // Gentle tilt
    this.tilt = Math.sin(this.angle * 0.3) * 0.1;

    // Very subtle zoom breathing
    this.zoom = 1 + Math.sin(this.angle * 0.5) * 0.05;
  }

  apply(ctx, width, height) {
    ctx.save();

    // Center point
    ctx.translate(width / 2, height / 2);

    // Apply zoom
    ctx.scale(this.zoom, this.zoom);

    // Orbital offset
    const offsetX = Math.cos(this.angle) * this.radius;
    const offsetY = Math.sin(this.angle) * this.radius + this.height;

    ctx.translate(offsetX, offsetY);

    // Gentle rotation following orbit
    ctx.rotate(this.angle * 0.15 + this.tilt);
  }

  restore(ctx) {
    ctx.restore();
  }

  reset() {
    this.angle = 0;
    this.radius = 40;
    this.height = 0;
    this.tilt = 0;
    this.zoom = 1;
  }
}

// Smooth transition utilities
export class TransitionHelper {
  // Easing functions for smooth transitions
  static easeInOut(t) {
    return t < 0.5
      ? 2 * t * t
      : -1 + (4 - 2 * t) * t;
  }

  static easeOut(t) {
    return t * (2 - t);
  }

  // Interpolate between two values smoothly
  static lerp(start, end, t, easing = 'linear') {
    const easedT = easing === 'easeInOut' ? this.easeInOut(t) :
                   easing === 'easeOut' ? this.easeOut(t) : t;
    return start + (end - start) * easedT;
  }

  // Map tempo to aesthetic feeling
  static getAestheticLabel(bpm) {
    if (bpm < 85) return 'Country / Ethereal';
    if (bpm < 100) return 'Countryside / Flowing';
    if (bpm < 115) return 'Suburban / Moderate';
    return 'Urban / Vibrant';
  }
}
