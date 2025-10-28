// P5.js Geometric Layers - Calm Audio Reactive
// Based on original OpenProcessing sketch with subtle audio breathing

let audioFile;
let fft;
let amplitude;
let isPlaying = false;

// Color palette
let palette;
let graphics; // Starfield texture

// Layer graphics (created once for performance)
let layerGraphics = [];
let numLayers = 0;

// Shape animation data (each shape can move independently)
let shapeAnimations = [];

// Audio smoothing - smooth response
let smoothBass = 0;
let smoothMid = 0;
let smoothHigh = 0;
let smoothRms = 0;

// Beat detection for particles
let lastSpectrum = null;
let onsetStrength = 0;
let beatThreshold = 0.2; // Very low threshold for staccato string sensitivity

// Beat shapes that flow across screen
let beatShapes = [];
let maxBeatShapes = 150; // Allow many shapes for staccato responsiveness

// Visual parameters that respond to audio
let baseAngle = 0; // Static angle for gradients (no rotation)
let globalScale = 1.0;
let targetScale = 1.0;
let shadowIntensity = 1.0;

// Composition crossfade
let oldLayerGraphics = [];
let oldShapeAnimations = [];
let crossfadeProgress = 1.0; // 0 = old, 1 = new
let isCrossfading = false;

// Regeneration
let regenCooldown = 2000; // Min 2 seconds between regenerations
let lastRegenTime = 0;

// Recording mode
let autoRegenEnabled = false;
let autoRegenInterval = 15000; // 15 seconds
let lastAutoRegenTime = 0;
let aspectRatio169 = false;

// On-canvas button
let regenButton = {
  x: 0,
  y: 0,
  w: 120,
  h: 40,
  visible: true,
  hover: false
};

// BeatShape - geometric shapes that flow across screen on beats
class BeatShape {
  constructor(x, y, intensity, sourceShape = null) {
    this.x = x;
    this.y = y;

    // Color from source shape if available, otherwise from palette
    if (sourceShape) {
      // Inherit color from the composition shape that spawned this
      this.color = palette[sourceShape.layerIndex % palette.length];
    } else if (palette && palette.length > 0) {
      this.color = random(palette);
    } else {
      this.color = '#f2c94c';
    }

    // Random shape type
    this.type = floor(random(5)); // 0=arc, 1=triangle, 2=square, 3=circle, 4=line

    // Size based on intensity
    this.size = random(20, 50) * (0.7 + intensity * 0.6);
    this.baseSize = this.size;

    // Movement - unified flow direction based on composition gradient angle
    if (sourceShape) {
      // All shapes flow in the same direction as the gradient
      // This creates a unified visual stream instead of explosion
      let flowAngle = baseAngle * (PI / 180); // Convert to radians
      let speed = random(1, 2.5); // Slower movement - was 3-5

      // Add slight variation so shapes don't move in perfect line
      let angleVariation = random(-0.3, 0.3); // ±17 degrees variation

      this.vx = cos(flowAngle + angleVariation) * speed;
      this.vy = sin(flowAngle + angleVariation) * speed;
    } else {
      // Fallback to random movement if no source
      let moveType = random();
      if (moveType < 0.25) {
        // Move upward
        this.vx = random(-0.5, 0.5);
        this.vy = random(-3, -1);
      } else if (moveType < 0.5) {
        // Move outward from center
        let dx = x - width / 2;
        let dy = y - height / 2;
        let mag = sqrt(dx * dx + dy * dy);
        this.vx = (dx / mag) * random(1.5, 3);
        this.vy = (dy / mag) * random(1.5, 3);
      } else if (moveType < 0.75) {
        // Move diagonally
        this.vx = random(-3, 3);
        this.vy = random(-3, 3);
      } else {
        // Spiral outward
        let angle = random(TWO_PI);
        this.vx = cos(angle) * random(2, 4);
        this.vy = sin(angle) * random(2, 4);
      }
    }

    // Rotation
    this.rotation = random(TWO_PI);
    this.rotationSpeed = random(-0.15, 0.15);

    // Pulse phase
    this.pulsePhase = random(TWO_PI);
  }

