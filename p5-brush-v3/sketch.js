// p5.brush v3 — "Watercolor Dreams"
// Watercolor fills (brush.fill + brush.bleed), HSB-mapped colors,
// mood palette cycling on beats, waveform-as-brush-path
// Audio responsiveness: layered frequency mapping with bleeding watercolor washes

// ─── HSB → Hex Converter (pure JS, avoids p5 colorMode issues) ─────────────────
function hsbToHex(h, s, b) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  b = Math.max(0, Math.min(100, b)) / 100;
  var c = b * s;
  var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  var m = b - c;
  var r1, g1, b1;
  if (h < 60)       { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else              { r1 = c; g1 = 0; b1 = x; }
  var r = Math.round((r1 + m) * 255);
  var g = Math.round((g1 + m) * 255);
  var bl = Math.round((b1 + m) * 255);
  return '#' + ('0' + r.toString(16)).slice(-2)
             + ('0' + g.toString(16)).slice(-2)
             + ('0' + bl.toString(16)).slice(-2);
}

// ─── Mood Palettes ──────────────────────────────────────────────────────────────
// Each mood: 4 base hues + saturation/brightness ranges + warm background tint
var MOODS = [
  { name: "Ocean",  hues: [190, 210, 230, 170], sat: [60, 90],  bri: [50, 85],  bg: [230, 245, 252] },
  { name: "Ember",  hues: [0, 15, 35, 50],      sat: [70, 100], bri: [55, 90],  bg: [255, 243, 232] },
  { name: "Forest", hues: [90, 120, 150, 40],    sat: [40, 80],  bri: [35, 70],  bg: [238, 248, 235] },
  { name: "Neon",   hues: [280, 320, 180, 60],   sat: [80, 100], bri: [70, 100], bg: [245, 235, 255] },
];

// ─── State ──────────────────────────────────────────────────────────────────────
var audioEngine;
var fieldAngle = 0;
var fieldScale = 1.0;
var frameT = 0;
var brushScale = 1;
var brushReady = false;
var needsReseed = true;

// Color / mood state
var moodIndex = 0;
var hueAccum = 0;         // slow hue drift from spectral centroid
var beatCount = 0;
var prevBeatFlash = 0;    // edge detection for beat triggers

// ─── Synthetic features for non-audio mode ──────────────────────────────────────
function generateSyntheticFeatures(t) {
  return {
    bass:         0.18 + 0.12 * Math.sin(t * 0.3),
    mid:          0.14 + 0.10 * noise(t * 0.5),
    high:         0.10 + 0.06 * noise(t * 0.9 + 100),
    rms:          0.10 + 0.07 * Math.sin(t * 0.4),
    centroid:     0.3 + 0.2 * noise(t * 0.15 + 200),
    beatFlash:    Math.sin(t * 0.8) > 0.985 ? 1.0 : 0,
    beatStrength: Math.sin(t * 0.8) > 0.985 ? random(0.3, 0.9) : 0,
    beatDensity:  0.8,
    bpm:          72,
    spectralFlux: 0,
  };
}

// ─── Color Helpers ──────────────────────────────────────────────────────────────

// Get a color from the current mood, modulated by audio features
// DRAMATIC dynamics: quiet = pale/desaturated, loud = vivid/rich
function getMoodColor(features) {
  var mood = MOODS[moodIndex];
  var hueIdx = Math.floor(random(mood.hues.length));
  var h = mood.hues[hueIdx] + hueAccum + random(-10, 10);

  // Energy factor: 0 at silence → 1 at loud (combines RMS + bass)
  var energy = constrain((features.rms + features.bass) / 0.6, 0, 1);

  // Saturation: very pale at quiet (15-30), vivid at loud (mood range)
  var sMin = 15;                     // whisper-quiet = nearly grey
  var sMax = mood.sat[1];            // full energy = mood's max saturation
  var s = map(energy, 0, 1, sMin, sMax);

  // Brightness: washed-out at quiet (85-95), rich at loud (mood range)
  var bQuiet = 90;                   // quiet = light, airy
  var bLoud  = mood.bri[0];         // loud = deeper, more saturated
  var b = map(energy, 0, 1, bQuiet, bLoud + (mood.bri[1] - mood.bri[0]) * 0.5);

  s = constrain(s + random(-6, 6), 10, 100);
  b = constrain(b + random(-5, 5), 25, 100);
  return hsbToHex(h, s, b);
}

