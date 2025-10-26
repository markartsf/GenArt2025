import { TempoAnalyzer, AestheticState } from '../aestheticSystem-v3.js';

class FrequencyBar {
  constructor(x, y, width, height, frequencyBand, colorIndex) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.frequencyBand = frequencyBand;
    this.colorIndex = colorIndex;

    this.currentHeight = 0;
    this.targetHeight = 0;
  }

  update(energy) {
    this.targetHeight = this.height * energy;
    this.currentHeight += (this.targetHeight - this.currentHeight) * 0.3;
  }

  draw(ctx, aesthetic) {
    if (this.currentHeight < 2) return;

    const alpha = 0.7;
    const color = aesthetic.getColor(this.colorIndex, alpha);

    ctx.fillStyle = color;

    // Glow
    ctx.shadowBlur = 20 + this.currentHeight * 0.3;
    ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.5);

    ctx.fillRect(this.x, this.y - this.currentHeight, this.width, this.currentHeight);

    ctx.shadowBlur = 0;
  }
}

class RadialSpike {
  constructor(centerX, centerY, angle, length, colorIndex) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.angle = angle;
    this.maxLength = length;
    this.colorIndex = colorIndex;

    this.currentLength = 0;
    this.targetLength = 0;
  }

  update(energy) {
    this.targetLength = this.maxLength * energy;
    this.currentLength += (this.targetLength - this.currentLength) * 0.4;
  }

  draw(ctx, aesthetic) {
    if (this.currentLength < 5) return;

    const endX = this.centerX + Math.cos(this.angle) * this.currentLength;
    const endY = this.centerY + Math.sin(this.angle) * this.currentLength;

    const alpha = 0.8;
    const color = aesthetic.getColor(this.colorIndex, alpha);

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Glow
    ctx.shadowBlur = 15 + this.currentLength * 0.2;
    ctx.shadowColor = aesthetic.getColor(this.colorIndex, 0.6);

    ctx.beginPath();
    ctx.moveTo(this.centerX, this.centerY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }
}

export class TimbreSpectrum {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // V3 systems
    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();

    // Visual elements
    this.bassBar = null;
    this.midBars = [];
    this.highSpikes = [];

    this.initialize();
  }

  initialize() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Bass - thick horizontal band at bottom
    this.bassBar = new FrequencyBar(
      0,
      height,
      width,
      height * 0.4,
      'bass',
      5 // Warm color
    );

    // Mid frequencies - vertical bars across screen
    this.midBars = [];
    const numMidBars = 16;
    const barWidth = width / numMidBars;

    for (let i = 0; i < numMidBars; i++) {
      this.midBars.push(new FrequencyBar(
        i * barWidth,
        height * 0.65,
        barWidth * 0.8,
        height * 0.5,
        'mid',
        (i % 12) // Cycle through colors
      ));
    }

    // High frequencies - radiating spikes from center
    this.highSpikes = [];
    const numSpikes = 24;

    for (let i = 0; i < numSpikes; i++) {
      const angle = (i / numSpikes) * Math.PI * 2;
      this.highSpikes.push(new RadialSpike(
        width / 2,
        height / 2,
        angle,
        Math.min(width, height) * 0.4,
        (i % 12)
      ));
    }
  }

  reset() {
    this.initialize();
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

    // Clear background
    this.ctx.fillStyle = `rgba(26, 10, 10, 0.25)`;
    this.ctx.fillRect(0, 0, width, height);

    // Update and draw bass bar
    this.bassBar.update(audioFeatures.bass);
    this.bassBar.draw(this.ctx, this.aesthetic);

    // Update and draw mid bars
    // Use spectral data to make each bar respond to different frequency
    const spectrum = audioFeatures.amplitudeSpectrum;
    const midStart = Math.floor(spectrum.length * 0.1);
    const midEnd = Math.floor(spectrum.length * 0.5);
    const midSpectrum = spectrum.slice(midStart, midEnd);

    for (let i = 0; i < this.midBars.length; i++) {
      const binIndex = Math.floor((i / this.midBars.length) * midSpectrum.length);
      const energy = midSpectrum[binIndex] || 0;
      this.midBars[i].update(energy * 3); // Amplify for visibility
      this.midBars[i].draw(this.ctx, this.aesthetic);
    }

    // Update and draw high spikes
    // Each spike responds to a different part of high frequency spectrum
    const highStart = Math.floor(spectrum.length * 0.5);
    const highSpectrum = spectrum.slice(highStart);

    for (let i = 0; i < this.highSpikes.length; i++) {
      const binIndex = Math.floor((i / this.highSpikes.length) * highSpectrum.length);
      const energy = highSpectrum[binIndex] || 0;
      this.highSpikes[i].update(energy * 5); // Amplify for visibility
      this.highSpikes[i].draw(this.ctx, this.aesthetic);
    }

    // Draw center circle (pulsing with overall energy)
    const totalEnergy = (audioFeatures.bass + audioFeatures.mid + audioFeatures.high) / 3;
    const coreSize = 20 + totalEnergy * 60;

    this.ctx.fillStyle = this.aesthetic.getColor(0, 0.8);
    this.ctx.shadowBlur = 30 + totalEnergy * 40;
    this.ctx.shadowColor = this.aesthetic.getColor(0, 0.7);

    this.ctx.beginPath();
    this.ctx.arc(width / 2, height / 2, coreSize, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.shadowBlur = 0;

    // Debug info
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
    this.ctx.font = '12px monospace';
    const label = `Tempo: ${bpm.toFixed(0)} BPM | Bass: ${audioFeatures.bass.toFixed(2)} | Mid: ${audioFeatures.mid.toFixed(2)} | High: ${audioFeatures.high.toFixed(2)} | ${this.getAestheticLabel(bpm)}`;
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