  update() {
    // Move
    this.x += this.vx;
    this.y += this.vy;

    // Rotate
    this.rotation += this.rotationSpeed;

    // Pulse with audio
    this.pulsePhase += 0.1;
    let pulse = 1.0 + sin(this.pulsePhase) * 0.3 * smoothBass;
    this.size = this.baseSize * pulse;
  }

  isOffScreen() {
    let margin = 100;
    return this.x < -margin || this.x > width + margin ||
           this.y < -margin || this.y > height + margin;
  }

  draw() {
    push();
    translate(this.x, this.y);
    rotate(this.rotation);

    let c = color(this.color);
    let r = red(c);
    let g = green(c);
    let b = blue(c);

    // Glow
    drawingContext.shadowBlur = 15 + smoothHigh * 15;
    drawingContext.shadowColor = `rgba(${r}, ${g}, ${b}, 0.7)`;

    noStroke();
    fill(r, g, b, 200);

    // Draw shape based on type
    if (this.type === 0) {
      // Arc
      arc(0, 0, this.size, this.size, 0, PI);
    } else if (this.type === 1) {
      // Triangle
      triangle(-this.size/2, this.size/2, this.size/2, this.size/2, 0, -this.size/2);
    } else if (this.type === 2) {
      // Square
      rectMode(CENTER);
      rect(0, 0, this.size, this.size);
    } else if (this.type === 3) {
      // Circle
      circle(0, 0, this.size);
    } else {
      // Line/dash
      strokeWeight(6);
      stroke(r, g, b, 200);
      line(-this.size/2, 0, this.size/2, 0);
    }

    drawingContext.shadowBlur = 0;
    pop();
  }
}

function setup() {
  let canvasWidth = 800;
  let canvasHeight = 800;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent('p5-container');

  angleMode(DEGREES);

  // Position regenerate button (bottom-right corner with margin)
  updateButtonPosition();

  // Create starfield texture ONCE
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
  fft = new p5.FFT(0.8, 512);
  amplitude = new p5.Amplitude();

  setupControls();

  // Generate initial composition
  generateComposition();
}

function generateComposition(triggerCrossfade = false) {
  // Start crossfade if requested
  if (triggerCrossfade && layerGraphics.length > 0) {
    // Save old composition
    oldLayerGraphics = layerGraphics.slice();
    oldShapeAnimations = JSON.parse(JSON.stringify(shapeAnimations));
    crossfadeProgress = 0;
    isCrossfading = true;
  } else {
    // Clean up old graphics buffers
    layerGraphics.forEach(g => g.remove());
  }

  layerGraphics = [];
  shapeAnimations = [];

  // Get random color palette from chromotome
  palette = shuffle(chromotome.get().colors);

  // Random angle (static - no rotation)
  baseAngle = int(random(12)) * 30;

  // Number of layers based on palette
  numLayers = min(palette.length, 6); // Max 6 layers for performance

  // Pre-create all layer graphics ONCE (performance fix)
  let rs = random(10000);

  for (let i = 0; i < numLayers; i++) {
    let g = createGraphics(width, height);
    g.angleMode(DEGREES);

    // Colors for this layer
    let c1 = palette[i % palette.length];
    let c2 = palette[(i + 1) % palette.length];
    let c3 = palette[(i + 2) % palette.length];

    // Gradient background
    let r = sqrt(sq(width) + sq(height)) / 2;
    let arr = shuffle([c1, c2, c3]);
    let nStep = 1 / int(random(3, 10));

    // Store gradient parameters (static)
    g.userData = {
      colors: arr,
      nStep: nStep,
      randomSeed: rs,
      cells: int(random(2, 10)) // Match original: 2-10 cells for dense grids
    };

    // Draw gradient (once, no rotation)
    updateLayerGradient(g, i, baseAngle);

    // Add geometric cutouts with animation data
    if (i != 0) {
      createAnimatedShapes(g, i, rs);
    }

    layerGraphics.push(g);
  }

  lastRegenTime = millis();
}

