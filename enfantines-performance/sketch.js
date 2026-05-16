// Enfantines Performance
// Alejandro Campos Uribe's 8 palettes + full doodle fan-stroke system + audio reactivity
// Foundation: doodles, color curves, hatch bg, cross marks (from enfantines-study)
// Audio layer on top: watercolor blobs on bass, calligraphy on mid, stipples on high, beats

// ─── Alejandro's 8 Original Palettes ────────────────────────────────────────────
var PALETTES = [
  { name: "Blanc Ivoire",        bg: "#fffceb", colors: ["#2c695a", "#4ad6af", "#7facc6", "#4e93cc", "#f6684f", "#ffd300"] },
  { name: "Outremer Gris",       bg: "#e2e7dc", colors: ["#7b4800", "#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"] },
  { name: "Gris Clair",          bg: "#ccccc6", colors: ["#474238", "#f4bd48", "#9c2128", "#395a8e", "#7facc6", "#2c695a"] },
  { name: "Le Rubis",            bg: "#ffe6d4", colors: ["#6c2b3b", "#c76282", "#445e87", "#003c32", "#e0b411", "#c8491b"] },
  { name: "Playgrounds",         bg: "#c49a70", colors: ["#4e0042", "#002185", "#076d16", "#feec00", "#ff6900", "#ff2702"] },
  { name: "Bleu Outremer",       bg: "#4e6498", colors: ["#cdd3e3", "#c6353c", "#f6684f", "#fcd300", "#488b6d", "#7fb4b5"] },
  { name: "Bleu Outremer Foncé", bg: "#0e2d58", colors: ["#f4f4f4", "#c8c9ca", "#939598", "#616568", "#0e1318", "#080f15"] },
  { name: "Noir d'Ivoire",       bg: "#080f15", colors: ["#C8C1B7", "#d7d7d7", "#b0b0b0", "#8b8b8b", "#676767", "#464646"] },
];

// ─── Style Presets — control doodle fan appearance ───────────────────────────────
var BUILT_IN_STYLES = {
  "Soft & dreamy": {
    fanBrushes:       ["marker", "marker2"],
    weightRange:      [2.0, 4.5],  weightJitter: [0.85, 1.15],
    stopCount:        [3, 5],      cycleRate: 3,   colorJitter: 0.05,
    showOutline:      false,
    underWashProb:    0.6,
    underWashOpacity: [25, 55],    underWashBleed: [0.20, 0.40],
    accentProb:       0.12,
    halfWidthRange:   [0.20, 0.45], teethMultiplier: 1.0,
    angleJitter:      3,
  },
  "Enfantines hard-edge": {
    // flat_marker: custom rectangular tip, blend:true for spectral pigment mixing
    fanBrushes:       ["flat_marker", "flat_marker", "hard_marker"],
    weightRange:      [2.6, 4.2],  weightJitter: [0.90, 1.10],
    stopCount:        [4, 7],      cycleRate: 5,   colorJitter: 0.02,
    showOutline:      false,
    underWashProb:    0.15,        // minimal — gestural strokes only
    underWashOpacity: [15, 30],    underWashBleed: [0.30, 0.50],
    accentProb:       0.0,
    halfWidthRange:   [0.22, 0.42], teethMultiplier: 1.2,
    angleJitter:      8,           // ±8° per tooth — organic, hand-drawn feel
  },
  "Crisp colored pencil": {
    fanBrushes:       ["hard_pencil", "hard_pencil", "cpencil"],
    weightRange:      [0.6, 1.2],  weightJitter: [0.9, 1.1],
    stopCount:        [3, 6],      cycleRate: 4,   colorJitter: 0.04,
    showOutline:      false,
    underWashProb:    0.0,         // no wash rects — pencil lines only
    underWashOpacity: [0, 0],      underWashBleed: [0, 0],
    accentProb:       0.1,
    halfWidthRange:   [0.20, 0.40], teethMultiplier: 1.5,
    angleJitter:      5,
  },
  "Chunky stripes": {
    // flat_marker gives flat end-caps + blend:true spectral color mixing
    // rough_marker adds organic texture variation between teeth
    fanBrushes:       ["flat_marker", "rough_marker", "flat_marker"],
    weightRange:      [3.8, 6.5],  weightJitter: [0.88, 1.12],
    stopCount:        [3, 6],      cycleRate: 4,   colorJitter: 0.03,
    showOutline:      false,
    underWashProb:    0.0,         // gestural strokes only
    underWashOpacity: [0, 0],      underWashBleed: [0, 0],
    accentProb:       0.0,
    halfWidthRange:   [0.28, 0.50], teethMultiplier: 0.85,
    angleJitter:      10,          // ±10° gives lively, textured stripe variation
  },
};

// ─── Hex Color Utilities ─────────────────────────────────────────────────────────
function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ];
}
function rgbToHex(r, g, b) {
  return '#' + ('0' + Math.round(r).toString(16)).slice(-2)
             + ('0' + Math.round(g).toString(16)).slice(-2)
             + ('0' + Math.round(b).toString(16)).slice(-2);
}
function lerpHex(hexA, hexB, t) {
  var a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex(a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t);
}

