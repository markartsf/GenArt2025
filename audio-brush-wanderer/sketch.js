// Audio Brush Wanderer
// Noise-field wanderers draw with p5.brush, driven by uploaded music
// Inspired by audio-responsive-brush concept but using file-based audio engine
// with frequency-mapped wanderers, beat reactions, and mood palettes

// ─── HSB → Hex Converter ────────────────────────────────────────────────────────
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
var MOODS = [
  { name: "Ink",     hues: [210, 220, 240, 190],  sat: [30, 70],  bri: [20, 55],  bg: [247, 245, 240] },
  { name: "Ember",   hues: [0, 15, 35, 350],      sat: [60, 95],  bri: [40, 80],  bg: [250, 242, 232] },
  { name: "Forest",  hues: [90, 120, 150, 60],     sat: [35, 75],  bri: [25, 60],  bg: [240, 245, 238] },
  { name: "Violet",  hues: [270, 290, 310, 250],   sat: [50, 90],  bri: [35, 75],  bg: [245, 240, 248] },
];

// ─── Wanderer Class ─────────────────────────────────────────────────────────────
// Each wanderer is a point that moves through a noise field,
// drawing brush strokes as it goes. Different wanderers respond
// to different frequency bands.
function Wanderer(band, noiseOffset) {
  this.band = band;           // "bass", "mid", "high"
  this.nOff = noiseOffset;    // unique noise offset for independent paths
  this.x = 0;
  this.y = 0;
  this.px = 0;                // previous position
  this.py = 0;
  this.angle = 0;
  this.active = false;
  this.stepsAlive = 0;
  this.maxSteps = 300;        // respawn after this many steps
  this.brushName = "HB";      // assigned in spawn
  this.weight = 1;
  this.colorHex = "#333333";
}

Wanderer.prototype.spawn = function(canvasW, canvasH) {
  this.x = random(canvasW * 0.1, canvasW * 0.9);
  this.y = random(canvasH * 0.1, canvasH * 0.9);
  this.px = this.x;
  this.py = this.y;
  this.stepsAlive = 0;
  this.maxSteps = Math.floor(random(150, 500));
  this.active = true;

  // Assign brush by band
  if (this.band === "bass") {
    this.brushName = random(["ink_wash", "thick_oil", "2B"]);
    this.weight = random(2.5, 6.0);
  } else if (this.band === "mid") {
    this.brushName = random(["calligraphy", "HB", "ink_wash"]);
    this.weight = random(1.0, 3.5);
  } else {
    this.brushName = random(["needle", "HB", "rotring"]);
    this.weight = random(0.3, 1.2);
  }
};

Wanderer.prototype.update = function(features, canvasW, canvasH, noiseScale) {
  if (!this.active) return;

  this.px = this.x;
  this.py = this.y;

  // Get the band level for this wanderer
  var level;
  if (this.band === "bass") level = features.bass;
  else if (this.band === "mid") level = features.mid;
  else level = features.high;

  // Noise-field angle — scale varies with energy
  var ns = noiseScale * (1 + level * 2);
  this.angle = noise(this.x * ns + this.nOff, this.y * ns + this.nOff, frameT * 0.15) * 720;

  // Step length: quiet = tiny drifts, loud = bold strokes
  var stepLen = 1 + level * 25;

  // Add beat impulse — sudden speed burst
  if (features.beatFlash > 0.3) {
    stepLen += features.beatStrength * 15;
  }

  this.x += Math.cos(this.angle * Math.PI / 180) * stepLen;
  this.y += Math.sin(this.angle * Math.PI / 180) * stepLen;

  this.stepsAlive++;

  // Respawn if off-screen or lived too long
  if (this.x < -20 || this.x > canvasW + 20 ||
      this.y < -20 || this.y > canvasH + 20 ||
      this.stepsAlive > this.maxSteps ||
      random(1) < 0.003) {
    this.spawn(canvasW, canvasH);
  }
};

Wanderer.prototype.draw = function(features) {
  if (!this.active) return;

  // Get band level for pressure
  var level;
  if (this.band === "bass") level = features.bass;
  else if (this.band === "mid") level = features.mid;
  else level = features.high;

  // Only draw when there's some energy in this band
  if (level < 0.05) return;

  // Pressure mapped from band level
  var pressure = map(level, 0.05, 0.5, 0.2, 2.5, true);

  brush.pick(this.brushName);
  brush.stroke(this.colorHex);
  brush.strokeWeight(this.weight);
  brush.line(this.px, this.py, this.x, this.y, pressure);
};