function createAnimatedShapes(g, layerIndex, rs) {
  randomSeed(rs);

  let cells = g.userData.cells;
  let off = width / 15;
  let margin = 0;
  let d = int((width - off * 2 - margin * (cells - 1)) / cells);
  let layerScale = layerIndex / (numLayers - 1);

  // Create animation data for each shape
  for (let k = 0; k < cells; k++) {
    for (let j = 0; j < cells; j++) {
      let shape_num = int(random(2)); // Only arcs and triangles like original!
      let baseRotation = (int(random(4)) * 360) / 4;

      shapeAnimations.push({
        layerIndex: layerIndex,
        col: j,
        row: k,
        x: int(off + j * (d + margin) + d / 2),
        y: int(off + k * (d + margin) + d / 2),
        size: d,
        type: shape_num,
        baseRotation: baseRotation,
        rotation: baseRotation,
        targetRotation: baseRotation,
        scale: layerScale,
        pulsePhase: random(TWO_PI),
        rotationSpeed: random(-0.3, 0.3)
      });
    }
  }
}

function updateLayerGradient(g, layerIndex, angle) {
  g.clear();

  let r = sqrt(sq(width) + sq(height)) / 2;
  let x1 = width / 2 + cos(angle) * r;
  let y1 = height / 2 + sin(angle) * r;
  let x2 = width / 2 + cos(angle + 180) * r;
  let y2 = height / 2 + sin(angle + 180) * r;

  let gradient = g.drawingContext.createLinearGradient(x1, y1, x2, y2);
  let m = 0;
  for (let n = 0; n < 1; n += g.userData.nStep) {
    gradient.addColorStop(n, g.userData.colors[m++ % g.userData.colors.length]);
  }
  g.drawingContext.fillStyle = gradient;
  g.noStroke();
  g.rect(0, 0, width, height);
}

function updateAnimatedShapes() {
  // Redraw shapes with current animation values
  for (let i = 1; i < layerGraphics.length; i++) {
    let g = layerGraphics[i];

    // FIRST: Redraw the gradient to restore full background
    updateLayerGradient(g, i, baseAngle);

    // THEN: Apply animated cutouts with erase
    g.push();
    g.erase(255, 255);
    g.noStroke();

    // Find shapes for this layer
    let layerShapes = shapeAnimations.filter(s => s.layerIndex === i);

    for (let shape of layerShapes) {
      g.push();
      g.translate(shape.x, shape.y);
      g.rotate(shape.rotation); // Animated rotation

      // Subtle pulse scale based on bass + individual phase
      let pulseScale = 1.0 + sin(shape.pulsePhase) * 0.05 * smoothBass;
      let finalScale = shape.scale * pulseScale;

      let d = shape.size;

      switch (shape.type) {
        case 0: // Arc
          g.translate(-d / 2, -d / 2);
          g.scale(finalScale);
          g.arc(0, 0, d * 2, d * 2, 0, 90);
          break;
        case 1: // Triangle
          g.translate(-d / 2, -d / 2);
          g.scale(finalScale);
          g.triangle(0, 0, d, 0, d, d);
          break;
        case 2: // Square
          g.rectMode(CORNER);
          g.translate(-d / 2, -d / 2);
          g.scale(finalScale);
          g.rect(0, 0, d, d);
          break;
        case 3: // Circle
          g.rectMode(CENTER);
          g.scale(finalScale);
          g.circle(0, 0, d);
          break;
        case 4: // Stretched rect
          g.rectMode(CORNER);
          g.translate(-d / 2, -d / 2);
          g.scale(finalScale, 1);
          g.rect(0, 0, d, d);
          break;
      }

      g.pop();
    }

    g.noErase();
    g.pop();
  }
}

