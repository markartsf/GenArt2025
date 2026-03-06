// p5.brush — Audio Reactive Generative Art
// Warm canvas background, dense layered strokes, beat-triggered spirals
// Audio responsiveness: dramatic contrast between quiet and loud

// ─── Palette & Config ───────────────────────────────────────────────────────
var PALETTE = ["#7b4800", "#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"];
var BEAT_PALETTE = ["#ff2702", "#fcd300", "#002185", "#6b9404"]; // hot colors for beats
var BRUSH_TYPES = ["marker", "marker2", "charcoal", "2B", "HB", "spray"];
var BG_HEX = "#fffceb";
var BG_RGB = [255, 252, 235];

// ─── State ──────────────────────────────────────────────────────────────────
var audioEngine;
var fieldAngle = 0;
var fieldScale = 1.0;
var frameT = 0;
var brushScale = 1;
var beatBrushIdx = 0;
var brushReady = false;
var spiralCount = 0;
var needsReseed = true;  // true = next draw() should seed the canvas

// ─── Synthetic features for non-audio mode ──────────────────────────────────
// Intentionally CALM — makes it obvious when real audio kicks in
function generateSyntheticFeatures(t) {
  return {
    bass:     0.15 + 0.1 * Math.sin(t * 0.3),
    mid:      0.12 + 0.08 * noise(t * 0.5),
    high:     0.08 + 0.05 * noise(t * 0.9 + 100),
    rms:      0.08 + 0.05 * Math.sin(t * 0.4),
    centroid: 0.3 + 0.2 * noise(t * 0.15 + 200),
    beatFlash: Math.sin(t * 0.8) > 0.985 ? 1.0 : 0,  // rare beats
    bpm:      72,
    spectralFlux: 0,
  };
}