// Sample a multi-stop hex gradient. t ∈ [0, 1]
function sampleGradient(stops, t) {
  t = Math.max(0, Math.min(1, t));
  if (stops.length === 1) return stops[0];
  var scaled = t * (stops.length - 1);
  var i0 = Math.floor(scaled);
  var i1 = Math.min(stops.length - 1, i0 + 1);
  return lerpHex(stops[i0], stops[i1], scaled - i0);
}

// Catmull-Rom spline sample at t ∈ [0, 1]
function sampleSpline(pts, t) {
  if (pts.length < 2) return pts[0];
  if (pts.length === 2) return { x: lerp(pts[0].x, pts[1].x, t), y: lerp(pts[0].y, pts[1].y, t) };
  var n = pts.length - 1;
  var seg = Math.min(n - 1, Math.floor(t * n));
  var lt = t * n - seg;
  var p0 = pts[Math.max(0, seg - 1)];
  var p1 = pts[seg];
  var p2 = pts[seg + 1];
  var p3 = pts[Math.min(pts.length - 1, seg + 2)];
  var t2 = lt * lt, t3 = t2 * lt;
  return {
    x: 0.5*((2*p1.x)+(-p0.x+p2.x)*lt+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: 0.5*((2*p1.y)+(-p0.y+p2.y)*lt+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3)
  };
}

var PALE_TINT = '#f5f0e8';

// ─── State ───────────────────────────────────────────────────────────────────────
var audioEngine;
var fieldAngle = 0, fieldScale = 1.0, frameT = 0, brushScale = 1;
var brushReady = false, needsReseed = true;

// Palette / cycle
var paletteIndex = 0, autoCycle = true;
var beatCount = 0, prevBeatFlash = 0;

// Foundation options
var currentStyle   = "Soft & dreamy";
var currentDensity = "medium";
var showHatchBg    = false;
var showCrossMarks = true;
var showColorCurves = true;

// ─── Synthetic features (no audio) ──────────────────────────────────────────────
function generateSyntheticFeatures(t) {
  return {
    bass: 0.18 + 0.12 * Math.sin(t * 0.3),
    mid:  0.14 + 0.10 * noise(t * 0.5),
    high: 0.10 + 0.06 * noise(t * 0.9 + 100),
    rms:  0.10 + 0.07 * Math.sin(t * 0.4),
    centroid:    0.3 + 0.2 * noise(t * 0.15 + 200),
    beatFlash:   Math.sin(t * 0.8) > 0.985 ? 1.0 : 0,
    beatStrength: Math.sin(t * 0.8) > 0.985 ? 0.5 : 0,
    beatDensity: 0.8, bpm: 72, spectralFlux: 0,
  };
}

// ─── Color Helpers ───────────────────────────────────────────────────────────────
function getPaletteColor(features) {
  var pal = PALETTES[paletteIndex];
  var hex = pal.colors[Math.floor(random(pal.colors.length))];
  var energy = constrain((features.rms + features.bass) / 0.6, 0, 1);
  return lerpHex(PALE_TINT, hex, 0.15 + energy * 0.85);
}
function getBeatColor()  { return PALETTES[paletteIndex].colors[0]; }
function getBeatColor2() { return PALETTES[paletteIndex].colors[1]; }

// ─── Custom Brush Registration ───────────────────────────────────────────────────
// 11 total: 6 from p5-brush-v3 + 5 from enfantines-study

function registerCustomBrushes() {
  // ── v3 brushes ────────────────────────────────────────────────────────────────
  brush.add("calligraphy", {
    type: "custom", weight: 3.5, vibration: 0.15, opacity: 45, spacing: 0.35, blend: true,
    pressure: { type: "custom", min_max: [0.5, 1.4], curve: function(x) { return 0.5 + 0.5 * Math.sin(x * Math.PI); } },
    tip: function(_m) { _m.rect(-4, -0.5, 8, 1); }, rotate: "natural"
  });
  brush.add("ink_wash", {
    type: "custom", weight: 10, vibration: 2.5, opacity: 10, spacing: 0.4, blend: true,
    pressure: { type: "standard", curve: [0.1, 0.2], min_max: [0.8, 1.2] },
    tip: function(_m) { _m.ellipse(0, 0, 7, 3); _m.ellipse(1.5, 0.8, 4, 2); }, rotate: "natural"
  });
  brush.add("splatter", {
    type: "spray", weight: 0.9, vibration: 25, quality: 55, opacity: 100, spacing: 0.9, blend: false,
    pressure: { type: "standard", curve: [0.15, 0.25], min_max: [0.4, 1.6] }
  });
  brush.add("needle", {
    type: "default", weight: 0.12, vibration: 0.08, definition: 0.95, quality: 2,
    opacity: 210, spacing: 0.08, blend: false,
    pressure: { type: "standard", curve: [0.05, 0.1], min_max: [0.9, 1.05] }
  });
  brush.add("thick_oil", {
    type: "marker", weight: 4.5, vibration: 0.25, opacity: 50, spacing: 0.3, blend: true,
    pressure: { type: "standard", curve: [0.25, 0.2], min_max: [0.9, 1.5] }
  });
  brush.add("wash_blob", {
    type: "custom", weight: 15, vibration: 4, opacity: 8, spacing: 0.5, blend: true,
    pressure: { type: "standard", curve: [0.1, 0.15], min_max: [0.7, 1.1] },
    tip: function(_m) { _m.ellipse(0,0,8,5); _m.ellipse(2,1.5,5,3); _m.ellipse(-1.5,-1,4,3); },
    rotate: "random"
  });

  // ── enfantines-study brushes ──────────────────────────────────────────────────

  // CROSSMARK — small "+" texture scattered through composition
  brush.add("crossmark", {
    type: "custom", weight: 1.6, vibration: 0.1, opacity: 200, spacing: 0.6, blend: true,
    pressure: { type: "standard", curve: [0.15, 0.2], min_max: [1.0, 1.0] },
    tip: function(m) { m.line(-3,0,3,0); m.line(0,-3,0,3); }, rotate: "random"
  });
  // BRISTLE — short fat bristly marks
  brush.add("bristle", {
    type: "custom", weight: 2.2, vibration: 0.8, opacity: 90, spacing: 0.5, blend: true,
    pressure: { type: "standard", curve: [0.25, 0.3], min_max: [0.7, 1.3] },
    tip: function(m) { m.ellipse(-1,0,2.5,1.3); m.ellipse(1,0.5,2,1); m.ellipse(0,-0.8,1.8,0.9); },
    rotate: "natural"
  });
  // HARD MARKER — crisp-edge marker with spectral pigment blending
  // blend:true → overlapping strokes mix like real paint (the Alejandro signature)
  brush.add("hard_marker", {
    type: "marker", weight: 3.5, vibration: 0.05, opacity: 92, spacing: 0.20, blend: true,
    pressure: { type: "standard", curve: [0.02, 0.02], min_max: [1.0, 1.0] }
  });

  // FLAT MARKER — custom rectangular tip for flat end-caps (the Alejandro stripe look)
  // Inspired by a pattern brush: spine = path, teeth = flat perpendicular marker strokes
  // blend:true means overlapping colors mix spectrally (yellow+blue=green, not muddy)
  brush.add("flat_marker", {
    type: "custom", weight: 5.0, vibration: 0.06,
    opacity: 82, spacing: 0.12, blend: true,
    pressure: { type: "standard", curve: [0.01, 0.01], min_max: [0.97, 1.0] },
    tip: function(_m) { _m.rect(-6, -0.6, 12, 1.2); },
    rotate: "natural"
  });

  // ROUGH MARKER — flat tip with more vibration for texture variation between strokes
  // Used alongside flat_marker in chunky stripes for organic roughness
  brush.add("rough_marker", {
    type: "custom", weight: 4.5, vibration: 0.18,
    opacity: 72, spacing: 0.14, blend: true,
    pressure: { type: "standard", curve: [0.01, 0.01], min_max: [0.95, 1.0] },
    tip: function(_m) {
      _m.rect(-5.5, -0.8, 11, 1.0);
      _m.ellipse(0, 0, 10, 0.6);
    },
    rotate: "natural"
  });
  // HARD PENCIL — crisp colored pencil, no spectral blend
  brush.add("hard_pencil", {
    type: "default", weight: 0.85, vibration: 0.04, definition: 0.97, quality: 3,
    opacity: 230, spacing: 0.08, blend: false,
    pressure: { type: "standard", curve: [0.05, 0.05], min_max: [1.0, 1.0] }
  });
  // SOFTWASH — wide atmospheric blob (softer cousin of wash_blob)
  brush.add("softwash", {
    type: "custom", weight: 14, vibration: 3.5, opacity: 12, spacing: 0.45, blend: true,
    pressure: { type: "standard", curve: [0.1, 0.15], min_max: [0.7, 1.2] },
    tip: function(m) { m.ellipse(0,0,9,5); m.ellipse(2.5,1.2,5,3); m.ellipse(-2,-1,4.5,2.8); },
    rotate: "random"
  });

  console.log("Enfantines Performance — brushes registered:", brush.box());
}

// ─── Setup ───────────────────────────────────────────────────────────────────────
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
    brush.field("waves");
    brushReady = true;
  } catch (e) {
    console.error("p5.brush load failed:", e.message);
    try {
      brush.scale(w / 800); brush.load(); brush.scaleBrushes(1.5);
      registerCustomBrushes(); brush.field("seabed"); brushReady = true;
    } catch (e2) { brushReady = false; }
  }

  // ─── Audio ──────────────────────────────────────────────────────────────────
  audioEngine = new AudioEngine();
  audioEngine.init('/enfantines-performance/GlassHorizon.mp3');

  // ─── Controls ───────────────────────────────────────────────────────────────
  document.getElementById('playBtn').addEventListener('click', function() { audioEngine.play(); });
  document.getElementById('stopBtn').addEventListener('click', function() { audioEngine.stop(); });
  document.getElementById('audioFile').addEventListener('change', function(e) {
    if (e.target.files[0]) audioEngine.loadFile(e.target.files[0]);
  });
  document.getElementById('newCanvasBtn').addEventListener('click', function() { needsReseed = true; });
  document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    if (e.key === 'r' || e.key === 'R') needsReseed = true;
    if (e.key === 'ArrowRight') advancePalette(1);
    if (e.key === 'ArrowLeft')  advancePalette(-1);
  });

  // Palette selector
  var palSel = document.getElementById('paletteSel');
  PALETTES.forEach(function(p, i) {
    var opt = document.createElement('option'); opt.value = i; opt.textContent = p.name;
    palSel.appendChild(opt);
  });
  palSel.addEventListener('change', function(e) {
    paletteIndex = parseInt(e.target.value); needsReseed = true;
  });

  // Style selector
  var styleSel = document.getElementById('styleSel');
  Object.keys(BUILT_IN_STYLES).forEach(function(name) {
    var opt = document.createElement('option'); opt.value = name; opt.textContent = name;
    styleSel.appendChild(opt);
  });
  styleSel.addEventListener('change', function(e) { currentStyle = e.target.value; needsReseed = true; });

  // Density selector
  document.getElementById('densitySel').addEventListener('change', function(e) {
    currentDensity = e.target.value; needsReseed = true;
  });

  // Checkboxes
  document.getElementById('autoCycleChk').addEventListener('change', function(e) { autoCycle = e.target.checked; });
  document.getElementById('hatchBgChk').addEventListener('change', function(e) { showHatchBg = e.target.checked; needsReseed = true; });
  document.getElementById('crossMarksChk').addEventListener('change', function(e) { showCrossMarks = e.target.checked; needsReseed = true; });
  document.getElementById('colorCurvesChk').addEventListener('change', function(e) { showColorCurves = e.target.checked; needsReseed = true; });
}