// ─── State ──────────────────────────────────────────────────────────────────────
var audioEngine;
var brushScale = 1;
var brushReady = false;
var frameT = 0;

// Wanderers — 3 bass, 4 mid, 3 high = 10 simultaneous paths
var wanderers = [];
var WANDERER_CONFIG = [
  { band: "bass", count: 3 },
  { band: "mid",  count: 4 },
  { band: "high", count: 3 },
];

// Mood / color state
var moodIndex = 0;
var hueAccum = 0;
var beatCount = 0;
var prevBeatFlash = 0;

// Noise field
var NOISE_SCALE = 0.004;  // base noise scale (wanderer adjusts per energy)

// ─── Synthetic features for generative mode ─────────────────────────────────────
function generateSyntheticFeatures(t) {
  return {
    bass:         0.15 + 0.10 * Math.sin(t * 0.25),
    mid:          0.12 + 0.08 * noise(t * 0.4),
    high:         0.08 + 0.05 * noise(t * 0.7 + 100),
    rms:          0.10 + 0.06 * Math.sin(t * 0.35),
    centroid:     0.3 + 0.2 * noise(t * 0.12 + 200),
    beatFlash:    Math.sin(t * 0.6) > 0.99 ? 1.0 : 0,
    beatStrength: Math.sin(t * 0.6) > 0.99 ? random(0.3, 0.8) : 0,
    beatDensity:  0.6,
    bpm:          72,
    spectralFlux: 0,
  };
}

// ─── Color Helpers ──────────────────────────────────────────────────────────────
function getMoodColor(features, bandBias) {
  var mood = MOODS[moodIndex];
  var hueIdx = Math.floor(random(mood.hues.length));
  var h = mood.hues[hueIdx] + hueAccum + random(-12, 12);

  // Energy from audio
  var energy = constrain((features.rms + features.bass) / 0.5, 0, 1);

  // Saturation: pale when quiet, vivid when loud
  var s = map(energy, 0, 1, 15, mood.sat[1]);
  // Brightness: light and airy when quiet, deeper when loud
  var b = map(energy, 0, 1, 88, mood.bri[0] + (mood.bri[1] - mood.bri[0]) * 0.5);

  s = constrain(s + random(-6, 6), 8, 100);
  b = constrain(b + random(-5, 5), 20, 100);

  // Band-specific hue shift: bass warmer, high cooler
  if (bandBias === "bass") h -= 15;
  else if (bandBias === "high") h += 20;

  return hsbToHex(h, s, b);
}

function getBeatColor() {
  var mood = MOODS[moodIndex];
  var h = mood.hues[0] + hueAccum + random(-15, 15);
  var s = constrain(mood.sat[1] + 10, 50, 100);
  var b = constrain(mood.bri[1] + 5, 55, 100);
  return hsbToHex(h, s, b);
}

// ─── Refresh wanderer colors ────────────────────────────────────────────────────
function refreshWandererColors(features) {
  for (var i = 0; i < wanderers.length; i++) {
    wanderers[i].colorHex = getMoodColor(features, wanderers[i].band);
  }
}

