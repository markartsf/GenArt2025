import { TempoAnalyzer, AestheticState } from '../aestheticSystem-v3.js';

class Branch {
  constructor(x1, y1, x2, y2, angle, generation, octave, aesthetic) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.angle = angle;
    this.generation = generation; // 0 = trunk, 1 = main branches, etc.
    this.octave = octave; // Musical octave
    this.life = 1;
    this.maxLife = 1;
    this.warmth = aesthetic.warmth;

    // Branch thickness based on generation (MUCH THICKER)
    this.thickness = Math.max(3, 35 - generation * 2.5);
  }

  update(aesthetic) {
    // Update warmth
    this.warmth += (aesthetic.warmth - this.warmth) * 0.05;

    // Very slow life decay (branches persist)
    this.life -= 0.0002;
  }

  draw(ctx, aesthetic) {
    if (this.life <= 0) return;

    // Color based on generation and warmth
    const colorIndex = Math.floor((this.generation / 8) * 7 + this.warmth * 2) % 7;
    const alpha = this.life * 0.8;
    const color = aesthetic.getColor(colorIndex, alpha);

    ctx.strokeStyle = color;
    ctx.lineWidth = this.thickness * this.life;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Glow for higher generations in urban mode
    if (aesthetic.current.speed > 0.6 && this.generation > 3) {
      ctx.shadowBlur = 10 + (aesthetic.current.speed * 15);
      ctx.shadowColor = aesthetic.getColor(colorIndex, 0.5);
    }

    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(this.x2, this.y2);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  isDead() {
    return this.life <= 0;
  }
}

class GrowthTip {
  constructor(x, y, angle, generation, energy) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.generation = generation;
    this.energy = energy; // How much growth potential
    this.age = 0;
  }

  update() {
    this.age++;
    this.energy *= 0.995; // Slowly lose energy
  }

  isActive() {
    return this.energy > 0.1 && this.generation < 12;
  }
}

export class FractalTree {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.branches = [];
    this.growthTips = [];

    // V3 systems
    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();

    // Tree parameters
    this.trunkHeight = 0;
    this.maxTrunkHeight = 150;