function toggleFullscreen() {
  var el = document.getElementById('container');
  if (!document.fullscreenElement) el.requestFullscreen().catch(function() {});
  else document.exitFullscreen();
}

function advancePalette(dir) {
  paletteIndex = (paletteIndex + dir + PALETTES.length) % PALETTES.length;
  document.getElementById('paletteSel').value = paletteIndex;
  needsReseed = true;
}

// ─── Draw Loop ───────────────────────────────────────────────────────────────────
function draw() {
  if (!brushReady) { background(20); return; }

  translate(-width / 2, -height / 2);
  frameT += deltaTime / 1000;

  // ── SEED — Foundation layer (runs once per palette/style change) ─────────────
  if (needsReseed) {
    needsReseed = false;
    var pal = PALETTES[paletteIndex];
    var bgRgb = hexToRgb(pal.bg);
    background(bgRgb[0], bgRgb[1], bgRgb[2]);

    // 1. Optional hatch background
    if (showHatchBg) drawHatchBackground(pal);

    // 2. Background washes (soft color blobs)
    var washCount = { sparse: 3, medium: 5, dense: 8 }[currentDensity];
    for (var i = 0; i < washCount; i++) drawBgWash(pal);

    // 3. Doodles — the Alejandro fan-stroke system (the main event)
    var doodles = generateDoodles(pal, currentStyle, currentDensity);
    for (var i = 0; i < doodles.length; i++) drawDoodle(doodles[i]);

    // 4. Color curves
    if (showColorCurves) {
      var curveCount = { sparse: 1, medium: 3, dense: 5 }[currentDensity];
      for (var i = 0; i < curveCount; i++) drawColorCurve(pal);
    }

    // 5. Cross marks
    if (showCrossMarks) {
      var crossCount = { sparse: 6, medium: 14, dense: 26 }[currentDensity];
      for (var i = 0; i < crossCount; i++) {
        var col = random(pal.colors);
        brush.set("crossmark", col, random(0.6, 1.4));
        var cx = random(width * 0.08, width * 0.92);
        var cy = random(height * 0.08, height * 0.92);
        brush.line(cx, cy, cx + 0.5, cy + 0.5);
      }
    }

    return; // first frame is just the foundation
  }

  // ── Audio features ───────────────────────────────────────────────────────────
  var features;
  var isAudioPlaying = audioEngine && audioEngine.isPlaying;
  features = isAudioPlaying ? audioEngine.analyze() : generateSyntheticFeatures(frameT);

  // ── Background fade — marks clear faster between events, build up when loud ──
  var bpmFactor = (features.bpm || 120) / 120;
  var baseFade = map(features.rms, 0, 0.5, 6.0, 1.2);  // quiet=fast fade, loud=slow
  var fadeAlpha = constrain(baseFade * bpmFactor, 2.5, 10.0);
  var bgRgb = hexToRgb(PALETTES[paletteIndex].bg);
  push(); noStroke();
  fill(bgRgb[0], bgRgb[1], bgRgb[2], fadeAlpha);
  rect(0, 0, width, height);
  pop();

  // Update flow field
  fieldAngle += features.mid * 1.5;
  fieldScale = 1.0 + features.bass * 0.6;
  if (frameCount % 5 === 0) brush.refreshField(frameT * 0.06);

  // ── LAYER 1: Bass → Watercolor blobs ─────────────────────────────────────────
  var blobInterval = isAudioPlaying ? Math.max(6, Math.floor(14 - features.bass * 12)) : 12;
  if (features.bass > 0.15 && frameCount % blobInterval === 0) drawWatercolorBlob(features);

  // ── LAYER 2: Mid → Flowing strokes ───────────────────────────────────────────
  var midCount = isAudioPlaying ? Math.floor(1 + features.mid * 4) : Math.floor(1 + features.mid * 2);
  for (var i = 0; i < midCount; i++) drawMidStroke(features, isAudioPlaying);

  // ── LAYER 3: High → Stippled details ─────────────────────────────────────────
  if (features.high > 0.15 && frameCount % 2 === 0) {
    var stippleCount = Math.min(4, Math.floor(features.high * 6));
    for (var i = 0; i < stippleCount; i++) drawHighStipple(features);
  }

  // ── LAYER 4: Beat → Waveform path + watercolor splash ────────────────────────
  if (features.beatFlash > 0.8 && prevBeatFlash <= 0.8) {
    beatCount++;
    var isStaccato = (features.beatDensity || 0.8) > 2.5;

    if (isStaccato) {
      var burstCount = Math.floor(3 + (features.beatStrength || 0.5) * 6);
      for (var b = 0; b < burstCount; b++) {
        brush.set(random(["needle", "splatter", "hard_pencil"]), getBeatColor(),
          0.2 + (features.beatStrength || 0.5) * 1.5);
        brush.flowLine(random(width*0.1,width*0.9), random(height*0.1,height*0.9),
          20+(features.beatStrength||0.5)*60, random(360));
      }
    } else {
      drawWaveformPath(features);
      drawBeatSplash(features);
    }

    if (beatCount % 3 === 0) drawSpiral(
      width*0.15+random(width*0.7), height*0.15+random(height*0.7),
      features.beatStrength || features.bass
    );

    // Palette auto-cycle every 4 beats
    if (autoCycle && beatCount % 4 === 0) {
      paletteIndex = (paletteIndex + 1) % PALETTES.length;
      document.getElementById('paletteSel').value = paletteIndex;
    }
  }
  prevBeatFlash = features.beatFlash;

  // ── LAYER 5: Atmospheric wash strokes ────────────────────────────────────────
  if (frameCount % 14 === 0) {
    brush.set(random(["wash_blob","softwash"]), getPaletteColor(features), random(0.4, 1.2));
    brush.flowLine(random(width*0.1,width*0.9), random(height*0.1,height*0.9), random(80,200), random(360));
  }

  // Occasional spline curves
  var splineInterval = isAudioPlaying ? Math.max(6, Math.floor(14-features.rms*10)) : 14;
  if (frameCount % splineInterval === 0) drawSplineCurve(features);
}

