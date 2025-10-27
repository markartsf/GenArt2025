// P5.js Geometric Layers - ULTRA Audio Reactive
// Dramatic responsiveness throughout the entire song!

let audioFile;
let fft;
let amplitude;
let isPlaying = false;

// Beat detection
let beatHistorySize = 60; // Track last 60 frames (~1 second at 60fps)
let beatHistory = new Array(beatHistorySize).fill(0);
let beatHistoryIndex = 0;
let beatHistoryCount = 0;
let lastBeatTime = 0;
let bpm = 120;
let beat = 0; // Current beat phase 0-1

// Pitch detection
let pitchPeakFreq = 0;
let pitchNote = 0; // 0-11 (C, C#, D, etc.)
let pitchOctave = 0;

// Spectral flux for onset detection
let lastSpectrum = null;
let onsetStrength = 0;

// Fall color palette (organized by warmth: warm colors first, cool colors last)
const warmColors = [
  '#f2c94c', // cadmiumYellow
  '#f29559', // cadmiumOrange
  '#e6a04f', // neutralYellowishOrange
  '#f25c54', // naphtholRed
  '#8B1A1A', // darkRed
  '#6B1A2E', // burgundy
  '#a0522d', // burntSienna
  '#4D2619', // darkBrown
];

const coolColors = [
  '#d4c291', // neutralYellow
  '#483558', // plum
  '#301940', // darkerPurple
  '#2D1833', // deepViolet
  '#1a0a26', // veryDarkPurple
];

let graphics;
let layers = [];
let maxLayers = 5;
let layerIdCounter = 0;

// Performance monitoring
let fpsHistory = [];
let fpsHistorySize = 30; // Track last 30 frames for smooth average

// Layer class with lifecycle and continuous motion
class Layer {
  constructor(colorPalette, entranceDir = null) {
    this.id = layerIdCounter++;
    this.state = 'entering'; // 'entering', 'active', 'exiting'

    // Lifecycle timing
    this.age = 0;
    this.lifespan = 300 + random(200); // Frames before automatic exit
    this.progress = 0; // 0 to 1 for entrance/exit

    // Color palette (changes based on frequency content)
    this.colorPalette = colorPalette || warmColors;
    this.colorIndex = floor(random(this.colorPalette.length));
    this.targetColorIndex = this.colorIndex;

    // Entrance direction
    const directions = ['left', 'right', 'top', 'bottom'];
    this.entranceDir = entranceDir || random(directions);
    this.exitDir = this.getOppositeDir(this.entranceDir);

    // Angle animation - CONTINUOUS
    this.angle = random(360);
    this.angleVelocity = random(-2, 2);
    this.targetAngleVelocity = this.angleVelocity;

    // Scale animation - CONTINUOUS
    this.scale = 1.0;
    this.targetScale = 1.0;
    this.scalePhase = random(TWO_PI);

    // Grid configuration
    this.cells = floor(random(3, 7));
    this.shapeConfig = [];

    // Generate shape grid
    for (let k = 0; k < this.cells; k++) {
      this.shapeConfig[k] = [];
      for (let j = 0; j < this.cells; j++) {
        this.shapeConfig[k][j] = {
          type: floor(random(5)),
          rotation: random(360),
          rotationSpeed: random(-2, 2),
          scale: random(0.7, 1.0),
          pulse: 0,
          colorOffset: floor(random(this.colorPalette.length))
        };
      }
    }

    // Audio-reactive properties
    this.bassResponse = 0;
    this.midResponse = 0;
    this.highResponse = 0;
    this.beatPulse = 0;

    // CREATE GRAPHICS BUFFER ONCE (not every frame!)
    // This is the critical performance fix
    this.graphics = createGraphics(width, height);
    this.graphics.angleMode(DEGREES);
  }

  getOppositeDir(dir) {
    const opposites = {
      'left': 'right',
      'right': 'left',
      'top': 'bottom',
      'bottom': 'top'
    };
    return opposites[dir];
  }

