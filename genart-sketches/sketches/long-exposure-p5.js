import p5 from 'p5';
import { TempoAnalyzer, AestheticState } from '../aestheticSystem-v3.js';
import { FallColors } from '../colorPalette.js';

// P5.js version - leverages p5's superior curve drawing

class P5Beam {
  constructor(p, colorIndex, instrumentType) {
    this.p = p;
    this.colorIndex = colorIndex;
    this.instrumentType = instrumentType;

    // Starting position
    this.x = p.random(p.width);
    this.y = p.random(p.height);

    // Movement
    this.angle = p.random(p.TWO_PI);
    this.speed = 2 + p.random(4);
    this.turnSpeed = p.random(-0.05, 0.05);

    // Thickness variety
    const r = p.random();
    if (r < 0.3) {
      this.thickness = 3 + p.random(4); // Thin
    } else if (r < 0.6) {
      this.thickness = 10 + p.random(10); // Medium
    } else {
      this.thickness = 20 + p.random(15); // Thick
    }

    // Trail - NEVER clears, grows indefinitely
    this.trail = [];
    this.maxPoints = 800; // Very long trails
  }

  update(audioFeatures, aesthetic) {
    // Instrument-based audio response
    let speedMult = 1;

    switch(this.instrumentType) {
      case 'violin':
        speedMult = audioFeatures.spectralCentroid > 2500 && audioFeatures.mid > 0.2 ? 1.5 : 0.6;
        break;
      case 'synth':
        speedMult = audioFeatures.high > 0.3 ? 2.0 : 0.5;
        break;
      case 'bass':
        speedMult = audioFeatures.bass > 0.3 ? 1.8 : 0.4;
        break;
    }

    // Update angle for curves
    this.angle += this.turnSpeed + this.p.noise(this.p.frameCount * 0.01) * 0.1 - 0.05;

    // Move
    const speed = this.speed * speedMult * aesthetic.current.speed;
    this.x += this.p.cos(this.angle) * speed;
    this.y += this.p.sin(this.angle) * speed;

    // Wrap around
    if (this.x < -50) this.x = this.p.width + 50;
    if (this.x > this.p.width + 50) this.x = -50;
    if (this.y < -50) this.y = this.p.height + 50;
    if (this.y > this.p.height + 50) this.y = -50;

    // Add to trail - NEVER clear
    this.trail.push({ x: this.x, y: this.y });

    // Only cap for performance
    if (this.trail.length > this.maxPoints) {
      this.trail.shift();
    }
  }

  draw() {
    if (this.trail.length < 4) return;

    const p = this.p;
    const color = FallColors.palette[this.colorIndex % FallColors.palette.length];

    // Draw using p5's curveVertex for smooth organic curves
    p.noFill();
    p.strokeWeight(this.thickness);

    // Outer colored stroke
    p.stroke(color.h, color.s, color.l * 0.6, 0.6);
    p.blendMode(p.ADD); // Additive blending

    p.beginShape();
    // Use curveVertex - p5 automatically creates smooth curves!
    for (let i = 0; i < this.trail.length; i++) {
      const pt = this.trail[i];
      p.curveVertex(pt.x, pt.y);
    }
    p.endShape();

    // Inner lighter core
    p.strokeWeight(this.thickness * 0.3);
    p.stroke(color.h, color.s, color.l * 1.2, 0.3);

    p.beginShape();
    for (let i = 0; i < this.trail.length; i++) {
      const pt = this.trail[i];
      p.curveVertex(pt.x, pt.y);
    }
    p.endShape();

    // Small colored head
    p.noStroke();
    p.fill(color.h, color.s, color.l * 0.8, 0.7);
    const last = this.trail[this.trail.length - 1];
    p.circle(last.x, last.y, this.thickness * 0.4);

    p.blendMode(p.BLEND);
  }
}

export class LongExposureP5 {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx; // Not used, but kept for compatibility

    this.tempoAnalyzer = new TempoAnalyzer();
    this.aesthetic = new AestheticState();

    this.beams = [];
    this.p5Instance = null;

    this.setupP5();
  }

  setupP5() {
    const sketch = (p) => {
      p.setup = () => {
        // Get container size
        const container = document.getElementById('canvas-container');
        const w = container.clientWidth;
        const h = container.clientHeight;

        // Create canvas and replace the existing one
        const p5Canvas = p.createCanvas(w, h);
        p5Canvas.parent('canvas-container');
        p5Canvas.id('p5-canvas');

        // Hide the original canvas
        const origCanvas = document.getElementById('canvas');
        if (origCanvas) {
          origCanvas.style.display = 'none';
        }

        // p5 color mode: HSL
        p.colorMode(p.HSL, 360, 100, 100, 1);

        // Initialize beams
        this.initializeBeams(p);
      };

      p.draw = () => {
        // This is called by p5, but we'll control it from our main draw() method
      };

      p.windowResized = () => {
        const container = document.getElementById('canvas-container');
        p.resizeCanvas(container.clientWidth, container.clientHeight);
      };
    };

    this.p5Instance = new p5(sketch);
  }

  initializeBeams(p) {
    this.beams = [];

    const numBeams = 6 + Math.floor(Math.random() * 4); // 6-9 beams

    for (let i = 0; i < numBeams; i++) {
      let instrumentType, colorIndex;
      const rand = Math.random();

      if (rand < 0.35) {
        instrumentType = 'violin';
        colorIndex = [0, 10, 9, 8][Math.floor(Math.random() * 4)];
      } else if (rand < 0.7) {
        instrumentType = 'synth';
        colorIndex = [5, 6, 7, 1][Math.floor(Math.random() * 4)];
      } else {
        instrumentType = 'bass';
        colorIndex = [2, 3, 4][Math.floor(Math.random() * 3)];
      }

      this.beams.push(new P5Beam(this.p5Instance, colorIndex, instrumentType));
    }
  }

  reset() {
    if (this.p5Instance) {
      this.initializeBeams(this.p5Instance);
    }
    this.tempoAnalyzer.reset();
    this.aesthetic.reset();
  }

  draw(audioFeatures) {
    if (!this.p5Instance) return;

    const p = this.p5Instance;

    const bpm = this.tempoAnalyzer.analyze(audioFeatures);
    this.aesthetic.updateTempo(bpm);
    this.aesthetic.update(this.tempoAnalyzer);

    // Deep English red background with VERY slow fade
    p.background(40, 8, 8, 0.01); // HSL with very low alpha for slow fade

    // Update and draw all beams
    for (const beam of this.beams) {
      beam.update(audioFeatures, this.aesthetic);
      beam.draw();
    }

    // Debug info
    p.fill(45, 45, 65, 0.3);
    p.noStroke();
    p.textSize(12);
    p.textFont('monospace');

    const avgTrail = this.beams.reduce((sum, b) => sum + b.trail.length, 0) / this.beams.length;
    const label = `P5.js Long Exposure | BPM: ${bpm.toFixed(0)} | Avg Trail: ${avgTrail.toFixed(0)} pts`;
    p.text(label, 10, p.height - 10);
  }

  // Cleanup when switching visualizations
  dispose() {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }

    // Show original canvas again
    const origCanvas = document.getElementById('canvas');
    if (origCanvas) {
      origCanvas.style.display = 'block';
    }

    // Remove p5 canvas
    const p5Canvas = document.getElementById('p5-canvas');
    if (p5Canvas) {
      p5Canvas.remove();
    }
  }
}
