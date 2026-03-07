// P5.js Long Exposure Beams - Standalone Version
// Smooth organic curves, long persistent trails

let beams = [];
let audioFile;
let fft;
let amplitude;
let isPlaying = false;

// Color palette - rich dark fall colors
const palette = [
  { h: 48, s: 95, l: 60, name: 'cadmiumYellow' },
  { h: 355, s: 85, l: 50, name: 'naphtholRed' },
  { h: 0, s: 80, l: 28, name: 'darkRed' },
  { h: 345, s: 70, l: 25, name: 'burgundy' },
  { h: 15, s: 65, l: 30, name: 'darkBrown' },
  { h: 275, s: 70, l: 30, name: 'deepViolet' },
  { h: 285, s: 60, l: 35, name: 'deepPurple' },
  { h: 300, s: 55, l: 35, name: 'plum' },
  { h: 25, s: 90, l: 55, name: 'cadmiumOrange' },
  { h: 40, s: 75, l: 58, name: 'neutralYellowishOrange' },
  { h: 50, s: 45, l: 65, name: 'neutralYellow' },
  { h: 15, s: 60, l: 40, name: 'burntSienna' }
];

class Beam {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.angle = random(TWO_PI);
    this.speed = 2 + random(3);
    this.turnSpeed = random(-0.08, 0.08);

    // Thickness variety
    const r = random();
    if (r < 0.25) {
      this.thickness = 2 + random(4); // Thin
    } else if (r < 0.6) {
      this.thickness = 8 + random(10); // Medium
    } else {
      this.thickness = 20 + random(20); // Thick
    }

    this.colorIndex = floor(random(palette.length));

    // Use circular buffer for performance
    this.maxPoints = 1000; // Very long trails
    this.trail = new Array(this.maxPoints);
    for (let i = 0; i < this.maxPoints; i++) {
      this.trail[i] = { x: 0, y: 0 };
    }
    this.trailIndex = 0;
    this.trailCount = 0;

    this.noiseOffset = random(1000);
  }

  update(audioData) {
    // Audio-reactive speed
    const bass = audioData.bass;
    const mid = audioData.mid;
    const high = audioData.high;

    let speedMult = 1 + (bass * 0.5 + mid * 0.3 + high * 0.2);

    // Organic angle changes using Perlin noise
    this.angle += this.turnSpeed + noise(this.noiseOffset) * 0.2 - 0.1;
    this.noiseOffset += 0.01;

    // Move
    const vel = this.speed * speedMult;
    this.x += cos(this.angle) * vel;
    this.y += sin(this.angle) * vel;

    // Wrap around
    if (this.x < -50) this.x = width + 50;
    if (this.x > width + 50) this.x = -50;
    if (this.y < -50) this.y = height + 50;
    if (this.y > height + 50) this.y = -50;

    // Add to trail using circular buffer
    this.trail[this.trailIndex].x = this.x;
    this.trail[this.trailIndex].y = this.y;
    this.trailIndex = (this.trailIndex + 1) % this.maxPoints;
    if (this.trailCount < this.maxPoints) {
      this.trailCount++;
    }
  }

  draw() {
    if (this.trailCount < 4) return;

    const color = palette[this.colorIndex];

    // Read from circular buffer in correct order (oldest to newest)
    const startIdx = this.trailCount < this.maxPoints ? 0 : this.trailIndex;

    // Outer colored stroke
    noFill();
    strokeWeight(this.thickness);
    stroke(color.h, color.s, color.l * 0.55, 0.5);
    blendMode(ADD);

    beginShape();
    // curveVertex creates smooth curves through all points!
    for (let i = 0; i < this.trailCount; i++) {
      const idx = (startIdx + i) % this.maxPoints;
      curveVertex(this.trail[idx].x, this.trail[idx].y);
    }
    endShape();

    // Inner lighter core (NOT white)
    strokeWeight(this.thickness * 0.25);
    stroke(color.h, color.s, color.l * 0.9, 0.25);

    beginShape();
    for (let i = 0; i < this.trailCount; i++) {
      const idx = (startIdx + i) % this.maxPoints;
      curveVertex(this.trail[idx].x, this.trail[idx].y);
    }
    endShape();

    // Small colored head
    noStroke();
    fill(color.h, color.s, color.l * 0.7, 0.6);
    const lastIdx = (startIdx + this.trailCount - 1) % this.maxPoints;
    const last = this.trail[lastIdx];
    circle(last.x, last.y, this.thickness * 0.35);

    blendMode(BLEND);
  }
}

function setup() {
  const container = select('#p5-container');
  const canvas = createCanvas(windowWidth, windowHeight - 120);
  canvas.parent('p5-container');

  colorMode(HSL, 360, 100, 100, 1);

  // Initialize beams
  for (let i = 0; i < 8; i++) {
    beams.push(new Beam());
  }

  // Setup audio
  fft = new p5.FFT(0.8, 512);
  amplitude = new p5.Amplitude();

  setupControls();
}

function draw() {
  // Deep English red background with VERY slow fade
  background(40, 10, 10, 0.008);

  // Get audio data
  const audioData = getAudioFeatures();

  // Update and draw beams
  for (let beam of beams) {
    beam.update(audioData);
    beam.draw();
  }

  // Debug info
  fill(45, 45, 65, 0.4);
  noStroke();
  textSize(12);
  textAlign(LEFT);
  const avgTrail = beams.reduce((sum, b) => sum + b.trailCount, 0) / beams.length;
  text(`Trail Points: ${avgTrail.toFixed(0)} | Beams: ${beams.length}`, 10, height - 10);
}

function getAudioFeatures() {
  if (!audioFile || !isPlaying) {
    return { bass: 0, mid: 0, high: 0 };
  }

  const spectrum = fft.analyze();
  const bassEnd = floor(spectrum.length * 0.1);
  const midEnd = floor(spectrum.length * 0.5);

  const bass = spectrum.slice(0, bassEnd).reduce((a, b) => a + b, 0) / bassEnd / 255;
  const mid = spectrum.slice(bassEnd, midEnd).reduce((a, b) => a + b, 0) / (midEnd - bassEnd) / 255;
  const high = spectrum.slice(midEnd).reduce((a, b) => a + b, 0) / (spectrum.length - midEnd) / 255;

  return { bass, mid, high };
}

function setupControls() {
  const fileInput = select('#audioFile');
  const playPauseBtn = select('#playPause');
  const stopBtn = select('#stop');
  const statusText = select('#status');

  fileInput.changed(() => {
    const file = fileInput.elt.files[0];
    if (file) {
      statusText.html('Loading audio...');

      if (audioFile) {
        audioFile.stop();
        audioFile = null;
      }

      audioFile = loadSound(file,
        () => {
          statusText.html('✓ Audio loaded! Press Play.');
          playPauseBtn.removeAttribute('disabled');
          stopBtn.removeAttribute('disabled');
          fft.setInput(audioFile);
          amplitude.setInput(audioFile);
        },
        () => {
          statusText.html('✗ Error loading audio file');
        }
      );
    }
  });

  playPauseBtn.mousePressed(() => {
    if (!audioFile) return;

    if (isPlaying) {
      audioFile.pause();
      isPlaying = false;
      playPauseBtn.html('Play');
      statusText.html('Paused');
    } else {
      audioFile.play();
      isPlaying = true;
      playPauseBtn.html('Pause');
      statusText.html('▶ Playing...');
    }
  });

  stopBtn.mousePressed(() => {
    if (audioFile) {
      audioFile.stop();
      isPlaying = false;
      playPauseBtn.html('Play');
      statusText.html('Stopped');
    }
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight - 120);
}
