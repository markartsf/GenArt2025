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

// ─── Late Winter Palette ─────────────────────────────────────────────────────────
// End of winter, hint of fall — dark blues, indigo, blue-grey, off-white,
// touches of amber/yellow, light blue sky
var PALETTE = [
  "#1a2744",  // dark navy
  "#1e2d5a",  // deep blue
  "#2d2455",  // dark indigo
  "#3a4a6b",  // slate blue
  "#6b7d8e",  // neutral blue-grey
  "#8fb4c9",  // light sky blue
  "#a8bfc8",  // pale blue-grey
  "#c4a35a",  // amber / hint of fall
  "#d4b96a",  // soft gold
  "#dcd4c0",  // warm off-white
  "#e8e4dc",  // ice white
];

// Weights control how often each color is picked (dark blues dominate,
// amber/gold appear as rare accents)
var PALETTE_WEIGHTS = [
  3,   // dark navy        — frequent
  3,   // deep blue        — frequent
  2,   // dark indigo      — common
  2,   // slate blue       — common
  2,   // neutral blue-grey — common
  2,   // light sky blue   — common
  1,   // pale blue-grey   — occasional
  1,   // amber            — rare accent
  1,   // soft gold        — rare accent
  1,   // warm off-white   — occasional
  1,   // ice white        — occasional
];

// Background color — warm off-white that complements the palette
var BG_COLOR = [240, 237, 230];

