// p5.brush v2 — Optimized for Audio Responsiveness and Fall Palette
// Synchronized with genart-sketches aesthetic
// Audio-responsive brush dynamics: bass drives weight, mid drives frequency, high drives vibration

// ─── Fall Palette (shared with genart-sketches) ─────────────────────────────
const FALL_PALETTE = [
  { h: 48,  s: 95, l: 60 },  // Cadmium Yellow
  { h: 355, s: 85, l: 50 },  // Naphthol Red
  { h: 25,  s: 90, l: 55 },  // Cadmium Orange
  { h: 0,   s: 80, l: 28 },  // Dark Red
  { h: 345, s: 70, l: 25 },  // Burgundy
  { h: 15,  s: 65, l: 30 },  // Dark Brown
  { h: 40,  s: 75, l: 58 },  // Neutral Orange
  { h: 50,  s: 45, l: 65 },  // Yellow
];

// Hex versions for p5.brush (converting HSL to hex)
var PALETTE = [
  "#d4af37", // Golden Yellow
  "#ff4500", // Cadmium Orange
  "#8b0000", // Dark Red
  "#800020", // Burgundy
  "#3d2817", // Dark Brown
  "#d2691e", // Chocolate
  "#cc5500", // Orange
  "#ffd700"  // Gold
];

var BEAT_PALETTE = ["#ff4500", "#d4af37", "#800020", "#8b0000"];
var BG_HEX = "#0a0a0a";
var BG_RGB = [10, 10, 10];

// Seed strokes use a mix of all custom + select defaults
var SEED_BRUSHES = [
  "dry_rake", "calligraphy", "ink_wash", "thick_oil", "needle",
  "marker", "charcoal", "2B"
];

// ─── State ──────────────────────────────────────────────────────────────────
var audioEngine;
var fieldAngle = 0;
var fieldScale = 1.0;
var frameT = 0;
var brushScale = 1;
var brushReady = false;
var spiralCount = 0;
var needsReseed = true;

// ─── Synthetic features for non-audio mode ──────────────────────────────────
function generateSyntheticFeatures(t) {
  return {
    bass:     0.15 + 0.1 * Math.sin(t * 0.3),
    mid:      0.12 + 0.08 * noise(t * 0.5),
    high:     0.08 + 0.05 * noise(t * 0.9 + 100),
    rms:      0.08 + 0.05 * Math.sin(t * 0.4),
    centroid: 0.3 + 0.2 * noise(t * 0.15 + 200),
    beatFlash: Math.sin(t * 0.8) > 0.985 ? 1.0 : 0,
    bpm:      72,
    spectralFlux: 0,
  };
}

// ─── Custom Brush Definitions ───────────────────────────────────────────────

function registerCustomBrushes() {
  // 1. DRY RAKE — parallel textured strokes like a comb/rake
  //    Character: multi-line marks, organic texture
  brush.add("dry_rake", {
    type: "custom", weight: 5, vibration: 0.6,
    opacity: 30, spacing: 0.7, blend: true,
    pressure: { type: "standard", curve: [0.2, 0.3], min_max: [0.7, 1.3] },
    tip: function(_m) {
      for (var i = -3; i <= 3; i++) _m.rect(i * 1.8, -1.5, 0.4, 3);
    },
    rotate: "natural"
  });

  // 2. CALLIGRAPHY — elongated nib with swelling pressure
  //    Character: elegant thick-thin variation, perfect for spirals
  brush.add("calligraphy", {
    type: "custom", weight: 3.5, vibration: 0.15,
    opacity: 45, spacing: 0.35, blend: true,
    pressure: {
      type: "custom", min_max: [0.5, 1.4],
      curve: function(x) { return 0.5 + 0.5 * Math.sin(x * Math.PI); }
    },
    tip: function(_m) { _m.rect(-4, -0.5, 8, 1); },
    rotate: "natural"
  });

  // 3. INK WASH — soft translucent washes like diluted ink
  //    Character: wide, ghostly, layers beautifully
  brush.add("ink_wash", {
    type: "custom", weight: 10, vibration: 2.5,
    opacity: 10, spacing: 0.4, blend: true,
    pressure: { type: "standard", curve: [0.1, 0.2], min_max: [0.8, 1.2] },
    tip: function(_m) {
      _m.ellipse(0, 0, 7, 3);
      _m.ellipse(1.5, 0.8, 4, 2);
    },
    rotate: "natural"
  });

  // 4. SPLATTER — explosive scattered dots
  //    Character: chaotic spray, unmistakable beat impact
  brush.add("splatter", {
    type: "spray", weight: 0.9, vibration: 25,
    quality: 55, opacity: 100, spacing: 0.9,
    blend: false,
    pressure: { type: "standard", curve: [0.15, 0.25], min_max: [0.4, 1.6] }
  });

  // 5. THICK OIL — bold marker with color mixing
  //    Character: fat oil-paint strokes, bold and saturated
  brush.add("thick_oil", {
    type: "marker", weight: 4.5, vibration: 0.25,
    opacity: 50, spacing: 0.3, blend: true,
    pressure: { type: "standard", curve: [0.25, 0.2], min_max: [0.9, 1.5] }
  });

  // 6. NEEDLE — ultra-fine precise line
  //    Character: hair-thin, high contrast against thick brushes
  brush.add("needle", {
    type: "default", weight: 0.12, vibration: 0.08,
    definition: 0.95, quality: 2, opacity: 210,
    spacing: 0.08, blend: false,
    pressure: { type: "standard", curve: [0.05, 0.1], min_max: [0.9, 1.05] }
  });

  console.log("Custom brushes registered:", brush.box());
}

