import { FallColors } from '../colorPalette.js';
import { AudioAnalysisV2 } from '../audioAnalysis-v2.js';

export class LorenzAttractorV2 {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.points = [];
    this.maxPoints = 8000; // More points for richer trails

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

    // Scale - larger for V2
    this.scale = 12;
    this.rotation = 0;

    // Enhanced audio analysis
    this.audioAnalyzer = new AudioAnalysisV2();
    this.pitchHistory = [];
    this.previousRMS = 0;

    // Visual state
    this.currentPitch = null;
    this.octaveBands = {};
    this.melodicDirection = 'stable';
  }

  reset() {
    this.points = [];
    this.x = 0.1;
    this.y = 0;
    this.z = 0;
    this.rotation = 0;
    this.pitchHistory = [];
    this.previousRMS = 0;
  }

  draw(audioFeatures) {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // V2: Slower fade for longer trails
    this.ctx.fillStyle = 'rgba(26, 10, 10, 0.04)';
    this.ctx.fillRect(0, 0, width, height);

    // Enhanced audio analysis
    this.currentPitch = this.audioAnalyzer.detectPitch(audioFeatures.amplitudeSpectrum);
    this.octaveBands = this.audioAnalyzer.analyzeOctaveBands(audioFeatures.amplitudeSpectrum);

    // Track pitch history for melodic analysis
    if (this.currentPitch) {
      this.pitchHistory.push(this.currentPitch);
      if (this.pitchHistory.length > 20) {
        this.pitchHistory.shift();
      }
    }

    // Analyze melodic contour
    const contour = this.audioAnalyzer.analyzeMelodicContour(this.pitchHistory);
    this.melodicDirection = contour.direction;

    // Detect onset (attack)
    const onset = this.audioAnalyzer.detectOnset(audioFeatures.rms, this.previousRMS);
    this.previousRMS = audioFeatures.rms;

    // Audio-reactive parameters - MORE dramatic in V2
    const bassModulation = 1 + audioFeatures.bass * 4;
    const midModulation = 1 + audioFeatures.mid * 20;
    const highModulation = 1 + audioFeatures.high * 1.2;

    this.sigma = 10 * bassModulation;
    this.rho = 28 * midModulation;
    this.beta = (8/3) * highModulation;

    // Rotation influenced by melodic movement
    let rotationSpeed = (audioFeatures.spectralCentroid / 10000) * 0.008;
    if (this.melodicDirection === 'ascending') {
      rotationSpeed *= 2;
    } else if (this.melodicDirection === 'descending') {
      rotationSpeed *= -1;
    }
    this.rotation += rotationSpeed;

    // Scale based on RMS and dynamics
    const dynamics = this.audioAnalyzer.getDynamics(audioFeatures.rms);
    const dynamicScale = this.scale + (audioFeatures.rms * 50) + (dynamics.intensity * 20);

    // Calculate next point
    const dx = this.sigma * (this.y - this.x);
    const dy = this.x * (this.rho - this.z) - this.y;
    const dz = this.x * this.y - this.beta * this.z;

    this.x += dx * this.dt;
    this.y += dy * this.dt;
    this.z += dz * this.dt;

    // Store point with pitch information
    this.points.push({
      x: this.x,
      y: this.y,
      z: this.z,
      pitch: this.currentPitch,
      onset: onset,
      dynamics: dynamics
    });

    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }

    // Draw
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

      // V2: Pitch-responsive colors
      let colorIndex = 3; // Default
      if (point.pitch && point.pitch.note) {
        // Map note to color: each note gets a specific fall color
        const noteIndex = this.audioAnalyzer.noteNames.indexOf(point.pitch.note.name);
        colorIndex = Math.floor((noteIndex / 12) * FallColors.palette.length);

        // Octave influences color intensity
        const octave = this.audioAnalyzer.getOctave(point.pitch.frequency);
        if (octave.name === 'bass' || octave.name === 'subBass') {
          colorIndex = 5; // Brown/Burgundy for bass
        } else if (octave.name === 'presence' || octave.name === 'brilliance') {
          colorIndex = 0; // Yellow for high notes
        }
      }

      const progress = i / this.points.length;
      const alpha = progress * (0.7 + audioFeatures.rms * 0.3);
      const color = FallColors.getAudioColor(colorIndex, audioFeatures, alpha);

      this.ctx.strokeStyle = color;

      // V2: Even THICKER lines - up to 20px
      let lineWidth = 5 + audioFeatures.bass * 15;

      // Onset makes lines burst thicker
      if (point.onset) {
        lineWidth *= 1.5;
      }

      // Dynamics affect line weight
      if (point.dynamics) {
        lineWidth *= point.dynamics.intensity;
      }

      this.ctx.lineWidth = lineWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // V2: More dramatic glow
      if (audioFeatures.high > 0.15 || audioFeatures.bass > 0.25 || point.onset) {
        this.ctx.shadowBlur = 25 + audioFeatures.bass * 45;
        this.ctx.shadowColor = FallColors.getGlowColor(colorIndex, Math.max(audioFeatures.bass, audioFeatures.high));
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