// Build a weighted array for easy random selection
var WEIGHTED_PALETTE = [];
for (var _pi = 0; _pi < PALETTE.length; _pi++) {
  for (var _wi = 0; _wi < PALETTE_WEIGHTS[_pi]; _wi++) {
    WEIGHTED_PALETTE.push(PALETTE[_pi]);
  }
}

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
  // WEBGL coordinates: (0,0) is center, range is -w/2..w/2, -h/2..h/2
  var hw = canvasW / 2, hh = canvasH / 2;
  this.x = random(-hw * 0.85, hw * 0.85);
  this.y = random(-hh * 0.85, hh * 0.85);
  this.px = this.x;
  this.py = this.y;
  this.stepsAlive = 0;
  this.maxSteps = Math.floor(random(150, 500));
  this.active = true;

  // Assign brush by band — wide variety across all built-in + custom types
  if (this.band === "bass") {
    this.brushName = random(["thick_oil", "2B", "charcoal", "marker", "marker2", "ink_wash"]);
    this.weight = random(2.0, 5.0);
  } else if (this.band === "mid") {
    this.brushName = random(["calligraphy", "HB", "pen", "cpencil", "2H", "hatch_brush"]);
    this.weight = random(1.0, 3.0);
  } else {
    this.brushName = random(["HB", "rotring", "pen", "needle", "splatter", "2H"]);
    this.weight = random(0.4, 1.5);
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

  // Step length: quiet = gentle drifts, loud = bold leaping strokes
  var stepLen = 2 + level * 50;

  // Add beat impulse — sudden speed burst
  if (features.beatFlash > 0.3) {
    stepLen += features.beatStrength * 25;
  }

  // Spectral flux = musical transients → extra jolt
  if ((features.spectralFlux || 0) > 0.5) {
    stepLen += features.spectralFlux * 10;
  }

  this.x += Math.cos(this.angle * Math.PI / 180) * stepLen;
  this.y += Math.sin(this.angle * Math.PI / 180) * stepLen;

  this.stepsAlive++;

  // Respawn if off-screen or lived too long (WEBGL coords: -w/2..w/2)
  var hw = canvasW / 2, hh = canvasH / 2;
  if (this.x < -hw - 20 || this.x > hw + 20 ||
      this.y < -hh - 20 || this.y > hh + 20 ||
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

  // Always draw — even at low energy, gentle marks; loud = heavy pressure
  var pressure = map(level, 0, 0.6, 0.3, 3.0, true);

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

// Wanderers — 5 bass, 6 mid, 4 high = 15 simultaneous paths
var wanderers = [];
var WANDERER_CONFIG = [
  { band: "bass", count: 5 },
  { band: "mid",  count: 6 },
  { band: "high", count: 4 },
];

// Color state
var beatCount = 0;
var prevBeatFlash = 0;

// Noise field
var NOISE_SCALE = 0.004;  // base noise scale (wanderer adjusts per energy)

// ─── Synthetic features for generative mode ─────────────────────────────────────
function generateSyntheticFeatures(t) {
  return {
    bass:         0.25 + 0.15 * Math.sin(t * 0.25),
    mid:          0.20 + 0.12 * noise(t * 0.4),
    high:         0.12 + 0.08 * noise(t * 0.7 + 100),
    rms:          0.15 + 0.10 * Math.sin(t * 0.35),
    centroid:     0.3 + 0.2 * noise(t * 0.12 + 200),
    beatFlash:    Math.sin(t * 0.6) > 0.985 ? 1.0 : 0,
    beatStrength: Math.sin(t * 0.6) > 0.985 ? random(0.4, 0.9) : 0,
    beatDensity:  0.8,
    bpm:          80,
    spectralFlux: 0.2,
  };
}

// ─── Color Helpers ──────────────────────────────────────────────────────────────

// Pick a color from the weighted palette, with band bias:
//   bass → darker colors (first half of palette)
//   mid  → full range
//   high → lighter colors + accents (second half)
function getPaletteColor(bandBias) {
  if (bandBias === "bass") {
    // Bass gets dark navys, indigos, slate blues
    return random(PALETTE.slice(0, 5));
  } else if (bandBias === "high") {
    // High gets light blues, blue-greys, off-whites, occasional amber
    return random(PALETTE.slice(4));
  } else {
    // Mid gets the full weighted range
    return random(WEIGHTED_PALETTE);
  }
}

// Beat accent — amber/gold for warmth against the cool palette
function getBeatColor() {
  return random(["#c4a35a", "#d4b96a", "#8fb4c9", "#1e2d5a", "#e8e4dc"]);
}

// ─── Refresh wanderer colors ────────────────────────────────────────────────────
function refreshWandererColors() {
  for (var i = 0; i < wanderers.length; i++) {
    wanderers[i].colorHex = getPaletteColor(wanderers[i].band);
  }
}

// ─── Custom Brush Definitions ───────────────────────────────────────────────────
function registerCustomBrushes() {
  brush.add("calligraphy", {
    type: "custom", weight: 3.5, vibration: 0.15,
    opacity: 60, spacing: 0.3, blend: true,
    pressure: {
      type: "custom", min_max: [0.5, 1.4],
      curve: function(x) { return 0.5 + 0.5 * Math.sin(x * Math.PI); }
    },
    tip: function(_m) { _m.rect(-4, -0.5, 8, 1); },
    rotate: "natural"
  });

  brush.add("ink_wash", {
    type: "custom", weight: 10, vibration: 2.5,
    opacity: 25, spacing: 0.35, blend: true,
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
    opacity: 55, spacing: 0.3, blend: true,
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
    cx = random(-canvasW * 0.3, canvasW * 0.3);
    cy = random(-canvasH * 0.3, canvasH * 0.3);
  }

  var strength = features.beatStrength || 0.5;
  var numRays = Math.floor(3 + strength * 8);  // 3-11 rays

  // Choose brush based on beat density (staccato = sharp, sustained = soft)
  var burstBrush, burstWeight;
  if (features.beatDensity > 2.5) {
    // Staccato: sharp bursts
    burstBrush = random(["needle", "rotring", "pen"]);
    burstWeight = 0.4 + strength * 1.2;
  } else {
    // Normal: varied burst styles
    burstBrush = random(["splatter", "thick_oil", "calligraphy", "marker", "charcoal"]);
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

  // Position the waveform near a random wanderer (WEBGL coords)
  var randW = wanderers[Math.floor(random(wanderers.length))];
  var cx = (randW && randW.active) ? randW.x : random(-canvasW * 0.3, canvasW * 0.3);
  var cy = (randW && randW.active) ? randW.y : random(-canvasH * 0.3, canvasH * 0.3);

  var spread = 80 + strength * 200;
  var pts = [];

  for (var i = 0; i < nSamples; i++) {
    var sample = audioEngine.timeData[i * step] || 0;
    var px = cx - spread / 2 + (i / (nSamples - 1)) * spread;
    var py = cy + sample * (40 + strength * 80);
    pts.push([px, py]);
  }

  brush.pick(random(["calligraphy", "HB", "2B", "charcoal"]));
  brush.stroke(getBeatColor());
  brush.strokeWeight(0.8 + strength * 2.5);

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
    refreshWandererColors();
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
  var bgHex = '#' +
    ('0' + BG_COLOR[0].toString(16)).slice(-2) +
    ('0' + BG_COLOR[1].toString(16)).slice(-2) +
    ('0' + BG_COLOR[2].toString(16)).slice(-2);
  background(bgHex);

  // Initial color assignment from palette
  refreshWandererColors();
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

  // ─── Beat detection → color refresh + burst effects ─────────────
  var beatEdge = (features.beatFlash > 0.7 && prevBeatFlash <= 0.7);
  prevBeatFlash = features.beatFlash;

  if (beatEdge) {
    beatCount++;
    // Refresh wanderer colors on every beat — keeps palette alive
    refreshWandererColors();
  }

  // ─── Background fade ──────────────────────────────────────────────
  // Moderate fade — strokes persist then dissolve, canvas breathes
  var bpmFactor = constrain((features.bpm || 120) / 120, 0.8, 1.3);
  var baseFade = 3;
  var fadeAlpha = baseFade * bpmFactor;

  // Fade faster during quiet (canvas clears), slower when loud (strokes pile)
  if (features.rms < 0.05) fadeAlpha += 2;
  else if (features.rms > 0.2) fadeAlpha = Math.max(1.5, fadeAlpha - 1);

  fill(BG_COLOR[0], BG_COLOR[1], BG_COLOR[2], fadeAlpha);
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
  if (frameCount % 60 === 0) {
    refreshWandererColors();
  }
}

// ─── Regenerate: clear canvas + respawn all wanderers ───────────────────────────
function regenerate() {
  // Clear the canvas with background color
  var bgHex = '#' +
    ('0' + BG_COLOR[0].toString(16)).slice(-2) +
    ('0' + BG_COLOR[1].toString(16)).slice(-2) +
    ('0' + BG_COLOR[2].toString(16)).slice(-2);
  background(bgHex);

  // Reset noise seed for completely different field patterns
  noiseSeed(Math.floor(random(100000)));

  // Respawn all wanderers with new noise offsets, positions, and brushes
  for (var i = 0; i < wanderers.length; i++) {
    wanderers[i].nOff = random(1000);
    wanderers[i].spawn(width, height);
  }

  // Fresh colors from the palette
  refreshWandererColors();

  console.log("Regenerated — fresh canvas");
}

// ─── Keyboard handler ───────────────────────────────────────────────────────────
function keyPressed() {
  if (key === 'r' || key === 'R') {
    regenerate();
  }
}