  update(audioData) {
    this.age++;

    // Lifecycle management
    if (this.state === 'entering') {
      this.progress = min(1, this.progress + 0.03 + audioData.rms * 0.05);
      if (this.progress >= 0.99) {
        this.state = 'active';
        this.progress = 1;
      }
    } else if (this.state === 'active') {
      // Check if should exit (low energy or reached lifespan)
      if (audioData.rms < 0.05 && this.age > 120) {
        this.state = 'exiting';
        this.progress = 1;
      } else if (this.age > this.lifespan) {
        this.state = 'exiting';
        this.progress = 1;
      }
    } else if (this.state === 'exiting') {
      this.progress = max(0, this.progress - 0.04);
    }

    // CONTINUOUS ANGLE ROTATION - responds to mids
    this.targetAngleVelocity = map(audioData.mid, 0, 1, -3, 3);
    this.angleVelocity += (this.targetAngleVelocity - this.angleVelocity) * 0.1;
    this.angle += this.angleVelocity;

    // CONTINUOUS SCALE BREATHING - responds to bass
    this.scalePhase += 0.05 + audioData.bass * 0.1;
    this.targetScale = 0.9 + sin(this.scalePhase) * 0.15 + audioData.bass * 0.2;
    this.scale += (this.targetScale - this.scale) * 0.1;

    // Audio responsiveness - smooth following
    this.bassResponse += (audioData.bass - this.bassResponse) * 0.15;
    this.midResponse += (audioData.mid - this.midResponse) * 0.15;
    this.highResponse += (audioData.high - this.highResponse) * 0.15;

    // Beat pulse
    if (audioData.beat && this.state === 'active') {
      this.beatPulse = 1.0;
    }
    this.beatPulse *= 0.8;

    // Dynamic color selection based on spectral centroid
    let targetIdx = floor(map(audioData.spectralCentroid, 0, 300, 0, this.colorPalette.length, true));
    if (targetIdx !== this.targetColorIndex) {
      this.targetColorIndex = targetIdx;
    }
    // Gradually shift to target color
    if (this.colorIndex !== this.targetColorIndex && frameCount % 20 === 0) {
      this.colorIndex = this.targetColorIndex;
    }

    // Rotate individual shapes CONTINUOUSLY
    for (let k = 0; k < this.cells; k++) {
      for (let j = 0; j < this.cells; j++) {
        let config = this.shapeConfig[k][j];

        // Continuous rotation per shape
        config.rotation += config.rotationSpeed * (0.5 + audioData.mid * 1.5);

        // Decay pulse
        config.pulse *= 0.85;

        // Respond to pitch - pulse shapes in different rows
        if (audioData.onsetStrength > 0.3) {
          let row = floor(map(audioData.pitchNote, 0, 12, 0, this.cells));
          if (k === row) {
            config.pulse = audioData.onsetStrength;
          }
        }
      }
    }
  }

  isDead() {
    return this.state === 'exiting' && this.progress <= 0;
  }

  // Properly dispose of graphics buffer when layer is removed
  dispose() {
    if (this.graphics) {
      this.graphics.remove();
      this.graphics = null;
    }
  }

  getTransform() {
    let t = this.progress;
    let eased = this.state === 'entering' ?
      1 - pow(1 - t, 3) :  // Ease out for entrance
      pow(t, 2);            // Ease in for exit

    let offsetX = 0;
    let offsetY = 0;
    let alpha = eased;

    // Entrance/exit animation
    let dir = this.state === 'exiting' ? this.exitDir : this.entranceDir;

    switch(dir) {
      case 'left':
        offsetX = lerp(-width * 1.2, 0, eased);
        break;
      case 'right':
        offsetX = lerp(width * 1.2, 0, eased);
        break;
      case 'top':
        offsetY = lerp(-height * 1.2, 0, eased);
        break;
      case 'bottom':
        offsetY = lerp(height * 1.2, 0, eased);
        break;
    }

    return { offsetX, offsetY, alpha };
  }