// ─── Foundation Layer — Enfantines Composition Functions ─────────────────────────

// BACKGROUND WASH — large soft watercolor blob seeding the composition
function drawBgWash(pal) {
  brush.noStroke();
  brush.fill(random(pal.colors), random(20, 50));
  brush.bleed(random(0.28, 0.55));  // higher bleed = softer, less rectangular
  try { brush.fillTexture(0.4, 0.3); } catch(e) {}
  brush.rect(random(width*0.1,width*0.9), random(height*0.1,height*0.9),
    random(80,260), random(80,260), CENTER);
  brush.noFill();
}

// HATCH BACKGROUND — diagonal line pattern
function drawHatchBackground(pal) {
  var spacing = random(12, 24);
  brush.set("hatch_brush", pal.colors[0], 0.4);
  for (var x = -height; x < width + height; x += spacing) {
    brush.line(x, 0, x + height, height);
  }
}

// GENERATE DOODLES — build a set of doodle objects (spine + fan parameters)
// Each doodle = curving spine + perpendicular marker strokes cycling through palette colors
function generateDoodles(pal, styleName, density) {
  var style = BUILT_IN_STYLES[styleName] || BUILT_IN_STYLES["Soft & dreamy"];
  var baseCount = { sparse: 3, medium: 5, dense: 8 }[density];
  var count = baseCount + Math.floor(random(0, 3));
  var doodles = [];

  var cols = Math.ceil(Math.sqrt(count * 0.7));
  var rows = Math.ceil(count / cols);
  var cellW = width / cols, cellH = height / rows;
  var idx = 0;

  for (var r = 0; r < rows && idx < count; r++) {
    for (var c = 0; c < cols && idx < count; c++) {
      var cx = (c + 0.5) * cellW + random(-cellW * 0.25, cellW * 0.25);
      var cy = (r + 0.5) * cellH + random(-cellH * 0.25, cellH * 0.25);
      var size = random(Math.min(cellW, cellH) * 0.8, Math.min(cellW, cellH) * 1.4);
      var angle = random(360);
      var spineLen = size * random(0.6, 1.1);

      // Pick N colors from palette as gradient stops
      var stopCount = Math.floor(random(style.stopCount[0], style.stopCount[1] + 1));
      var stops = [], used = {};
      var attempts = 0;
      while (stops.length < stopCount && attempts < 20) {
        var ci = Math.floor(random(pal.colors.length));
        if (!used[ci]) { used[ci] = true; stops.push(pal.colors[ci]); }
        attempts++;
      }

      // Curving spine via 4 control points
      var halfLen = spineLen / 2;
      var perpA = angle + 90;
      var spinePts = [];
      for (var i = 0; i < 4; i++) {
        var t = i / 3;
        var along = lerp(-halfLen, halfLen, t);
        var wobble = random(-size * 0.18, size * 0.18);
        spinePts.push({
          x: cx + cos(angle) * along + cos(perpA) * wobble,
          y: cy + sin(angle) * along + sin(perpA) * wobble
        });
      }

      // Fan brushes — use style's fanBrushes
      var fanPool = style.fanBrushes;

      doodles.push({
        cx: cx, cy: cy, size: size, angle: angle,
        spinePts: spinePts, colorStops: stops,
        halfWidth: random(size * style.halfWidthRange[0], size * style.halfWidthRange[1]),
        teethCount: Math.floor(random(14, 28) * style.teethMultiplier * ({sparse:0.7,medium:1,dense:1.3}[density])),
        fanStyle: random(["symmetric", "one-sided", "staggered", "tapered"]),
        brushType: random(fanPool),
        outline: style.showOutline && random() < 0.7,
        style: style,
      });
      idx++;
    }
  }
  return doodles;
}