// ─── Custom Brush Definitions ───────────────────────────────────────────────────
function registerCustomBrushes() {
  brush.add("calligraphy", {
    type: "custom", weight: 3.5, vibration: 0.15,
    opacity: 50, spacing: 0.35, blend: true,
    pressure: {
      type: "custom", min_max: [0.5, 1.4],
      curve: function(x) { return 0.5 + 0.5 * Math.sin(x * Math.PI); }
    },
    tip: function(_m) { _m.rect(-4, -0.5, 8, 1); },
    rotate: "natural"
  });

  brush.add("ink_wash", {
    type: "custom", weight: 10, vibration: 2.5,
    opacity: 12, spacing: 0.4, blend: true,
    pressure: { type: "standard", curve: [0.1, 0.2], min_max: [0.8, 1.2] },
    tip: function(_m) {
      _m.ellipse(0, 0, 7, 3);
      _m.ellipse(1.5, 0.8, 4, 2);
    },
    rotate: "natural"
  });

  brush.add("splatter", {
    type: "spray", weight: 0.9, vibration: 25,
    quality: 55, opacity: 100, spacing: 0.9,
    blend: false,
    pressure: { type: "standard", curve: [0.15, 0.25], min_max: [0.4, 1.6] }
  });

  brush.add("needle", {
    type: "default", weight: 0.12, vibration: 0.08,
    definition: 0.95, quality: 2, opacity: 210,
    spacing: 0.08, blend: false,
    pressure: { type: "standard", curve: [0.05, 0.1], min_max: [0.9, 1.05] }
  });

  brush.add("thick_oil", {
    type: "marker", weight: 4.5, vibration: 0.25,
    opacity: 50, spacing: 0.3, blend: true,
    pressure: { type: "standard", curve: [0.25, 0.2], min_max: [0.9, 1.5] }
  });

  console.log("Wanderer brushes registered:", brush.box());
}

// ─── Beat Burst: Radial splatter on beat ────────────────────────────────────────
function drawBeatBurst(features, canvasW, canvasH) {
  var cx, cy;
  // Center burst on a random wanderer position for organic placement
  var randWanderer = wanderers[Math.floor(random(wanderers.length))];
  if (randWanderer && randWanderer.active) {
    cx = randWanderer.x;
    cy = randWanderer.y;
  } else {
    cx = random(canvasW * 0.2, canvasW * 0.8);
    cy = random(canvasH * 0.2, canvasH * 0.8);
  }

  var strength = features.beatStrength || 0.5;
  var numRays = Math.floor(3 + strength * 8);  // 3-11 rays

  // Choose brush based on beat density (staccato = sharp, sustained = soft)
  var burstBrush, burstWeight;
  if (features.beatDensity > 2.5) {
    // Staccato: sharp needle bursts
    burstBrush = "needle";
    burstWeight = 0.4 + strength * 0.8;
  } else {
    // Normal: splatter or thick_oil
    burstBrush = random(["splatter", "thick_oil", "calligraphy"]);
    burstWeight = 1.0 + strength * 3.0;
  }

  brush.pick(burstBrush);
  brush.stroke(getBeatColor());
  brush.strokeWeight(burstWeight);

  for (var i = 0; i < numRays; i++) {
    var a = random(360);
    var len = 15 + strength * 60 + random(-10, 10);
    var x1 = cx + Math.cos(a * Math.PI / 180) * 5;
    var y1 = cy + Math.sin(a * Math.PI / 180) * 5;
    var x2 = cx + Math.cos(a * Math.PI / 180) * len;
    var y2 = cy + Math.sin(a * Math.PI / 180) * len;
    brush.line(x1, y1, x2, y2, 0.5 + strength);
  }
}