  draw(audioData) {
    let transform = this.getTransform();

    if (transform.alpha < 0.01) return;

    // REUSE the graphics buffer created in constructor
    let g = this.graphics;
    g.clear(); // Clear previous frame

    // Get colors from current palette
    let c1 = this.colorPalette[this.colorIndex];
    let c2 = this.colorPalette[(this.colorIndex + 1) % this.colorPalette.length];
    let c3 = this.colorPalette[(this.colorIndex + 2) % this.colorPalette.length];

    // Create gradient with continuous angle
    let r = sqrt(sq(width) + sq(height)) / 2;
    let x1 = width / 2 + cos(this.angle) * r;
    let y1 = height / 2 + sin(this.angle) * r;
    let x2 = width / 2 + cos(this.angle + 180) * r;
    let y2 = height / 2 + sin(this.angle + 180) * r;

    // Gradient steps respond to high frequencies
    let nStep = 1 / floor(2 + this.highResponse * 10);

    let arr = [c1, c2, c3];
    let gradient = g.drawingContext.createLinearGradient(x1, y1, x2, y2);
    let m = 0;
    for (let n = 0; n < 1; n += nStep) {
      gradient.addColorStop(n, arr[m++ % arr.length]);
    }
    g.drawingContext.fillStyle = gradient;
    g.noStroke();
    g.rect(0, 0, width, height);

    // Create geometric cutouts with CONTINUOUS motion
    let off = width / 15;
    let margin = 0;
    let d = floor((width - off * 2 - margin * (this.cells - 1)) / this.cells);

    g.push();
    g.erase(255, 255);
    g.noStroke();

    for (let k = 0; k < this.cells; k++) {
      for (let j = 0; j < this.cells; j++) {
        let config = this.shapeConfig[k][j];

        let dx = floor(off + j * (d + margin) + d / 2);
        let dy = floor(off + k * (d + margin) + d / 2);

        g.push();
        g.translate(dx, dy);
        g.rotate(config.rotation); // CONTINUOUSLY rotating

        // Scale responds to bass + beat pulse + individual pulse
        let pulseFactor = 1.0 + config.pulse * 0.5 + this.beatPulse * 0.3;
        let scaleAmount = config.scale * this.scale * (0.7 + this.bassResponse * 0.5) * pulseFactor;

        switch (config.type) {
          case 0: // Arc
            g.translate(-d / 2, -d / 2);
            g.scale(scaleAmount);
            g.arc(0, 0, d * 2, d * 2, 0, 90);
            break;
          case 1: // Triangle
            g.translate(-d / 2, -d / 2);
            g.scale(scaleAmount);
            g.triangle(0, 0, d, 0, d, d);
            break;
          case 2: // Square
            g.rectMode(CORNER);
            g.translate(-d / 2, -d / 2);
            g.scale(scaleAmount);
            g.rect(0, 0, d, d);
            break;
          case 3: // Circle
            g.rectMode(CENTER);
            g.scale(scaleAmount);
            g.circle(0, 0, d);
            break;
          case 4: // Stretched rect
            g.rectMode(CORNER);
            g.translate(-d / 2, -d / 2);
            g.scale(scaleAmount, 1);
            g.rect(0, 0, d, d);
            break;
        }

        g.pop();
      }
    }
    g.noErase();
    g.pop();

    // Composite layer
    push();
    translate(transform.offsetX, transform.offsetY);

    blendMode(BURN);

    // Brightness responds to highs
    let brightness = 255 + this.highResponse * 50;
    tint(brightness, transform.alpha * 255);

    // Shadow responds to bass
    let shadowBlur = (width / 10) * (0.3 + this.bassResponse * 2);
    drawingContext.shadowColor = color(0, 0, 0, 40 * transform.alpha);
    drawingContext.shadowBlur = shadowBlur;

    image(g, 0, 0);

    drawingContext.shadowBlur = 0;
    pop();
  }
}

function setup() {
  const canvas = createCanvas(800, 800);
  canvas.parent('p5-container');

  angleMode(DEGREES);

  // Create starfield texture
  graphics = createGraphics(width, height);
  graphics.colorMode(HSB, 360, 100, 100, 100);
  graphics.noStroke();

  for (let i = 0; i < (width * height * 10) / 100; i++) {
    graphics.fill(0, 0, 100, 5);
    let x = random(width);
    let y = random(height);
    let w = random(3);
    let h = random(3);
    graphics.ellipse(x, y, w, h);
  }

  // Setup audio
  fft = new p5.FFT(0.8, 1024); // More bins for better pitch detection
  amplitude = new p5.Amplitude();

  setupControls();

  // Initialize with 2 layers
  spawnLayer();
  spawnLayer();
}