// DRAW DOODLE — fan of perpendicular strokes along a curving spine
// This is the core Alejandro Campos Uribe Enfantines II technique:
//   1. Walk spine in N steps
//   2. At each step, draw a fat stroke PERPENDICULAR to the spine
//   3. Color cycles through palette gradient with each stroke
//   4. Spectral blending (blend:true) fuses overlapping colors like real paint
function drawDoodle(d) {
  var S = d.style;

  // Optional underlying wash — the marker strokes will spectrally blend with this
  if (random() < S.underWashProb) {
    var washCol = d.colorStops[Math.floor(random(d.colorStops.length))];
    brush.noStroke();
    brush.fill(washCol, random(S.underWashOpacity[0], S.underWashOpacity[1]));
    brush.bleed(random(S.underWashBleed[0], S.underWashBleed[1]));
    try { brush.fillTexture(0.35, 0.25); } catch(e) {}
    brush.rect(d.cx, d.cy, d.size * 0.85, d.size * 0.85, CENTER);
    brush.noFill();
  }

  var N = d.teethCount;
  for (var i = 0; i < N; i++) {
    var t = i / (N - 1);
    var here = sampleSpline(d.spinePts, t);

    // Tangent by finite difference → perpendicular = +90° + per-tooth jitter
    var eps = 0.005;
    var aHead = sampleSpline(d.spinePts, Math.min(1, t + eps));
    var aBack = sampleSpline(d.spinePts, Math.max(0, t - eps));
    var tanAngle = Math.atan2(aHead.y - aBack.y, aHead.x - aBack.x) * 180 / Math.PI;
    var jitter = d.style.angleJitter || 4;
    var perpAngle = tanAngle + 90 + random(-jitter, jitter);

    // Color: cycle through gradient
    var colorT = (t * S.cycleRate + random(-S.colorJitter, S.colorJitter)) % 1;
    var col = sampleGradient(d.colorStops, colorT);

    // Fan tooth half-lengths by style
    var halfA, halfB;
    if (d.fanStyle === "symmetric") {
      halfA = d.halfWidth * random(0.7, 1.0); halfB = d.halfWidth * random(0.7, 1.0);
    } else if (d.fanStyle === "one-sided") {
      halfA = d.halfWidth * random(0.85, 1.05); halfB = d.halfWidth * 0.05;
    } else if (d.fanStyle === "staggered") {
      halfA = d.halfWidth * (i % 2 === 0 ? random(0.9,1.05) : random(0.4,0.6));
      halfB = d.halfWidth * (i % 2 === 1 ? random(0.9,1.05) : random(0.4,0.6));
    } else { // tapered
      var taper = Math.sin(t * Math.PI);
      halfA = d.halfWidth * taper * random(0.85, 1.05);
      halfB = d.halfWidth * taper * random(0.85, 1.05);
    }

    var weight = random(S.weightRange[0], S.weightRange[1]) * random(S.weightJitter[0], S.weightJitter[1]);
    brush.set(d.brushType, col, weight);
    brush.line(
      here.x - cos(perpAngle) * halfA, here.y - sin(perpAngle) * halfA,
      here.x + cos(perpAngle) * halfB, here.y + sin(perpAngle) * halfB
    );

    // Occasional accent stroke for detail
    if (random() < S.accentProb) {
      var accentCol = sampleGradient(d.colorStops, (colorT + 0.5) % 1);
      brush.set("bristle", accentCol, random(0.5, 1.2));
      brush.line(
        here.x - cos(perpAngle) * halfA * 0.7, here.y - sin(perpAngle) * halfA * 0.7,
        here.x + cos(perpAngle) * halfB * 0.7, here.y + sin(perpAngle) * halfB * 0.7
      );
    }
  }
}