function addGeometricCutouts(g, layerIndex, rs) {
  randomSeed(rs);

  let cells = int(random(3, 7)); // Fewer cells for cleaner look
  let off = width / 15;
  let margin = 0;
  let d = int((width - off * 2 - margin * (cells - 1)) / cells);

  g.push();
  g.erase(255, 255);
  g.noStroke();

  for (let k = 0; k < cells; k++) {
    for (let j = 0; j < cells; j++) {
      let shape_num = int(random(5)); // 5 shape types
      let dx = int(off + j * (d + margin) + d / 2);
      let dy = int(off + k * (d + margin) + d / 2);

      g.push();
      g.translate(dx, dy);
      g.rotate((int(random(4)) * 360) / 4);

      // Scale based on layer index (original's approach)
      let layerScale = layerIndex / (numLayers - 1);

      switch (shape_num) {
        case 0: // Arc
          g.translate(-d / 2, -d / 2);
          g.scale(layerScale);
          g.arc(0, 0, d * 2, d * 2, 0, 90);
          break;
        case 1: // Triangle
          g.translate(-d / 2, -d / 2);
          g.scale(layerScale);
          g.triangle(0, 0, d, 0, d, d);
          break;
        case 2: // Square
          g.rectMode(CORNER);
          g.translate(-d / 2, -d / 2);
          g.scale(layerScale);
          g.rect(0, 0, d, d);
          break;
        case 3: // Circle
          g.rectMode(CENTER);
          g.scale(layerScale);
          g.circle(0, 0, d);
          break;
        case 4: // Stretched rect
          g.rectMode(CORNER);
          g.translate(-d / 2, -d / 2);
          g.scale(layerScale, 1);
          g.rect(0, 0, d, d);
          break;
      }

      g.pop();
    }
  }

  g.noErase();
  g.pop();
}