// ─── p5 Setup ───────────────────────────────────────────────────────────────
function setup() {
  var container = document.getElementById('canvas-container');
  var w = container.clientWidth || 800;
  var h = container.clientHeight || 600;

  var cnv = createCanvas(w, h, WEBGL);
  cnv.parent('canvas-container');
  pixelDensity(1);
  angleMode(DEGREES);
  frameRate(30);

  try {
    brushScale = w / 800;
    brush.scale(brushScale);
    brush.load();
    brush.scaleBrushes(1.5);

    // Register custom brushes AFTER brush.load()
    registerCustomBrushes();

    // Custom audio-reactive flow field
    brush.addField("audio_flow", function(t, field) {
      var cols = field.length;
      var rows = field[0].length;
      for (var c = 0; c < cols; c++) {
        for (var r = 0; r < rows; r++) {
          var angle = map(
            noise(c * 0.025 + t * 0.006, r * 0.025 + t * 0.006),
            0, 1, -35, 35
          );
          angle += fieldAngle * 0.25;
          var cx = cols / 2, cy = rows / 2;
          var dx = c - cx, dy = r - cy;
          var radial = atan2(dy, dx);
          angle += fieldScale * 5 * sin(radial * 2.5 + t * 20);
          field[c][r] = angle * 3;
        }
      }
      return field;
    });

    brush.field("audio_flow");
    brushReady = true;
    console.log("p5.brush v2 loaded with audio_flow field + custom brushes");
  } catch (e) {
    console.error("p5.brush load failed:", e.message, e.stack);
    try {
      brushScale = w / 800;
      brush.scale(brushScale);
      brush.load();
      brush.scaleBrushes(1.5);
      registerCustomBrushes();
      brush.field("seabed");
      brushReady = true;
    } catch (e2) {
      brushReady = false;
    }
  }

  // ─── Audio ──────────────────────────────────────────────────────────────
  audioEngine = new AudioEngine();
  audioEngine.init('/p5-brush-v2/GlassHorizon.mp3');

  // ─── Controls ─────────────────────────────────────────────────────────
  document.getElementById('playBtn').addEventListener('click', function() {
    audioEngine.play();
  });
  document.getElementById('stopBtn').addEventListener('click', function() {
    audioEngine.stop();
  });
  document.getElementById('audioFile').addEventListener('change', function(e) {
    var f = e.target.files[0];
    if (f) audioEngine.loadFile(f);
  });
  document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  });
}

function toggleFullscreen() {
  var el = document.getElementById('container');
  if (!document.fullscreenElement) {
    el.requestFullscreen().catch(function() {});
  } else {
    document.exitFullscreen();
  }
}

// ─── p5 Draw Loop ───────────────────────────────────────────────────────────