// ─── p5 Setup ───────────────────────────────────────────────────────────────
function setup() {
  var container = document.getElementById('canvas-container');
  var w = container.clientWidth || 800;
  var h = container.clientHeight || 600;

  var cnv = createCanvas(w, h, WEBGL);
  cnv.parent('canvas-container');  // CRITICAL: puts canvas inside #container so fullscreen works
  pixelDensity(1);
  angleMode(DEGREES);
  frameRate(30);

  try {
    brushScale = w / 800;
    brush.scale(brushScale);
    brush.load();
    brush.scaleBrushes(1.5);

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
    console.log("p5.brush loaded with audio_flow field");
  } catch (e) {
    console.error("p5.brush load failed:", e.message, e.stack);
    try {
      brushScale = w / 800;
      brush.scale(brushScale);
      brush.load();
      brush.scaleBrushes(1.5);
      brush.field("seabed");
      brushReady = true;
    } catch (e2) {
      brushReady = false;
    }
  }

  // ─── Audio ──────────────────────────────────────────────────────────────
  audioEngine = new AudioEngine();
  audioEngine.init('/p5-brush-audio/GlassHorizon.mp3');

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

  // No fullscreen resize listener needed — CSS scales the canvas to fill
  // the container. Calling resizeCanvas() would break p5.brush's internal
  // framebuffer canvases (they don't resize, so compositing fails → black).
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
    // Generous seed strokes
    for (var i = 0; i < 20; i++) {
      brush.set(random(BRUSH_TYPES), random(PALETTE), random(0.5, 1.8));
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
  // Louder = SLOWER fade (strokes build up during loud parts)
  var fadeAlpha = map(features.rms, 0, 0.5, 3.0, 0.8);
  fadeAlpha = constrain(fadeAlpha, 0.6, 3.5);
  push();
  noStroke();
  fill(BG_RGB[0], BG_RGB[1], BG_RGB[2], fadeAlpha);
  rect(0, 0, width, height);
  pop();

  // Update flow field — audio makes it shift faster
  fieldAngle += features.mid * 2.0;
  fieldScale = 1.0 + features.bass * 0.8;

  if (frameCount % 3 === 0) {
    brush.refreshField(frameT * 0.08);
  }

  // ════════════════════════════════════════════════════════════════════════
  // BEAT RESPONSE — the most visible audio event
  // ════════════════════════════════════════════════════════════════════════
  if (features.beatFlash > 0.8) {
    spiralCount++;

    // Big spiral every other beat
    if (spiralCount % 2 === 0) {
      drawSpiral(
        width * 0.15 + random(width * 0.7),
        height * 0.15 + random(height * 0.7),
        features.bass
      );
    }

    // Dense flowLine burst from a cluster point
    var burstCount = Math.floor(6 + features.bass * 8);
    drawBeatBurst(burstCount, features);

    // Beat circle — visually distinct ring
    var circleSize = 30 + features.bass * 80;
    brush.set(
      random(["charcoal", "2B", "marker2"]),
      random(BEAT_PALETTE),
      0.8 + features.bass * 2.0
    );
    brush.circle(
      random(width * 0.2, width * 0.8),
      random(height * 0.2, height * 0.8),
      circleSize,
      true
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // AMBIENT STROKES — rate and weight scale DRAMATICALLY with audio
  // ════════════════════════════════════════════════════════════════════════

  // Quiet: 1 thin short stroke. Loud: 4-5 thick long strokes
  var ambientCount = isAudioPlaying
    ? Math.floor(1 + features.rms * 12)   // 1 at quiet → 4-5 at loud
    : Math.floor(1 + features.rms * 4);   // generative mode: calmer

  for (var i = 0; i < ambientCount; i++) {
    drawAmbientStroke(features, isAudioPlaying);
  }

  // Spline curves — more frequent when loud
  var splineInterval = isAudioPlaying
    ? Math.max(3, Math.floor(12 - features.rms * 15))  // every 3-12 frames
    : 12;
  if (frameCount % splineInterval === 0) {
    drawSplineCurve(features);
  }

  // Long sweeping lines
  var longInterval = isAudioPlaying
    ? Math.max(4, Math.floor(15 - features.bass * 18))
    : 15;
  if (frameCount % longInterval === 0) {
    drawLongFlowLine(features);
  }
}

// ─── Drawing Helpers ────────────────────────────────────────────────────────

function getAudioColor(features) {
  var idx = Math.floor(map(features.centroid, 0, 1, 0, PALETTE.length - 0.01));
  idx = constrain(idx, 0, PALETTE.length - 1);
  return PALETTE[idx];
}

// Ambient stroke — weight and length scale hard with audio
function drawAmbientStroke(features, isAudio) {
  var col = getAudioColor(features);

  // DRAMATIC scaling: quiet=thin/short, loud=thick/long
  var w, len;
  if (isAudio) {
    w = 0.2 + features.bass * 4.0;       // 0.2 at silence → 4.2 at full bass
    len = 50 + features.rms * 400;        // 50px at quiet → 450px at loud
  } else {
    w = 0.3 + features.bass * 1.5;
    len = 60 + features.rms * 180;
  }

  var brushType = random(["marker", "marker2", "HB", "2B", "charcoal"]);
  brush.set(brushType, col, w);
  brush.flowLine(
    random(width * 0.02, width * 0.98),
    random(height * 0.02, height * 0.98),
    len,
    random(360)
  );
}

// Beat burst — dense hot cluster
function drawBeatBurst(count, features) {
  beatBrushIdx = (beatBrushIdx + 1) % BRUSH_TYPES.length;
  var cx = width * 0.2 + random(width * 0.6);
  var cy = height * 0.2 + random(height * 0.6);

  for (var i = 0; i < count; i++) {
    var col = random(BEAT_PALETTE);  // hot colors on beats
    var w = 0.8 + features.bass * 4.0;
    var len = 120 + features.rms * 350;
    var angle = random(360);
    var ox = cx + random(-150, 150);
    var oy = cy + random(-150, 150);

    brush.set(BRUSH_TYPES[beatBrushIdx], col, w);
    brush.flowLine(ox, oy, len, angle);
  }
}

// Spiral on beats
function drawSpiral(x, y, intensity) {
  var col = random(BEAT_PALETTE);
  var numSegments = Math.floor(random(15, 50 + intensity * 40));

  brush.pick(random(["marker2", "marker", "charcoal", "2B"]));
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

// Spline curves
function drawSplineCurve(features) {
  var numPts = Math.floor(4 + features.mid * 5);
  var points = [];
  var startX = random(width * 0.05, width * 0.95);
  var startY = random(height * 0.05, height * 0.95);

  for (var i = 0; i < numPts; i++) {
    var spread = 60 + features.bass * 150;
    points.push([
      startX + random(-spread, spread) * (i + 1) * 0.4,
      startY + random(-spread, spread) * (i + 1) * 0.4,
      random(0.5, 1.6)
    ]);
  }

  var col = getAudioColor(features);
  var w = 0.4 + features.high * 2.5;
  brush.set(random(["charcoal", "2B", "marker", "marker2"]), col, w);
  brush.spline(points, random(0.4, 0.9));
}

// Long sweeping flowLines
function drawLongFlowLine(features) {
  var col = random(PALETTE);
  var w = 0.3 + features.bass * 2.5;
  var len = 200 + features.bass * 500;
  var brushType = random(["HB", "2H", "cpencil", "marker"]);

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