    // Start with trunk base
    this.initializeTrunk();
  }

  initializeTrunk() {
    this.branches = [];
    this.growthTips = [];
    this.trunkHeight = 0;

    // Add initial growth tip at base
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Create MUCH LARGER initial trunk - fills more screen
    const trunkX = width / 2;
    const trunkY1 = height * 0.95; // Start near bottom
    const trunkY2 = height * 0.4; // Trunk goes up to middle of screen

    const trunkBranch = new Branch(
      trunkX,
      trunkY1,
      trunkX,
      trunkY2,
      -Math.PI / 2,
      0,
      3,
      this.aesthetic.current
    );
    this.branches.push(trunkBranch);

    // Add multiple growth tips to start wider
    this.growthTips.push(new GrowthTip(
      trunkX,
      trunkY2,
      -Math.PI / 2, // Pointing up
      1, // Start at generation 1
      1.0
    ));

    // Add side tips for bushier start
    this.growthTips.push(new GrowthTip(
      trunkX,
      trunkY2,
      -Math.PI / 2 + 0.3,
      1,
      1.0
    ));
    this.growthTips.push(new GrowthTip(
      trunkX,
      trunkY2,
      -Math.PI / 2 - 0.3,
      1,
      1.0
    ));
  }

  reset() {
    this.initializeTrunk();
    this.tempoAnalyzer.reset();
    this.aesthetic.reset();
  }

  // Detect pitch and octave
  detectPitch(spectrum) {
    let maxMagnitude = 0;
    let maxBin = 0;

    for (let i = 5; i < spectrum.length; i++) {
      if (spectrum[i] > maxMagnitude) {
        maxMagnitude = spectrum[i];
        maxBin = i;
      }
    }

    const sampleRate = 44100;
    const frequency = (maxBin * sampleRate) / (spectrum.length * 2);
    const octave = Math.floor(Math.log2(frequency / 27.5));
    const clampedOctave = Math.max(0, Math.min(7, octave));

    // Normalized pitch (0-1)
    const normalizedPitch = (frequency % 1000) / 1000;

    return {
      octave: clampedOctave,
      pitch: normalizedPitch,
      magnitude: maxMagnitude
    };
  }

  growBranch(tip, angleOffset, length, octave) {
    const newAngle = tip.angle + angleOffset;
    const x2 = tip.x + Math.cos(newAngle) * length;
    const y2 = tip.y + Math.sin(newAngle) * length;

    const branch = new Branch(
      tip.x,
      tip.y,
      x2,
      y2,
      newAngle,
      tip.generation,
      octave,
      this.aesthetic.current
    );

    this.branches.push(branch);

    // Create new growth tip at end of branch
    if (tip.generation < 12) {
      this.growthTips.push(new GrowthTip(
        x2,
        y2,
        newAngle,
        tip.generation + 1,
        tip.energy * 0.7
      ));
    }
  }

  draw(audioFeatures) {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Analyze tempo
    const bpm = this.tempoAnalyzer.analyze(audioFeatures);

    // Update aesthetic state
    this.aesthetic.updateTempo(bpm);
    this.aesthetic.update(this.tempoAnalyzer);

    // Adaptive fade (very slow to keep tree structure)
    this.ctx.fillStyle = `rgba(26, 10, 10, ${this.aesthetic.current.trailFade * 0.3})`;
    this.ctx.fillRect(0, 0, width, height);

    // Detect pitch
    const pitchInfo = this.detectPitch(audioFeatures.amplitudeSpectrum);

    // Branch angle based on pitch and aesthetic
    // Country = gentle curves (30-60 degrees)
    // Urban = sharp angles (45-90 degrees)
    const minAngle = 0.3 + (this.aesthetic.current.speed * 0.5);
    const maxAngle = 0.8 + (this.aesthetic.current.speed * 0.8);
    const angleRange = maxAngle - minAngle;

    // Map pitch to angle offset
    const angleOffset = (pitchInfo.pitch - 0.5) * angleRange * Math.PI;

    // Branch length based on generation and aesthetic
    // Country = longer, flowing branches
    // Urban = shorter, compact branches
    const baseBranchLength = 40 - (this.aesthetic.current.speed * 15);

    // Update growth tips
    for (let i = this.growthTips.length - 1; i >= 0; i--) {
      this.growthTips[i].update();
      if (!this.growthTips[i].isActive()) {
        this.growthTips.splice(i, 1);
      }
    }

    // Grow new branches based on audio OR always grow automatically
    const hasAudio = audioFeatures.rms > 0.02;
    const shouldGrowAutomatically = this.growthTips.length < 200; // ALWAYS grow if under limit

    if ((hasAudio || shouldGrowAutomatically) && this.growthTips.length > 0) {
      // Choose growth tip based on octave
      const targetGeneration = Math.min(pitchInfo.octave, this.growthTips.length - 1);

      // Find tips at or near target generation (very relaxed energy requirement)
      const suitableTips = this.growthTips.filter(tip =>
        Math.abs(tip.generation - targetGeneration) <= 3 && tip.energy > 0.05
      );

      // If no suitable tips, use any active tip (very low threshold)
      const tipsToUse = suitableTips.length > 0 ? suitableTips :
        this.growthTips.filter(tip => tip.energy > 0.05);

      if (tipsToUse.length > 0) {
        // Pick random suitable tip
        const tip = tipsToUse[Math.floor(Math.random() * tipsToUse.length)];

        // Branch length based on generation (LONGER BRANCHES)
        const length = baseBranchLength * 1.5 / (1 + tip.generation * 0.2);

        // Grow two branches (binary tree)
        this.growBranch(tip, angleOffset, length, pitchInfo.octave);
        this.growBranch(tip, -angleOffset, length, pitchInfo.octave);

        // Reduce tip energy less aggressively
        tip.energy *= 0.7;
      }
    }

    // Transient bursts create extra branching (lower threshold)
    if (this.aesthetic.transientBurst > 0.5 && this.growthTips.length > 0) {
      const randomTip = this.growthTips[Math.floor(Math.random() * this.growthTips.length)];
      if (randomTip.energy > 0.15) {
        const length = baseBranchLength * 1.5 / (1 + randomTip.generation * 0.2);
        const randomAngle = (Math.random() - 0.5) * Math.PI * 0.8;

        this.growBranch(randomTip, randomAngle, length, pitchInfo.octave);
        randomTip.energy *= 0.7;
      }
    }

    // Update and draw branches
    for (let i = this.branches.length - 1; i >= 0; i--) {
      const branch = this.branches[i];
      branch.update(this.aesthetic.current);

      if (branch.isDead()) {
        this.branches.splice(i, 1);
      } else {
        branch.draw(this.ctx, this.aesthetic);
      }
    }

    // Draw growth tips (leaves/blossoms)
    for (const tip of this.growthTips) {
      if (tip.generation > 1) { // Show leaves earlier
        // Leaf/blossom size based on energy and aesthetic (BIGGER)
        const size = 6 + tip.energy * 12 - (this.aesthetic.current.speed * 3);

        // Color based on generation
        const colorIndex = Math.floor((tip.generation / 12) * 7) % 7;
        const color = this.aesthetic.getColor(colorIndex, tip.energy * 0.7);

        this.ctx.fillStyle = color;

        // Glow in urban mode
        if (this.aesthetic.current.speed > 0.6) {
          this.ctx.shadowBlur = 8 + (this.aesthetic.current.speed * 12);
          this.ctx.shadowColor = this.aesthetic.getColor(colorIndex, 0.6);
        }

        this.ctx.beginPath();
        this.ctx.arc(tip.x, tip.y, size, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.shadowBlur = 0;
      }
    }

    // Debug info
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
    this.ctx.font = '12px monospace';
    const label = `Tempo: ${bpm.toFixed(0)} BPM | Branches: ${this.branches.length} | Growth Tips: ${this.growthTips.length} | ${this.getAestheticLabel(bpm)}`;
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