function draw() {
  if (!brushReady) {
    background(BG_HEX);
    return;
  }

  translate(-width / 2, -height / 2);
  frameT += deltaTime / 1000;

  // Re-seed canvas after fullscreen toggle or first load
  if (needsReseed) {
    needsReseed = false;
    background(BG_HEX);
    // Generous seed strokes — mix of all custom + default brushes
    for (var i = 0; i < 20; i++) {
      brush.set(random(SEED_BRUSHES), random(PALETTE), random(0.5, 1.8));
      brush.flowLine(
        random(width * 0.05, width * 0.95),
        random(height * 0.05, height * 0.95),
        random(120, 350),
        random(360)
      );
    }
    drawSpiral(width * 0.3 + random(width * 0.4), height * 0.3 + random(height * 0.4), 0.3);
    drawSpiral(width * 0.2 + random(width * 0.6), height * 0.2 + random(height * 0.6), 0.3);
    return;
  }

  // Audio features
  var features;
  var isAudioPlaying = audioEngine && audioEngine.isPlaying;
  if (isAudioPlaying) {
    features = audioEngine.analyze();
  } else {
    features = generateSyntheticFeatures(frameT);
  }

  // ── Background fade ───────────────────────────────────────────────────
  var fadeAlpha = map(features.rms, 0, 0.5, 3.0, 0.8);
  fadeAlpha = constrain(fadeAlpha, 0.6, 3.5);
  push();
  noStroke();
  fill(BG_RGB[0], BG_RGB[1], BG_RGB[2], fadeAlpha);
  rect(0, 0, width, height);
  pop();

  // Update flow field — now more responsive to mid + high frequencies
  fieldAngle += features.mid * 2.5 + features.brightness * 0.5;
  fieldScale = 1.0 + features.bass * 1.2 + features.harmonic * 0.3;

  if (frameCount % 3 === 0) {
    brush.refreshField(frameT * 0.08);
  }

  // ════════════════════════════════════════════════════════════════════════
  // BEAT RESPONSE — explosive impact from bass + spectral flux
  // ════════════════════════════════════════════════════════════════════════
  if (features.beatFlash > 0.8) {
    spiralCount++;

    // Calligraphic spiral — intensity driven by harmonic content
    if (spiralCount % 2 === 0) {
      drawSpiral(
        width * 0.15 + random(width * 0.7),
        height * 0.15 + random(height * 0.7),
        features.bass * (1 + features.harmonic)
      );
    }

    // Explosive burst — intensity scales with spectral flux
    var burstCount = Math.floor(6 + features.bass * 8 + features.complexity * 4);
    drawBeatBurst(burstCount, features);

    // Bold oil-paint circle — size & opacity respond to bass + brightness
    var circleSize = 30 + features.bass * 80 + features.brightness * 40;
    brush.set("thick_oil", random(BEAT_PALETTE), 0.8 + features.bass * 2.0 + features.brightness * 0.5);
    brush.circle(
      random(width * 0.2, width * 0.8),
      random(height * 0.2, height * 0.8),
      circleSize,
      true
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // AMBIENT STROKES — modulated by mid frequencies + spectral complexity
  // ════════════════════════════════════════════════════════════════════════
  var ambientCount = isAudioPlaying
    ? Math.floor(1 + features.rms * 12 + features.harmonic * 3)
    : Math.floor(1 + features.rms * 4);

  for (var i = 0; i < ambientCount; i++) {
    drawAmbientStroke(features, isAudioPlaying);
  }

  // Spline curves — ink wash + fine detail
  var splineInterval = isAudioPlaying
    ? Math.max(3, Math.floor(12 - features.rms * 15))
    : 12;
  if (frameCount % splineInterval === 0) {
    drawSplineCurve(features);
  }

  // Long sweeping lines — needle-thin precision
  var longInterval = isAudioPlaying
    ? Math.max(4, Math.floor(15 - features.bass * 18))
    : 15;
  if (frameCount % longInterval === 0) {
    drawLongFlowLine(features);
  }
}

// ─── Drawing Helpers ────────────────────────────────────────────────────────

function getAudioColor(features) {
  // Map spectral brightness to warm colors (reds/oranges/golds)
  // Low freq = burgundy/brown, mid = orange/red, high = yellow/gold
  var colorIdx;
  
  if (features.brightness > 0.6) {
    // High frequencies → golden yellows
    colorIdx = Math.floor(map(features.brightness, 0.6, 1, 6, 7));
  } else if (features.mid > 0.5) {
    // Mid frequencies → oranges/reds
    colorIdx = Math.floor(map(features.mid, 0.3, 1, 1, 4));
  } else {
    // Low frequencies → burgundy/brown
    colorIdx = Math.floor(map(features.bass, 0, 1, 4, 6));
  }
  
  colorIdx = constrain(Math.floor(colorIdx), 0, PALETTE.length - 1);
  return PALETTE[colorIdx];
}

// AMBIENT — dry_rake (multi-line texture) + calligraphy (thick-thin) + charcoal
// Weight modulated by bass, stroke length by RMS energy + harmonic content
function drawAmbientStroke(features, isAudio) {
  var col = getAudioColor(features);

  var w, len;
  if (isAudio) {
    // Bass drives weight, creating heavy sustain during low frequencies
    w = 0.3 + features.bass * 5.5 + features.harmonic * 1.5;
    // RMS + mid frequency drive length/energy
    len = 80 + features.rms * 380 + features.mid * 150;
  } else {
    w = 0.4 + features.bass * 2.0;
    len = 80 + features.rms * 200;
  }

  // Choose brush based on complexity — simple strokes on low energy, varied on high
  var brushType = features.complexity > 0.4
    ? random(["dry_rake", "calligraphy", "charcoal"])
    : random(["calligraphy", "charcoal"]);
  
  brush.set(brushType, col, w);
  brush.flowLine(
    random(width * 0.02, width * 0.98),
    random(height * 0.02, height * 0.98),
    len,
    random(360)
  );
}

// BEAT BURST — splatter (chaotic dots) + thick_oil (bold paint)
// Radiates from center, intensity scales with spectral flux + bass
function drawBeatBurst(count, features) {
  var cx = width * 0.2 + random(width * 0.6);
  var cy = height * 0.2 + random(height * 0.6);

  for (var i = 0; i < count; i++) {
    var col = random(BEAT_PALETTE);
    var w = 0.9 + features.bass * 5.5 + features.spectralFlux * 0.2;
    var len = 150 + features.rms * 400 + features.complexity * 200;
    var angle = random(360);
    var ox = cx + random(-180, 180);
    var oy = cy + random(-180, 180);

    // Alternate between splatter and thick_oil for each stroke
    var burstBrush = i % 2 === 0 ? "splatter" : "thick_oil";
    brush.set(burstBrush, col, w);
    brush.flowLine(ox, oy, len, angle);
  }
}

// SPIRAL — calligraphy for elegant swelling curves
function drawSpiral(x, y, intensity) {
  var col = random(BEAT_PALETTE);
  var numSegments = Math.floor(random(15, 50 + intensity * 40));

  brush.pick("calligraphy");
  brush.stroke(col);
  brush.strokeWeight(random(0.5, 1.8));

  brush.beginStroke("curve", x, y);
  var initAngle = random(0, 360);

  for (var i = 0; i < numSegments; i++) {
    brush.segment(0 + initAngle, 0 + i * 22, random(0.5, 1.5));
    brush.segment(90 + initAngle, 6 + i * 22, random(0.5, 1.5));
    brush.segment(180 + initAngle, 11 + i * 22, random(0.5, 1.5));
    brush.segment(270 + initAngle, 16 + i * 22, random(0.5, 1.5));
  }

  brush.endStroke(0 + initAngle, 1);
}

// SPLINE CURVES — ink_wash (soft ghosts) + 2B (fine detail)
// Mid frequencies drive point distribution, high frequencies drive line width
function drawSplineCurve(features) {
  var numPts = Math.floor(4 + features.mid * 6 + features.harmonic * 2);
  var points = [];
  var startX = random(width * 0.05, width * 0.95);
  var startY = random(height * 0.05, height * 0.95);

  for (var i = 0; i < numPts; i++) {
    // Bass drives spread distance for sweeping curves
    var spread = 80 + features.bass * 180 + features.complexity * 100;
    points.push([
      startX + random(-spread, spread) * (i + 1) * 0.4,
      startY + random(-spread, spread) * (i + 1) * 0.4,
      random(0.5, 1.6)
    ]);
  }

  var col = getAudioColor(features);
  // High frequencies sharpen the lines
  var w = 0.5 + features.high * 3.5 + features.brightness * 1.5;
  brush.set(random(["ink_wash", "2B"]), col, w);
  brush.spline(points, random(0.4, 0.9));
}

// LONG SWEEPING LINES — needle + pen + rotring for fine precision
// Weight modulated by bass + brightness, length by overall energy
function drawLongFlowLine(features) {
  var col = random(PALETTE);
  // Bass creates heavy sustains, brightness adds subtle accent
  var w = 0.4 + features.bass * 3.5 + features.brightness * 1.2;
  var len = 250 + features.bass * 600 + features.rms * 200;
  var brushType = random(["needle", "pen", "rotring"]);

  brush.set(brushType, col, w);
  brush.flowLine(
    random(width * 0.05, width * 0.95),
    random(height * 0.05, height * 0.95),
    len,
    random(360)
  );
}

// ─── Resize ─────────────────────────────────────────────────────────────────
// No windowResized() — CSS handles scaling the canvas to fit the container.
// Calling resizeCanvas() would break p5.brush's internal framebuffers.