function spawnLayer() {
  // Choose color palette based on spectral content
  let palette = random() < 0.5 ? warmColors : coolColors;
  layers.push(new Layer(palette));
}

function draw() {
  // Get audio data
  const audioData = getAudioFeatures();

  // Clear and draw background
  clear();
  background(240);

  // Update and draw all layers
  for (let i = layers.length - 1; i >= 0; i--) {
    if (isPlaying) {
      layers[i].update(audioData);
    }
    layers[i].draw(audioData);

    // Remove dead layers and clean up resources
    if (layers[i].isDead()) {
      layers[i].dispose(); // Clean up graphics buffer
      layers.splice(i, 1);
    }
  }

  // Spawn new layers dynamically based on audio
  if (isPlaying && layers.length < maxLayers) {
    // Spawn on strong onsets
    if (audioData.onsetStrength > 0.6 && random() < 0.3) {
      // Choose palette based on pitch
      let palette = audioData.pitchNote < 6 ? warmColors : coolColors;
      layers.push(new Layer(palette));
    }
    // Also spawn if too few layers
    else if (layers.length < 2 && frameCount % 60 === 0) {
      spawnLayer();
    }
  }

  // Add starfield overlay
  blendMode(ADD);
  image(graphics, 0, 0);
  blendMode(BLEND);

  // Performance monitoring
  let currentFPS = frameRate();
  fpsHistory.push(currentFPS);
  if (fpsHistory.length > fpsHistorySize) {
    fpsHistory.shift();
  }
  let avgFPS = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;

  // Debug info with performance metrics
  push();
  fill(0, 0, 0, 150);
  noStroke();
  rect(5, 5, 220, 120);

  fill(255);
  textSize(11);
  textAlign(LEFT);

  // Performance metrics (top section)
  fill(0, 255, 100); // Green for performance
  text(`FPS: ${avgFPS.toFixed(1)}`, 10, 20);
  text(`Graphics buffers: ${layers.length}`, 10, 35);

  // Audio metrics (middle section)
  fill(255);
  text(`Layers: ${layers.length}/${maxLayers}`, 10, 55);
  text(`BPM: ${bpm.toFixed(0)}`, 10, 70);
  text(`Beat: ${(beat * 100).toFixed(0)}%`, 10, 85);
  text(`Onset: ${(audioData.onsetStrength * 100).toFixed(0)}%`, 10, 100);
  text(`Pitch: ${getNoteName(audioData.pitchNote, audioData.pitchOctave)}`, 10, 115);
  pop();

  // Beat indicator
  if (audioData.beat) {
    push();
    fill(255, 0, 0, 200);
    noStroke();
    circle(width - 30, 30, 20);
    pop();
  }
}

function getNoteName(note, octave) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return notes[note] + octave;
}