// COLOR CURVE — long spline stroke shifting through palette colors
// Spectral blending fuses adjacent color segments (blue→green where they meet)
function drawColorCurve(pal) {
  var archetypes = ["arc", "s-curve", "horizontal-wave", "diagonal-drift", "vertical-flow"];
  var controls = generatePath(random(archetypes));

  // Pick 2-4 palette colors as gradient stops
  var stopCount = Math.floor(random(2, 5));
  var stops = [], used = {};
  var attempts = 0;
  while (stops.length < stopCount && attempts < 20) {
    var idx = Math.floor(random(pal.colors.length));
    if (!used[idx]) { used[idx] = true; stops.push(pal.colors[idx]); }
    attempts++;
  }

  var useMarker = random() < 0.75;
  var brushType = useMarker ? random(["marker", "marker2", "hard_marker"]) : "cpencil";
  var baseWeight = useMarker ? random(1.4, 2.6) : random(1.2, 2.0);
  var segments = Math.floor(random(25, 45));

  var prev = sampleSpline(controls, 0);
  for (var i = 1; i <= segments; i++) {
    var t = i / segments;
    var pt = sampleSpline(controls, t);
    var col = sampleGradient(stops, t + random(-0.04, 0.04));
    brush.set(brushType, col, baseWeight * random(0.85, 1.15));
    brush.line(prev.x, prev.y, pt.x, pt.y);
    prev = pt;
  }

  // Occasional bristle dabs along the curve
  if (random() < 0.4) {
    var dabs = Math.floor(random(3, 8));
    for (var i = 0; i < dabs; i++) {
      var t = random();
      var pt = sampleSpline(controls, t);
      brush.set("bristle", sampleGradient(stops, t), random(0.7, 1.3));
      var a = random(360);
      brush.line(pt.x, pt.y, pt.x + cos(a)*random(4,12), pt.y + sin(a)*random(4,12));
    }
  }
}