// ─── Waveform Path on Beat ──────────────────────────────────────────────────────
function drawWaveformPath(features, canvasW, canvasH) {
  if (!audioEngine || !audioEngine.timeData) return;

  var strength = features.beatStrength || 0.5;
  var nSamples = 24;
  var step = Math.floor(audioEngine.timeData.length / nSamples);

  // Position the waveform near a random wanderer
  var randW = wanderers[Math.floor(random(wanderers.length))];
  var cx = (randW && randW.active) ? randW.x : random(canvasW * 0.2, canvasW * 0.8);
  var cy = (randW && randW.active) ? randW.y : random(canvasH * 0.2, canvasH * 0.8);

  var spread = 80 + strength * 200;
  var pts = [];

  for (var i = 0; i < nSamples; i++) {
    var sample = audioEngine.timeData[i * step] || 0;
    var px = cx - spread / 2 + (i / (nSamples - 1)) * spread;
    var py = cy + sample * (40 + strength * 80);
    pts.push([px, py]);
  }

  brush.pick(random(["calligraphy", "HB"]));
  brush.stroke(getBeatColor());
  brush.strokeWeight(0.8 + strength * 2.0);

  // Draw as connected line segments
  for (var i = 0; i < pts.length - 1; i++) {
    brush.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0.5 + strength * 0.5);
  }
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

  // Initialize p5.brush
  try {
    brushScale = w / 800;
    brush.scale(brushScale);
    brush.load();
    brush.scaleBrushes(1.2);
    registerCustomBrushes();
    brush.field("waves");
    brushReady = true;
    console.log("p5.brush loaded — Audio Brush Wanderer");
  } catch (e) {
    console.error("p5.brush load failed:", e.message);
    brushReady = false;
  }

  // Initialize audio engine with default track
  audioEngine = new AudioEngine();
  audioEngine.init('GlassHorizon.mp3');

  // Wire up UI controls
  document.getElementById('playBtn').addEventListener('click', function() {
    audioEngine.play();
    // Refresh all wanderer colors when audio starts
    var f = audioEngine.analyze();
    refreshWandererColors(f);
  });
  document.getElementById('stopBtn').addEventListener('click', function() {
    audioEngine.stop();
  });
  document.getElementById('audioFile').addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
      audioEngine.loadFile(e.target.files[0]);
    }
  });
  document.getElementById('fullscreenBtn').addEventListener('click', function() {
    var el = document.getElementById('container');
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(function() {});
    } else {
      document.exitFullscreen();
    }
  });

  // Create wanderers
  for (var c = 0; c < WANDERER_CONFIG.length; c++) {
    for (var i = 0; i < WANDERER_CONFIG[c].count; i++) {
      var w2 = new Wanderer(WANDERER_CONFIG[c].band, random(1000));
      w2.spawn(w, h);
      wanderers.push(w2);
    }
  }

  // Draw initial background
  background('#f7f5f0');

  // Initial color assignment
  var synthF = generateSyntheticFeatures(0);
  refreshWandererColors(synthF);
}

// ─── p5 Draw ────────────────────────────────────────────────────────────────────
function draw() {
  if (!brushReady) return;

  frameT = frameCount * 0.02;

  // Get audio features (real or synthetic)
  var features;
  if (audioEngine && audioEngine.isPlaying) {
    features = audioEngine.analyze();
  } else {
    features = generateSyntheticFeatures(frameT);
  }

  // ─── Hue drift from spectral centroid ─────────────────────────────
  hueAccum += (features.centroid || 0.3) * 1.2;

  // ─── Beat detection → mood cycling + burst effects ────────────────
  var beatEdge = (features.beatFlash > 0.7 && prevBeatFlash <= 0.7);
  prevBeatFlash = features.beatFlash;

  if (beatEdge) {
    beatCount++;
    // Cycle mood every 6 beats
    if (beatCount % 6 === 0) {
      moodIndex = (moodIndex + 1) % MOODS.length;
      // Refresh all wanderer colors for new mood
      refreshWandererColors(features);
    }
    // Color refresh on every other beat (keeps colors dynamic)
    if (beatCount % 2 === 0) {
      refreshWandererColors(features);
    }
  }

  // ─── Background fade ──────────────────────────────────────────────
  // Slow fade to reveal accumulated strokes, faster when loud
  var mood = MOODS[moodIndex];
  var bpmFactor = constrain((features.bpm || 120) / 120, 0.8, 1.5);
  var baseFade = 2;  // very slow base fade — strokes persist
  var fadeAlpha = baseFade * bpmFactor;

  // During quiet moments fade slightly faster (canvas breathes)
  if (features.rms < 0.05) fadeAlpha += 1;

  var bgR = mood.bg[0], bgG = mood.bg[1], bgB = mood.bg[2];
  fill(bgR, bgG, bgB, fadeAlpha);
  noStroke();
  rect(-width / 2, -height / 2, width, height);

  // ─── Update and draw wanderers ────────────────────────────────────
  // Adjust noise scale based on spectral flux (flux = more turbulent field)
  var dynamicNoise = NOISE_SCALE * (1 + (features.spectralFlux || 0) * 0.5);

  for (var i = 0; i < wanderers.length; i++) {
    wanderers[i].update(features, width, height, dynamicNoise);
    wanderers[i].draw(features);
  }

  // ─── Beat effects ─────────────────────────────────────────────────
  if (beatEdge) {
    drawBeatBurst(features, width, height);

    // On strong beats, also draw a waveform path
    if ((features.beatStrength || 0) > 0.4) {
      drawWaveformPath(features, width, height);
    }
  }

  // ─── Periodic color refresh (keeps things evolving) ───────────────
  if (frameCount % 90 === 0) {
    refreshWandererColors(features);
  }
}