function draw() {
  // Get audio features with smooth interpolation
  const audioData = getAudioFeatures();

  // Smooth audio response
  smoothBass += (audioData.bass - smoothBass) * 0.02;
  smoothMid += (audioData.mid - smoothMid) * 0.02;
  smoothHigh += (audioData.high - smoothHigh) * 0.02;
  smoothRms += (audioData.rms - smoothRms) * 0.03;

  // Subtle global scale breathing based on bass
  targetScale = 0.94 + smoothBass * 0.12; // Scale between 0.94 and 1.06
  globalScale += (targetScale - globalScale) * 0.02;

  // Subtle shadow intensity based on highs
  shadowIntensity = 0.8 + smoothHigh * 0.4;

  // Keep shapes static - only subtle breathing, no rotation
  for (let shape of shapeAnimations) {
    // Pulse phase for subtle scale breathing per shape only
    shape.pulsePhase += 0.02;

    // Shapes stay at their base rotation - no continuous spinning
  }

  // Spawn flowing geometric shapes on beats - FROM varied positions
  if (audioData.beat && beatShapes.length < maxBeatShapes && shapeAnimations.length > 0) {
    // Spawn 8-15 shapes per beat based on intensity
    let numShapes = floor(8 + audioData.onsetStrength * 7);

    for (let i = 0; i < numShapes; i++) {
      let sourceShape = random(shapeAnimations);
      let x, y;

      // Varied spawn positions
      let spawnType = random();

      if (spawnType < 0.5) {
        // 50% - From composition shapes (edges)
        let edgeAngle = random(TWO_PI);
        let edgeDistance = sourceShape.size / 2;
        x = sourceShape.x + cos(edgeAngle) * edgeDistance;
        y = sourceShape.y + sin(edgeAngle) * edgeDistance;
      } else if (spawnType < 0.7) {
        // 20% - From screen edges
        let edge = floor(random(4)); // 0=top, 1=right, 2=bottom, 3=left
        if (edge === 0) {
          x = random(width);
          y = 0;
        } else if (edge === 1) {
          x = width;
          y = random(height);
        } else if (edge === 2) {
          x = random(width);
          y = height;
        } else {
          x = 0;
          y = random(height);
        }
      } else if (spawnType < 0.85) {
        // 15% - From center area
        x = width / 2 + random(-100, 100);
        y = height / 2 + random(-100, 100);
      } else {
        // 15% - Random positions
        x = random(width);
        y = random(height);
      }

      beatShapes.push(new BeatShape(x, y, audioData.onsetStrength, sourceShape));
    }
  }

  // Update and clean up beat shapes
  for (let i = beatShapes.length - 1; i >= 0; i--) {
    beatShapes[i].update();
    if (beatShapes[i].isOffScreen()) {
      beatShapes.splice(i, 1);
    }
  }

  // Update crossfade
  if (isCrossfading) {
    crossfadeProgress += 0.02; // 2% per frame = ~3 second crossfade
    if (crossfadeProgress >= 1.0) {
      crossfadeProgress = 1.0;
      isCrossfading = false;
      // Clean up old graphics
      oldLayerGraphics.forEach(g => g.remove());
      oldLayerGraphics = [];
      oldShapeAnimations = [];
    }
  }

  // Auto-regeneration for recording mode
  if (autoRegenEnabled && isPlaying && !isCrossfading) {
    if (millis() - lastAutoRegenTime > autoRegenInterval) {
      generateComposition(true);
      lastAutoRegenTime = millis();
    }
  }

  // Check mouse hover for on-canvas button
  regenButton.hover = isMouseOverButton();

  // Redraw animated shapes onto layers
  updateAnimatedShapes();

  // Clear and draw
  clear();
  background(240);

  // Draw with crossfade if active
  push();
  translate(width / 2, height / 2);
  scale(globalScale); // Subtle breathing
  translate(-width / 2, -height / 2);

  // Draw old composition (fading out)
  if (isCrossfading && oldLayerGraphics.length > 0) {
    push();
    drawingContext.globalAlpha = 1.0 - crossfadeProgress;
    for (let i = 0; i < oldLayerGraphics.length; i++) {
      blendMode(BURN);
      let shadowBlur = (width / 10) * shadowIntensity;
      drawingContext.shadowColor = color(0, 0, 0, 33);
      drawingContext.shadowBlur = shadowBlur;
      image(oldLayerGraphics[i], 0, 0);
    }
    pop();
  }

  // Draw new composition (fading in if crossfading, otherwise full opacity)
  push();
  if (isCrossfading) {
    drawingContext.globalAlpha = crossfadeProgress;
  }
  for (let i = 0; i < layerGraphics.length; i++) {
    blendMode(BURN);
    let shadowBlur = (width / 10) * shadowIntensity;
    drawingContext.shadowColor = color(0, 0, 0, 33);
    drawingContext.shadowBlur = shadowBlur;
    image(layerGraphics[i], 0, 0);
  }
  pop();

  pop();

  // Add starfield
  blendMode(ADD);
  image(graphics, 0, 0);
  blendMode(BLEND);

  // Draw flowing beat shapes
  for (let shape of beatShapes) {
    shape.draw();
  }

  // Debug info with visual indicators
  push();
  fill(0, 0, 0, 150);
  noStroke();
  let debugHeight = autoRegenEnabled ? 135 : 120;
  rect(5, 5, 240, debugHeight);

  fill(255);
  textSize(11);
  textAlign(LEFT);
  text(`FPS: ${frameRate().toFixed(1)}`, 10, 20);
  text(`Layers: ${layerGraphics.length} | Shapes: ${shapeAnimations.length}`, 10, 35);
  text(`Beat Shapes: ${beatShapes.length}/${maxBeatShapes}`, 10, 50);

  // Audio bars to show it's working
  fill(100, 200, 100);
  text(`Bass: ${(smoothBass * 100).toFixed(0)}%`, 10, 65);
  rect(80, 57, smoothBass * 150, 8);

  fill(100, 150, 200);
  text(`Mid: ${(smoothMid * 100).toFixed(0)}%`, 10, 80);
  rect(80, 72, smoothMid * 150, 8);

  fill(200, 150, 100);
  text(`High: ${(smoothHigh * 100).toFixed(0)}%`, 10, 95);
  rect(80, 87, smoothHigh * 150, 8);

  fill(255);
  text(`Scale: ${globalScale.toFixed(3)}`, 10, 110);

  // Show crossfade status
  if (isCrossfading) {
    fill(255, 200, 100);
    text(`Crossfading: ${(crossfadeProgress * 100).toFixed(0)}%`, 10, 110);
  }

  // Show auto-regen countdown if enabled
  if (autoRegenEnabled && isPlaying) {
    let timeLeft = max(0, (autoRegenInterval - (millis() - lastAutoRegenTime)) / 1000);
    fill(100, 255, 150);
    text(`Auto-regen: ${timeLeft.toFixed(0)}s`, 10, 125);
  }
  pop();

  // Draw on-canvas regenerate button (visible in fullscreen)
  drawRegenButton();
}

function updateButtonPosition() {
  regenButton.x = width - regenButton.w - 20;
  regenButton.y = height - regenButton.h - 20;
}

function isMouseOverButton() {
  return mouseX >= regenButton.x &&
         mouseX <= regenButton.x + regenButton.w &&
         mouseY >= regenButton.y &&
         mouseY <= regenButton.y + regenButton.h;
}