// Generate control points for a path archetype
function generatePath(archetype) {
  var m = Math.min(width, height) * 0.12;
  switch (archetype) {
    case "arc":
      var side = random() < 0.5, x0 = side ? m : width-m, x1 = side ? width-m : m;
      var y0 = random(height*0.2,height*0.8), y1 = random(height*0.2,height*0.8);
      var yMid = (y0+y1)/2 + random(-height*0.25,height*0.25);
      return [{x:x0,y:y0},{x:width*0.35,y:yMid+random(-30,30)},{x:width*0.65,y:yMid+random(-30,30)},{x:x1,y:y1}];
    case "s-curve":
      return [{x:random(width*0.1,width*0.3),y:m+random(0,height*0.2)},
              {x:random(width*0.25,width*0.45),y:height*0.35+random(-30,30)},
              {x:random(width*0.55,width*0.75),y:height*0.65+random(-30,30)},
              {x:random(width*0.7,width*0.9),y:height-m-random(0,height*0.2)}];
    case "horizontal-wave":
      var y = random(height*0.25,height*0.75), amp = random(20,70);
      return [{x:m,y:y},{x:width*0.3,y:y+amp*random([-1,1])},
              {x:width*0.5,y:y+amp*random([-1,1])},{x:width*0.7,y:y+amp*random([-1,1])},{x:width-m,y:y}];
    case "diagonal-drift":
      var x0 = random(m,width*0.3), y0 = random(m,height*0.3);
      var x1 = random(width*0.7,width-m), y1 = random(height*0.7,height-m);
      return [{x:x0,y:y0},{x:lerp(x0,x1,0.4)+random(-50,50),y:lerp(y0,y1,0.4)+random(-50,50)},
              {x:lerp(x0,x1,0.7)+random(-50,50),y:lerp(y0,y1,0.7)+random(-50,50)},{x:x1,y:y1}];
    case "vertical-flow":
      var x = random(width*0.2,width*0.8), amp = random(15,60);
      return [{x:x,y:m},{x:x+amp*random([-1,1]),y:height*0.3},
              {x:x+amp*random([-1,1]),y:height*0.6},{x:x,y:height-m}];
  }
  return [{x:0,y:0},{x:width,y:height}];
}

// ─── Audio-Reactive Layer Helpers ─────────────────────────────────────────────────

function drawWatercolorBlob(features) {
  var col = getPaletteColor(features);
  var blobSize = 40 + features.bass * 160;
  var aspect = random(0.6, 1.4);
  brush.noStroke();  // prevent rectangle outlines from any prior brush.set()
  brush.fill(col, random(45, 95));
  brush.bleed(constrain(0.05 + features.bass * 0.3, 0, 0.5));
  try { brush.fillTexture(0.3 + features.bass * 0.4, 0.3); } catch(e) {}
  brush.rect(random(width*0.08,width*0.92), random(height*0.08,height*0.92),
    blobSize*aspect, blobSize/aspect, CENTER);
  brush.noFill();
}