function getAudioFeatures() {
  if (!audioFile || !isPlaying) {
    return {
      bass: 0,
      mid: 0,
      high: 0,
      rms: 0,
      beat: false,
      onsetStrength: 0,
      spectralCentroid: 0,
      pitchNote: 0,
      pitchOctave: 4
    };
  }

  const spectrum = fft.analyze();
  const bassEnd = floor(spectrum.length * 0.1);
  const midEnd = floor(spectrum.length * 0.5);

  const bass = spectrum.slice(0, bassEnd).reduce((a, b) => a + b, 0) / bassEnd / 255;
  const mid = spectrum.slice(bassEnd, midEnd).reduce((a, b) => a + b, 0) / (midEnd - bassEnd) / 255;
  const high = spectrum.slice(midEnd).reduce((a, b) => a + b, 0) / (spectrum.length - midEnd) / 255;

  const rms = amplitude.getLevel();

  // Calculate spectral centroid
  let weightedSum = 0;
  let magnitudeSum = 0;
  for (let i = 0; i < spectrum.length; i++) {
    weightedSum += i * spectrum[i];
    magnitudeSum += spectrum[i];
  }
  const spectralCentroid = magnitudeSum > 0 ? (weightedSum / magnitudeSum) : 0;

  // Onset detection using spectral flux
  if (!lastSpectrum) {
    lastSpectrum = spectrum.slice();
  }

  let flux = 0;
  for (let i = 0; i < spectrum.length; i++) {
    let diff = spectrum[i] - lastSpectrum[i];
    if (diff > 0) flux += diff;
  }
  lastSpectrum = spectrum.slice();

  onsetStrength = constrain(flux / 10000, 0, 1);

  // Beat detection using onset history - circular buffer
  beatHistory[beatHistoryIndex] = onsetStrength;
  beatHistoryIndex = (beatHistoryIndex + 1) % beatHistorySize;
  if (beatHistoryCount < beatHistorySize) {
    beatHistoryCount++;
  }

  let beatDetected = false;
  if (beatHistoryCount >= 10) {
    // Calculate recent average (last 10 samples)
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      let idx = (beatHistoryIndex - 10 + i + beatHistorySize) % beatHistorySize;
      sum += beatHistory[idx];
    }
    let recentAvg = sum / 10;
    let threshold = recentAvg * 2.5;

    if (onsetStrength > threshold && millis() - lastBeatTime > 200) {
      beatDetected = true;
      lastBeatTime = millis();

      // Update BPM estimate
      if (lastBeatTime > 0) {
        let timeBetweenBeats = (millis() - lastBeatTime) / 1000;
        let instantBPM = 60 / timeBetweenBeats;
        bpm = bpm * 0.9 + instantBPM * 0.1; // Smooth
      }
    }
  }

  // Beat phase for continuous beat sync
  let beatPeriod = 60 / bpm * 1000; // ms
  beat = ((millis() % beatPeriod) / beatPeriod);

  // Pitch detection - find peak frequency
  let peakBin = 0;
  let peakVal = 0;
  for (let i = 1; i < spectrum.length / 2; i++) { // Only look at lower half
    if (spectrum[i] > peakVal && spectrum[i] > 30) { // Threshold to avoid noise
      peakVal = spectrum[i];
      peakBin = i;
    }
  }

  // Convert bin to frequency
  let nyquist = 22050; // p5.sound assumes 44100 Hz sample rate
  pitchPeakFreq = (peakBin * nyquist) / (spectrum.length / 2);

  // Convert frequency to note (using A440 tuning)
  if (pitchPeakFreq > 20) {
    let noteNum = 12 * (Math.log2(pitchPeakFreq / 440)) + 69; // MIDI note number
    pitchNote = floor(noteNum) % 12;
    pitchOctave = floor(noteNum / 12) - 1;
  }

  return {
    bass,
    mid,
    high,
    rms,
    beat: beatDetected,
    onsetStrength,
    spectralCentroid,
    pitchNote,
    pitchOctave
  };
}

function setupControls() {
  const fileInput = select('#audioFile');
  const playPauseBtn = select('#playPause');
  const stopBtn = select('#stop');
  const regenerateBtn = select('#regenerate');
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
      // Clear and reset layers - properly dispose first
      layers.forEach(layer => layer.dispose());
      layers = [];
      spawnLayer();
      spawnLayer();
    }
  });

  regenerateBtn.mousePressed(() => {
    // Regenerate starfield
    graphics.clear();
    for (let i = 0; i < (width * height * 10) / 100; i++) {
      graphics.fill(0, 0, 100, 5);
      let x = random(width);
      let y = random(height);
      let w = random(3);
      let h = random(3);
      graphics.ellipse(x, y, w, h);
    }

    // Regenerate layers - properly dispose first
    layers.forEach(layer => layer.dispose());
    layers = [];
    spawnLayer();
    spawnLayer();
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight - 120);

  // Regenerate starfield at new size
  graphics = createGraphics(width, height);
  graphics.colorMode(HSB, 360, 100, 100, 100);
  graphics.noStroke();

  for (let i = 0; i < (width * height * 10) / 100; i++) {
    graphics.fill(0, 0, 100, 5);
    let x = random(width);
    let y = random(height);
    let w = random(3);
    let h = random(3);
    graphics.ellipse(x, y, w, h);
  }

  // Reset layers - properly dispose first
  layers.forEach(layer => layer.dispose());
  layers = [];
  spawnLayer();
  spawnLayer();
}