// Bright accent color for beats — uses mood's primary hue at high saturation
function getBeatColor() {
  var mood = MOODS[moodIndex];
  var h = mood.hues[0] + hueAccum + random(-15, 15);
  var s = constrain(mood.sat[1] + 5, 50, 100);
  var b = constrain(mood.bri[1] + 10, 60, 100);
  return hsbToHex(h, s, b);
}

// Secondary beat color — uses mood's second hue for contrast
function getBeatColor2() {
  var mood = MOODS[moodIndex];
  var h = mood.hues[1] + hueAccum + random(-10, 10);
  var s = constrain(mood.sat[1], 45, 100);
  var b = constrain(mood.bri[1], 55, 100);
  return hsbToHex(h, s, b);
}

// ─── Custom Brush Definitions ───────────────────────────────────────────────────

function registerCustomBrushes() {

  // CALLIGRAPHY — elegant thick-thin variation, perfect for mid-range strokes
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

  // INK WASH — soft translucent washes, layers beautifully
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

  // SPLATTER — explosive scattered dots for treble detail
  brush.add("splatter", {
    type: "spray", weight: 0.9, vibration: 25,
    quality: 55, opacity: 100, spacing: 0.9,
    blend: false,
    pressure: { type: "standard", curve: [0.15, 0.25], min_max: [0.4, 1.6] }
  });

  // NEEDLE — ultra-fine precise hairlines
  brush.add("needle", {
    type: "default", weight: 0.12, vibration: 0.08,
    definition: 0.95, quality: 2, opacity: 210,
    spacing: 0.08, blend: false,
    pressure: { type: "standard", curve: [0.05, 0.1], min_max: [0.9, 1.05] }
  });

  // THICK OIL — bold marker with color mixing for beats
  brush.add("thick_oil", {
    type: "marker", weight: 4.5, vibration: 0.25,
    opacity: 50, spacing: 0.3, blend: true,
    pressure: { type: "standard", curve: [0.25, 0.2], min_max: [0.9, 1.5] }
  });

  // NEW v3: WASH BLOB — very wide, ultra-low opacity for atmospheric background washes
  brush.add("wash_blob", {
    type: "custom", weight: 15, vibration: 4,
    opacity: 8, spacing: 0.5, blend: true,
    pressure: { type: "standard", curve: [0.1, 0.15], min_max: [0.7, 1.1] },
    tip: function(_m) {
      _m.ellipse(0, 0, 8, 5);
      _m.ellipse(2, 1.5, 5, 3);
      _m.ellipse(-1.5, -1, 4, 3);
    },
    rotate: "random"
  });

  console.log("v3 Watercolor Dreams brushes registered:", brush.box());
}

// ─── p5 Setup ───────────────────────────────────────────────────────────────────
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

    registerCustomBrushes();

    // Use "waves" built-in field — gentle flowing feel suits watercolor
    // Audio dynamism comes from refreshField() in the draw loop
    brush.field("waves");
    brushReady = true;
    console.log("p5.brush v3 loaded — Watercolor Dreams");
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

  // ─── Audio ──────────────────────────────────────────────────────────────────
  audioEngine = new AudioEngine();
  audioEngine.init('/p5-brush-v3/GlassHorizon.mp3');

  // ─── Controls ───────────────────────────────────────────────────────────────
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

// ─── Draw Loop ──────────────────────────────────────────────────────────────────