function drawMidStroke(features, isAudio) {
  var col = getPaletteColor(features);
  var flux = features.spectralFlux || 0;
  var isTransient = flux > 0.8;
  var w, len, brushType;
  if (isAudio) {
    if (isTransient) {
      w = 0.15 + features.mid * 1.5; len = 20 + features.mid * 80;
      brushType = random(["needle","splatter","hard_pencil","crossmark"]);
    } else {
      w = 0.4 + features.mid * 3.5; len = 80 + features.mid * 350;
      brushType = random(["ink_wash","calligraphy","softwash","bristle"]);
    }
  } else {
    w = 0.3 + features.mid * 1.2; len = 50 + features.mid * 150;
    brushType = random(["calligraphy","ink_wash","charcoal"]);
  }
  brush.set(brushType, col, w);
  brush.flowLine(random(width*0.02,width*0.98), random(height*0.02,height*0.98), len, random(360));
}

function drawHighStipple(features) {
  brush.set(random(["needle","splatter","hard_pencil"]), getPaletteColor(features), 0.15 + features.high * 1.5);
  brush.flowLine(random(width*0.05,width*0.95), random(height*0.05,height*0.95), 15+features.high*60, random(360));
}

function drawWaveformPath(features) {
  var strength = features.beatStrength || 0.5;
  var points = [], numPts = 32;
  var centerX = random(width*0.15, width*0.85), centerY = random(height*0.15, height*0.85);
  var spread = 150 + strength * 350;
  var hasWaveform = audioEngine && audioEngine.timeData && audioEngine.isPlaying;
  for (var i = 0; i < numPts; i++) {
    var t = i / (numPts - 1);
    var sample = hasWaveform
      ? audioEngine.timeData[Math.floor(t * (audioEngine.timeData.length - 1))]
      : noise(i * 0.3 + frameT) * 2 - 1;
    points.push([centerX - spread/2 + t*spread, centerY + sample*(80+features.rms*120), random(0.5,1.5)]);
  }
  brush.set(random(["calligraphy","ink_wash","hard_marker"]), getBeatColor(), 0.3+strength*2.5);
  brush.spline(points, 0.7);
}

function drawBeatSplash(features) {
  var strength = features.beatStrength || 0.5;
  var splashSize = 30 + strength * 150;
  var bleedAmt = 0.05 + strength * 0.40;
  brush.noStroke();  // prevent rectangle outlines
  brush.fill(getBeatColor(), 35 + strength * 60);
  brush.bleed(bleedAmt);
  try { brush.fillTexture(0.3 + strength*0.4, 0.3); } catch(e) {}
  brush.rect(random(width*0.15,width*0.85), random(height*0.15,height*0.85),
    splashSize*random(0.7,1.3), splashSize*random(0.7,1.3), CENTER);
  brush.noFill();
  if (strength > 0.5) {
    brush.noStroke();
    brush.fill(getBeatColor2(), random(40, 70));
    brush.bleed(bleedAmt * 0.8);
    brush.rect(random(width*0.2,width*0.8), random(height*0.2,height*0.8),
      splashSize*random(0.4,0.8), splashSize*random(0.4,0.8), CENTER);
    brush.noFill();
  }
}

function drawSpiral(x, y, intensity) {
  var numSegments = Math.floor(random(12, 40 + intensity * 30));
  brush.pick("calligraphy"); brush.stroke(getBeatColor()); brush.strokeWeight(random(0.5,1.5));
  brush.beginStroke("curve", x, y);
  var initAngle = random(0, 360);
  for (var i = 0; i < numSegments; i++) {
    brush.segment(0+initAngle,   0+i*22, random(0.5,1.5));
    brush.segment(90+initAngle,  6+i*22, random(0.5,1.5));
    brush.segment(180+initAngle, 11+i*22, random(0.5,1.5));
    brush.segment(270+initAngle, 16+i*22, random(0.5,1.5));
  }
  brush.endStroke(0+initAngle, 1);
}

function drawSplineCurve(features) {
  var numPts = Math.floor(4 + features.mid * 5);
  var points = [], startX = random(width*0.05,width*0.95), startY = random(height*0.05,height*0.95);
  for (var i = 0; i < numPts; i++) {
    var spread = 60 + features.bass * 150;
    points.push([startX+random(-spread,spread)*(i+1)*0.4, startY+random(-spread,spread)*(i+1)*0.4, random(0.5,1.6)]);
  }
  brush.set(random(["ink_wash","calligraphy","2B","hard_marker"]), getPaletteColor(features), 0.4+features.high*2.5);
  brush.spline(points, random(0.4, 0.9));
}

// ─── Resize: CSS handles fullscreen — do NOT call resizeCanvas() ─────────────────