function drawRegenButton() {
  if (!regenButton.visible) return;

  push();
  // Button background
  if (regenButton.hover) {
    fill(80, 80, 80, 220);
  } else {
    fill(50, 50, 50, 180);
  }
  noStroke();
  rect(regenButton.x, regenButton.y, regenButton.w, regenButton.h, 5);

  // Button text
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(14);
  text('Regenerate', regenButton.x + regenButton.w / 2, regenButton.y + regenButton.h / 2);
  pop();
}

function mousePressed() {
  // Check if clicked on regenerate button
  if (isMouseOverButton()) {
    if (millis() - lastRegenTime > regenCooldown && !isCrossfading) {
      generateComposition(true);
    }
  }
}

function getAudioFeatures() {
  if (!audioFile || !isPlaying) {
    return {
      bass: 0,
      mid: 0,
      high: 0,
      rms: 0,
      beat: false,
      onsetStrength: 0
    };
  }

  const spectrum = fft.analyze();
  const bassEnd = floor(spectrum.length * 0.1);
  const midEnd = floor(spectrum.length * 0.5);

  const bass = spectrum.slice(0, bassEnd).reduce((a, b) => a + b, 0) / bassEnd / 255;
  const mid = spectrum.slice(bassEnd, midEnd).reduce((a, b) => a + b, 0) / (midEnd - bassEnd) / 255;
  const high = spectrum.slice(midEnd).reduce((a, b) => a + b, 0) / (spectrum.length - midEnd) / 255;
  const rms = amplitude.getLevel();

  // Beat detection using spectral flux (onset detection)
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

  // Detect beat if onset exceeds threshold
  let beatDetected = onsetStrength > beatThreshold;

  return { bass, mid, high, rms, beat: beatDetected, onsetStrength };
}

function setupControls() {
  const fileInput = select('#audioFile');
  const playPauseBtn = select('#playPause');
  const stopBtn = select('#stop');
  const regenerateBtn = select('#regenerate');
  const fullscreenBtn = select('#fullscreen');
  const aspectRatioCheckbox = select('#aspectRatio169');
  const autoRegenCheckbox = select('#autoRegen');
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
      // Ensure audio context is started (browser autoplay fix)
      userStartAudio();
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

  regenerateBtn.mousePressed(() => {
    // Only allow manual regen if cooldown has passed and not currently crossfading
    if (millis() - lastRegenTime > regenCooldown && !isCrossfading) {
      generateComposition(true); // Trigger crossfade
    }
  });

  fullscreenBtn.mousePressed(() => {
    let fs = fullscreen();
    fullscreen(!fs);
    if (!fs) {
      fullscreenBtn.html('⛶ Exit Fullscreen');
    } else {
      fullscreenBtn.html('⛶ Fullscreen');
    }
  });

  // Aspect ratio toggle
  aspectRatioCheckbox.changed(() => {
    aspectRatio169 = aspectRatioCheckbox.elt.checked;
    updateCanvasSize();
  });

  // Auto-regeneration toggle
  autoRegenCheckbox.changed(() => {
    autoRegenEnabled = autoRegenCheckbox.elt.checked;
    if (autoRegenEnabled) {
      lastAutoRegenTime = millis(); // Reset timer
      statusText.html('📹 Recording mode: Auto-regenerate every 15s');
    } else {
      statusText.html(isPlaying ? '▶ Playing...' : 'Stopped');
    }
  });
}

function updateCanvasSize() {
  let newWidth, newHeight;

  if (aspectRatio169) {
    // 16:9 aspect ratio (common for video recording)
    newWidth = 1920;
    newHeight = 1080;
  } else {
    // Square (original)
    newWidth = 800;
    newHeight = 800;
  }

  resizeCanvas(newWidth, newHeight);

  // Update button position
  updateButtonPosition();

  // Regenerate starfield at new size
  graphics.remove();
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

  // Regenerate composition at new size
  generateComposition(false);
}

function windowResized() {
  // Don't auto-resize if in 16:9 mode or fullscreen
  if (aspectRatio169 || fullscreen()) return;

  resizeCanvas(windowWidth, windowHeight - 120);

  // Update button position
  updateButtonPosition();

  // Regenerate at new size
  graphics.remove();
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

  generateComposition(false); // No crossfade on resize
}