function draw() {
  if (!brushReady) {
    background(240);
    return;
  }

  translate(-width / 2, -height / 2);
  frameT += deltaTime / 1000;

  // ── Initial seed ────────────────────────────────────────────────────────────
  if (needsReseed) {
    needsReseed = false;
    var bg = MOODS[moodIndex].bg;
    background(bg[0], bg[1], bg[2]);

    // Seed: watercolor blobs — establish the watercolor feel immediately
    for (var i = 0; i < 4; i++) {
      var col = hsbToHex(
        MOODS[moodIndex].hues[i % MOODS[moodIndex].hues.length] + random(-20, 20),
        random(MOODS[moodIndex].sat[0], MOODS[moodIndex].sat[1]),
        random(MOODS[moodIndex].bri[0], MOODS[moodIndex].bri[1])
      );
      brush.fill(col, random(50, 85));
      brush.bleed(random(0.08, 0.25));
      brush.rect(
        random(width * 0.1, width * 0.9),
        random(height * 0.1, height * 0.9),
        random(80, 180), random(80, 180), CENTER
      );
      brush.noFill();
    }

    // Seed: flowing calligraphy strokes over the blobs
    var fakeFeatures = { bass: 0.2, mid: 0.15, high: 0.1, rms: 0.15, centroid: 0.4 };
    for (var i = 0; i < 8; i++) {
      var col = getMoodColor(fakeFeatures);
      brush.set(
        random(["calligraphy", "ink_wash", "wash_blob", "charcoal"]),
        col,
        random(0.5, 1.5)
      );
      brush.flowLine(
        random(width * 0.05, width * 0.95),
        random(height * 0.05, height * 0.95),
        random(120, 300),
        random(360)
      );
    }
    return;
  }

  // ── Audio features ──────────────────────────────────────────────────────────
  var features;
  var isAudioPlaying = audioEngine && audioEngine.isPlaying;
  if (isAudioPlaying) {
    features = audioEngine.analyze();
  } else {
    features = generateSyntheticFeatures(frameT);
  }

  // Slow hue drift from spectral centroid — colors evolve over time
  hueAccum += features.centroid * 1.5;
  if (hueAccum > 360) hueAccum -= 360;

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 0: Background Fade — mood-tinted overlay
  // BPM-driven: faster tempo = faster fade = canvas "breathes" more
  // Louder = SLOWER fade (strokes accumulate), quiet = faster fade
  // ════════════════════════════════════════════════════════════════════════════
  var bpmFactor = (features.bpm || 120) / 120;  // 1.0 at 120bpm, 1.5 at 180bpm
  var baseFade = map(features.rms, 0, 0.5, 3.5, 0.6);
  var fadeAlpha = baseFade * bpmFactor;          // faster tempo → faster fade
  fadeAlpha = constrain(fadeAlpha, 0.5, 6.0);
  var bg = MOODS[moodIndex].bg;
  push();
  noStroke();
  fill(bg[0], bg[1], bg[2], fadeAlpha);
  rect(0, 0, width, height);
  pop();

  // Update flow field — audio makes it shift
  fieldAngle += features.mid * 1.5;
  fieldScale = 1.0 + features.bass * 0.6;
  if (frameCount % 5 === 0) {
    brush.refreshField(frameT * 0.06);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 1: Bass → Watercolor Blobs (THE SIGNATURE v3 FEATURE)
  // brush.fill() + brush.bleed() create soft bleeding watercolor washes
  // ════════════════════════════════════════════════════════════════════════════
  // Watercolor fills — limit to 1 blob per trigger frame
  var blobInterval = isAudioPlaying
    ? Math.max(6, Math.floor(14 - features.bass * 12))   // every 6-14 frames
    : 12;

  if (features.bass > 0.15 && frameCount % blobInterval === 0) {
    drawWatercolorBlob(features);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 2: Mid → Flowing Calligraphy Strokes
  // calligraphy + ink_wash brushes, weight/length scale with mid energy
  // ════════════════════════════════════════════════════════════════════════════
  var midCount = isAudioPlaying
    ? Math.floor(1 + features.mid * 4)   // 1-3 strokes
    : Math.floor(1 + features.mid * 2);

  for (var i = 0; i < midCount; i++) {
    drawMidStroke(features, isAudioPlaying);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 3: High → Stippled Details
  // needle + splatter — only triggers when treble is clear
  // ════════════════════════════════════════════════════════════════════════════
  if (features.high > 0.15 && frameCount % 2 === 0) {
    var stippleCount = Math.min(4, Math.floor(features.high * 6));   // 0-4 stipples
    for (var i = 0; i < stippleCount; i++) {
      drawHighStipple(features);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 4: Beat → Waveform Path + Watercolor Splash
  // Edge detection: trigger once per beat onset
  // ════════════════════════════════════════════════════════════════════════════
  if (features.beatFlash > 0.8 && prevBeatFlash <= 0.8) {
    beatCount++;
    var density = features.beatDensity || 0.8;
    var isStaccato = density > 2.5;    // rapid-fire beats

    if (isStaccato) {
      // ── STACCATO MODE: many small crisp marks, skip heavy fills ──
      // Rapid needle/splatter bursts instead of watercolor splashes
      var burstCount = Math.floor(3 + (features.beatStrength || 0.5) * 6);
      for (var b = 0; b < burstCount; b++) {
        var col = getBeatColor();
        brush.set(
          random(["needle", "splatter", "2B"]),
          col,
          0.2 + (features.beatStrength || 0.5) * 1.5
        );
        brush.flowLine(
          random(width * 0.1, width * 0.9),
          random(height * 0.1, height * 0.9),
          20 + (features.beatStrength || 0.5) * 60,
          random(360)
        );
      }
    } else {
      // ── NORMAL/SPARSE MODE: full waveform + splash treatment ──
      // Waveform drawn as a brush spline — the waveform IS the art
      drawWaveformPath(features);

      // Watercolor splash scaled by beat intensity
      drawBeatSplash(features);
    }

    // Calligraphic spiral every 3rd beat (both modes)
    if (beatCount % 3 === 0) {
      drawSpiral(
        width * 0.15 + random(width * 0.7),
        height * 0.15 + random(height * 0.7),
        features.beatStrength || features.bass
      );
    }

    // ── MOOD CYCLE every 4th beat ──
    if (beatCount % 4 === 0) {
      moodIndex = (moodIndex + 1) % MOODS.length;
      console.log("Mood shift -> " + MOODS[moodIndex].name);
    }
  }
  prevBeatFlash = features.beatFlash;

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 5: Atmospheric wash_blob strokes — always present, very subtle
  // ════════════════════════════════════════════════════════════════════════════
  if (frameCount % 14 === 0) {
    var col = getMoodColor(features);
    brush.set("wash_blob", col, random(0.4, 1.2));
    brush.flowLine(
      random(width * 0.1, width * 0.9),
      random(height * 0.1, height * 0.9),
      random(80, 200),
      random(360)
    );
  }

  // Occasional spline curves for organic flow
  var splineInterval = isAudioPlaying
    ? Math.max(6, Math.floor(14 - features.rms * 10))
    : 14;
  if (frameCount % splineInterval === 0) {
    drawSplineCurve(features);
  }
}

// ─── Drawing Helpers ────────────────────────────────────────────────────────────

// WATERCOLOR BLOB — soft bleeding rectangle, the v3 signature
function drawWatercolorBlob(features) {
  var col = getMoodColor(features);
  var blobSize = 40 + features.bass * 160;        // 40-200px based on bass
  var aspect = random(0.6, 1.4);                   // variety in proportions
  var opacity = random(45, 95);
  var bleedAmt = 0.05 + features.bass * 0.3;       // quiet=tight, loud=bleeding
  bleedAmt = Math.min(bleedAmt, 0.5);

  brush.fill(col, opacity);
  brush.bleed(bleedAmt);
  try { brush.fillTexture(0.3 + features.bass * 0.4, 0.3); } catch(e) {}

  brush.rect(
    random(width * 0.08, width * 0.92),
    random(height * 0.08, height * 0.92),
    blobSize * aspect,
    blobSize / aspect,
    CENTER
  );
  brush.noFill();
}

// MID STROKES — adapts to transient vs sustained energy
// High flux = transient (sharp hit) → crisp needle/splatter marks
// Low flux  = sustained (held note) → flowing ink_wash/calligraphy washes
function drawMidStroke(features, isAudio) {
  var col = getMoodColor(features);
  var flux = features.spectralFlux || 0;
  var isTransient = flux > 0.8;   // high spectral change = sharp onset

  var w, len, brushType;
  if (isAudio) {
    if (isTransient) {
      // Transient: short, crisp, precise marks
      w = 0.15 + features.mid * 1.5;
      len = 20 + features.mid * 80;
      brushType = random(["needle", "splatter", "2B"]);
    } else {
      // Sustained: long, flowing, washy strokes
      w = 0.4 + features.mid * 3.5;
      len = 80 + features.mid * 350;
      brushType = random(["ink_wash", "calligraphy", "wash_blob"]);
    }
  } else {
    w = 0.3 + features.mid * 1.2;
    len = 50 + features.mid * 150;
    brushType = random(["calligraphy", "ink_wash", "charcoal"]);
  }

  brush.set(brushType, col, w);
  brush.flowLine(
    random(width * 0.02, width * 0.98),
    random(height * 0.02, height * 0.98),
    len,
    random(360)
  );
}

// HIGH STIPPLE — fine dots and hairlines for treble frequencies
function drawHighStipple(features) {
  var col = getMoodColor(features);
  var brushType = random(["needle", "splatter"]);
  var w = 0.15 + features.high * 1.5;
  var len = 15 + features.high * 60;

  brush.set(brushType, col, w);
  brush.flowLine(
    random(width * 0.05, width * 0.95),
    random(height * 0.05, height * 0.95),
    len,
    random(360)
  );
}

// WAVEFORM PATH — scales with beat strength
// Soft beat → short, thin waveform. Hard beat → wide, bold waveform.
function drawWaveformPath(features) {
  var strength = features.beatStrength || 0.5;
  var points = [];
  var numPts = 32;
  var centerX = random(width * 0.15, width * 0.85);
  var centerY = random(height * 0.15, height * 0.85);
  var spread = 150 + strength * 350;  // short (soft) → wide (hard)

  // Sample real waveform data if playing, otherwise use noise
  var hasWaveform = audioEngine && audioEngine.timeData && audioEngine.isPlaying;

  for (var i = 0; i < numPts; i++) {
    var t = i / (numPts - 1);
    var x = centerX - spread / 2 + t * spread;
    var sample;
    if (hasWaveform) {
      var idx = Math.floor(t * (audioEngine.timeData.length - 1));
      sample = audioEngine.timeData[idx];
    } else {
      sample = noise(i * 0.3 + frameT) * 2 - 1;
    }
    var y = centerY + sample * (80 + features.rms * 120);
    points.push([x, y, random(0.5, 1.5)]);
  }

  var col = getBeatColor();
  // Stroke weight scales with strength: thin whisper → bold statement
  brush.set(
    random(["calligraphy", "ink_wash"]),
    col,
    0.3 + strength * 2.5
  );
  brush.spline(points, 0.7);
}

// BEAT SPLASH — scales with beat intensity (beatStrength 0-1)
// Soft beat → small, tight bleed. Hard beat → big, heavy bleed.
function drawBeatSplash(features) {
  var strength = features.beatStrength || 0.5;   // fallback for synthetic
  var col1 = getBeatColor();
  var col2 = getBeatColor2();

  // Size scales dramatically with strength: 30px (soft) → 180px (hard)
  var splashSize = 30 + strength * 150;
  // Opacity: soft = translucent, hard = bold
  var opacity = 35 + strength * 60;
  // Bleed: soft = tight edges, hard = heavy bleeding
  var bleedAmt = 0.05 + strength * 0.40;

  // Primary splash
  brush.fill(col1, opacity);
  brush.bleed(bleedAmt);
  try { brush.fillTexture(0.3 + strength * 0.4, 0.3); } catch(e) {}

  brush.rect(
    random(width * 0.15, width * 0.85),
    random(height * 0.15, height * 0.85),
    splashSize * random(0.7, 1.3),
    splashSize * random(0.7, 1.3),
    CENTER
  );
  brush.noFill();

  // Secondary splash only on strong beats (strength > 0.5)
  if (strength > 0.5) {
    brush.fill(col2, random(40, 70));
    brush.bleed(bleedAmt * 0.8);
    brush.rect(
      random(width * 0.2, width * 0.8),
      random(height * 0.2, height * 0.8),
      splashSize * random(0.4, 0.8),
      splashSize * random(0.4, 0.8),
      CENTER
    );
    brush.noFill();
  }
}

// SPIRAL — calligraphic expanding spiral
function drawSpiral(x, y, intensity) {
  var col = getBeatColor();
  var numSegments = Math.floor(random(12, 40 + intensity * 30));

  brush.pick("calligraphy");
  brush.stroke(col);
  brush.strokeWeight(random(0.5, 1.5));

  brush.beginStroke("curve", x, y);
  var initAngle = random(0, 360);

  for (var i = 0; i < numSegments; i++) {
    brush.segment(0 + initAngle,   0 + i * 22, random(0.5, 1.5));
    brush.segment(90 + initAngle,  6 + i * 22, random(0.5, 1.5));
    brush.segment(180 + initAngle, 11 + i * 22, random(0.5, 1.5));
    brush.segment(270 + initAngle, 16 + i * 22, random(0.5, 1.5));
  }

  brush.endStroke(0 + initAngle, 1);
}

// SPLINE CURVE — organic flowing curves
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

  var col = getMoodColor(features);
  var w = 0.4 + features.high * 2.5;
  brush.set(random(["ink_wash", "calligraphy", "2B"]), col, w);
  brush.spline(points, random(0.4, 0.9));
}

// ─── Resize ─────────────────────────────────────────────────────────────────────
// No windowResized() — CSS handles scaling the canvas to fit the container.
// Calling resizeCanvas() would break p5.brush's internal framebuffers.
