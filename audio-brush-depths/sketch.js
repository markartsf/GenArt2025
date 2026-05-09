// Audio Brush Depths
// Three explicit depth layers drawn with p5.brush:
//   DEEP  — watercolor fills (brush.fill + brush.bleed), driven by bass
//   MID   — flowing splines (brush.spline) following flow fields, driven by mid
//   NEAR  — sharp needle/pen strokes + hatch patterns, driven by high
//
// The result layers blurred watercolor pools behind organic curves behind
// crisp details — like looking through smoked glass at a painting being made.

// ─── Late Winter Palette ─────────────────────────────────────────────────────────
// Same palette family as audio-brush-wanderer — dark blues, indigo,
// blue-grey, off-white, amber accents — organized by depth layer
var PALETTE = {
  // DEEP layer: richest, most saturated darks
  deep: [
    "#0f1d3a",  // midnight navy
    "#1a2744",  // dark navy
    "#1e2d5a",  // deep blue
    "#2d2455",  // dark indigo
    "#1a3a3a",  // deep teal
    "#3a2040",  // dark plum
  ],
  // MID layer: slate, medium tones
  mid: [
    "#3a4a6b",  // slate blue
    "#4a5a7b",  // medium slate
    "#6b7d8e",  // neutral blue-grey
    "#5a6a5a",  // sage grey
    "#7a6a5a",  // warm grey
    "#8fb4c9",  // light sky blue
  ],
  // NEAR layer: lightest, crispest — plus warm accents
  near: [
    "#a8bfc8",  // pale blue-grey
    "#c4a35a",  // amber accent
    "#d4b96a",  // soft gold
    "#dcd4c0",  // warm off-white
    "#e8e4dc",  // ice white
    "#8a9ab0",  // steel blue
  ],
  // Beat accent colors — shared across all layers
  beat: [
    "#c4a35a",  // amber
    "#d4b96a",  // soft gold
    "#e8e4dc",  // ice white
    "#1e2d5a",  // deep blue flash
    "#8fb4c9",  // sky blue
  ],
};

// Background — warm off-white
var BG_COLOR = [240, 237, 230];

// ─── Flow Field Names ────────────────────────────────────────────────────────────
// Cycle through these based on spectral centroid (brightness of sound)
var FLOW_FIELDS = ["waves", "curved", "truncated", "zigzag", "seabed"];
var currentFieldIndex = 0;
var fieldSwitchCooldown = 0;

// ─── State ───────────────────────────────────────────────────────────────────────
var audioEngine;
var brushScale = 1;
var brushReady = false;
var frameT = 0;

// Hue drift accumulator (slow spectral wander)
var hueDrift = 0;

// Beat tracking
var beatCount = 0;
var prevBeatFlash = 0;

// Deep layer: pool positions (persistent across frames for organic growth)
var deepPools = [];
var MAX_DEEP_POOLS = 12;

// Mid layer: spline seed points that drift through the flow field
var midTrails = [];
var NUM_MID_TRAILS = 8;

// Near layer: sharp stroke emitters
var nearEmitters = [];
var NUM_NEAR_EMITTERS = 6;

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

// ─── Color Helpers ──────────────────────────────────────────────────────────────

// Pick from a layer's sub-palette, with optional centroid-based warmth shift
function getLayerColor(layer, centroid) {
  var colors = PALETTE[layer];
  var picked = colors[Math.floor(random(colors.length))];

  // High centroid (bright sound) → shift toward amber/warm
  // Only occasionally — centroid > 0.5 has ~30% chance of warm override
  if (centroid > 0.5 && random(1) < 0.3) {
    picked = random(["#c4a35a", "#d4b96a", "#7a6a5a"]);
  }

  return picked;
}

function getBeatColor() {
  return random(PALETTE.beat);
}

// ─── Deep Pool (watercolor blob anchor point) ────────────────────────────────────
function DeepPool() {
  this.x = 0;
  this.y = 0;
  this.size = 0;
  this.color = "#1a2744";
  this.age = 0;
  this.maxAge = 0;
  this.active = false;
}

DeepPool.prototype.spawn = function(canvasW, canvasH, color) {
  var hw = canvasW / 2, hh = canvasH / 2;
  this.x = random(-hw * 0.8, hw * 0.8);
  this.y = random(-hh * 0.8, hh * 0.8);
  this.size = random(60, 180);
  this.color = color;
  this.age = 0;
  this.maxAge = Math.floor(random(40, 120));
  this.active = true;
};

// ─── Mid Trail (spline path seed) ────────────────────────────────────────────────
function MidTrail() {
  this.points = [];       // accumulated control points for spline
  this.x = 0;
  this.y = 0;
  this.angle = 0;
  this.nOff = 0;          // noise offset
  this.color = "#3a4a6b";
  this.brushName = "HB";
  this.weight = 1;
  this.stepsAlive = 0;
  this.maxSteps = 200;
  this.active = false;
}

MidTrail.prototype.spawn = function(canvasW, canvasH) {
  var hw = canvasW / 2, hh = canvasH / 2;
  this.x = random(-hw * 0.85, hw * 0.85);
  this.y = random(-hh * 0.85, hh * 0.85);
  this.nOff = random(1000);
  this.points = [[this.x, this.y]];
  this.stepsAlive = 0;
  this.maxSteps = Math.floor(random(80, 300));
  this.active = true;
  this.brushName = random(["calligraphy", "HB", "2B", "cpencil", "pen", "ink_wash"]);
  this.weight = random(0.8, 2.5);
};

MidTrail.prototype.update = function(features, canvasW, canvasH) {
  if (!this.active) return;

  var mid = features.mid;
  var ns = 0.003 * (1 + mid * 3);

  // Noise-driven angle with flow field influence
  this.angle = noise(this.x * ns + this.nOff, this.y * ns + this.nOff, frameT * 0.12) * 720;

  var stepLen = 3 + mid * 40;
  if (features.spectralFlux > 0.5) stepLen += features.spectralFlux * 15;

  this.x += Math.cos(this.angle * Math.PI / 180) * stepLen;
  this.y += Math.sin(this.angle * Math.PI / 180) * stepLen;
  this.stepsAlive++;

  // Accumulate spline points (max 20 for performance)
  if (this.stepsAlive % 3 === 0 && this.points.length < 20) {
    this.points.push([this.x, this.y]);
  }

  // Respawn check
  var hw = canvasW / 2, hh = canvasH / 2;
  if (this.x < -hw - 30 || this.x > hw + 30 ||
      this.y < -hh - 30 || this.y > hh + 30 ||
      this.stepsAlive > this.maxSteps ||
      random(1) < 0.002) {
    this.spawn(canvasW, canvasH);
  }
};

// ─── Near Emitter (sharp stroke source) ──────────────────────────────────────────
function NearEmitter() {
  this.x = 0;
  this.y = 0;
  this.nOff = 0;
  this.active = false;
  this.stepsAlive = 0;
  this.maxSteps = 150;
}

NearEmitter.prototype.spawn = function(canvasW, canvasH) {
  var hw = canvasW / 2, hh = canvasH / 2;
  this.x = random(-hw * 0.8, hw * 0.8);
  this.y = random(-hh * 0.8, hh * 0.8);
  this.nOff = random(1000);
  this.stepsAlive = 0;
  this.maxSteps = Math.floor(random(80, 250));
  this.active = true;
};

NearEmitter.prototype.update = function(features, canvasW, canvasH) {
  if (!this.active) return;

  var high = features.high;
  var ns = 0.005 * (1 + high * 2);
  var angle = noise(this.x * ns + this.nOff + 500, this.y * ns + this.nOff + 500, frameT * 0.2) * 720;
  var stepLen = 1.5 + high * 20;

  this.x += Math.cos(angle * Math.PI / 180) * stepLen;
  this.y += Math.sin(angle * Math.PI / 180) * stepLen;
  this.stepsAlive++;

  var hw = canvasW / 2, hh = canvasH / 2;
  if (this.x < -hw - 20 || this.x > hw + 20 ||
      this.y < -hh - 20 || this.y > hh + 20 ||
      this.stepsAlive > this.maxSteps) {
    this.spawn(canvasW, canvasH);
  }
};

// ─── Synthetic features for generative mode ──────────────────────────────────────
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

// ─── Custom Brush Definitions ────────────────────────────────────────────────────
function registerCustomBrushes() {
  // Calligraphy — varied pressure, rectangular tip
  brush.add("calligraphy", {
    type: "custom", weight: 3.5, vibration: 0.15,
    opacity: 55, spacing: 0.3, blend: true,
    pressure: {
      type: "custom", min_max: [0.5, 1.4],
      curve: function(x) { return 0.5 + 0.5 * Math.sin(x * Math.PI); }
    },
    tip: function(_m) { _m.rect(-4, -0.5, 8, 1); },
    rotate: "natural"
  });

  // Ink wash — wide, soft, low opacity (for mid-layer flowing strokes)
  brush.add("ink_wash", {
    type: "custom", weight: 10, vibration: 2.5,
    opacity: 20, spacing: 0.35, blend: true,
    pressure: { type: "standard", curve: [0.1, 0.2], min_max: [0.8, 1.2] },
    tip: function(_m) {
      _m.ellipse(0, 0, 7, 3);
      _m.ellipse(1.5, 0.8, 4, 2);
    },
    rotate: "natural"
  });

  // Splatter — spray dots
  brush.add("splatter", {
    type: "spray", weight: 0.9, vibration: 25,
    quality: 55, opacity: 100, spacing: 0.9,
    blend: false,
    pressure: { type: "standard", curve: [0.15, 0.25], min_max: [0.4, 1.6] }
  });

  // Needle — extremely fine, high contrast (foreground detail)
  brush.add("needle", {
    type: "default", weight: 0.12, vibration: 0.08,
    definition: 0.95, quality: 2, opacity: 220,
    spacing: 0.08, blend: false,
    pressure: { type: "standard", curve: [0.05, 0.1], min_max: [0.9, 1.05] }
  });

  // Thick oil — heavy, opaque (background weight)
  brush.add("thick_oil", {
    type: "marker", weight: 4.5, vibration: 0.25,
    opacity: 50, spacing: 0.3, blend: true,
    pressure: { type: "standard", curve: [0.25, 0.2], min_max: [0.9, 1.5] }
  });

  // Dry brush — textured, wispy strokes for mid layer
  brush.add("dry_brush", {
    type: "custom", weight: 6, vibration: 1.5,
    opacity: 30, spacing: 0.45, blend: true,
    pressure: { type: "standard", curve: [0.15, 0.3], min_max: [0.6, 1.3] },
    tip: function(_m) {
      _m.ellipse(0, 0, 5, 2);
      _m.ellipse(-2, 1, 3, 1);
      _m.ellipse(2.5, -0.5, 2, 1.5);
    },
    rotate: "natural"
  });

  console.log("Depths brushes registered:", brush.box());
}

// ─── LAYER 1: DEEP — Watercolor Fills (bass) ────────────────────────────────────

function drawDeepLayer(features) {
  var bass = features.bass;

  // Spawn pools continuously — no hard threshold.
  // Frequency: every 10 frames when any bass is present, every 18 when silent
  var spawnInterval = bass > 0.01 ? 10 : 18;
  if (frameCount % spawnInterval === 0) {
    // Find an inactive pool slot or the oldest one
    var slot = -1;
    for (var i = 0; i < deepPools.length; i++) {
      if (!deepPools[i].active) { slot = i; break; }
    }
    if (slot === -1) {
      // Recycle oldest
      var oldest = 0, maxAge = 0;
      for (var i = 0; i < deepPools.length; i++) {
        if (deepPools[i].age > maxAge) { maxAge = deepPools[i].age; oldest = i; }
      }
      slot = oldest;
    }

    var poolColor = getLayerColor("deep", features.centroid);
    deepPools[slot].spawn(width, height, poolColor);
    // Size scales with bass but always has a minimum
    deepPools[slot].size = 50 + bass * 250;
  }

  // Draw active pools with watercolor fill
  for (var i = 0; i < deepPools.length; i++) {
    var pool = deepPools[i];
    if (!pool.active) continue;

    pool.age++;

    // Only redraw pool during its first few frames (the initial bleed)
    // After that, the watercolor stain persists on canvas via the slow fade
    if (pool.age > 8) {
      if (pool.age > pool.maxAge) pool.active = false;
      continue;
    }

    // Bleed amount: more bass = more bleeding (smoky edges)
    var bleedAmt = 0.04 + bass * 0.3;
    // Opacity fades slightly as pool ages
    var fillOpacity = Math.max(25, 70 - pool.age * 5);

    // Set fill with watercolor bleed
    brush.fill(pool.color, fillOpacity);
    brush.bleed(bleedAmt);
    brush.fillTexture(0.25 + bass * 0.4, 0.3);

    // Slightly grow pool over its brief drawing life
    var drift = 1 + pool.age * 0.04;
    var sz = pool.size * drift;

    // Draw the watercolor blob — alternate shapes
    if (random(1) > 0.5) {
      brush.rect(pool.x - sz / 2, pool.y - sz / 2, sz, sz);
    } else {
      brush.circle(pool.x, pool.y, sz / 2);
    }

    brush.noFill();
  }

  // On beat hits, drop an extra large splash
  if (features.beatFlash > 0.5) {
    var hw = width / 2, hh = height / 2;
    var sx = random(-hw * 0.6, hw * 0.6);
    var sy = random(-hh * 0.6, hh * 0.6);
    var strength = features.beatStrength || 0.5;
    var splashSize = 80 + strength * 200;

    brush.fill(getLayerColor("deep", features.centroid), random(35, 65));
    brush.bleed(0.12 + strength * 0.3);
    brush.fillTexture(0.4, 0.4);
    brush.circle(sx, sy, splashSize / 2);
    brush.noFill();
  }
}

// ─── LAYER 2: MID — Flowing Splines (mid frequencies) ────────────────────────────

function drawMidLayer(features) {
  var mid = features.mid;

  // Update mid trails
  for (var i = 0; i < midTrails.length; i++) {
    midTrails[i].update(features, width, height);
  }

  // Draw splines from accumulated trail points
  for (var i = 0; i < midTrails.length; i++) {
    var trail = midTrails[i];
    if (!trail.active) continue;

    // Need at least 4 points for a smooth spline
    if (trail.points.length >= 4) {
      // Color from mid palette, influenced by centroid warmth
      trail.color = getLayerColor("mid", features.centroid);

      brush.pick(trail.brushName);
      brush.stroke(trail.color);
      brush.strokeWeight(trail.weight * (0.8 + mid * 1.0));

      // Draw spline through accumulated points
      brush.spline(trail.points, random(0.3, 0.8));
    }

    // Also draw short flow lines from current position
    // Always draw — scale length/weight with mid energy
    if (frameCount % 2 === 0) {
      var flowBrush = random(["calligraphy", "dry_brush", "ink_wash", "2B"]);
      brush.pick(flowBrush);
      brush.stroke(getLayerColor("mid", features.centroid));
      brush.strokeWeight(random(0.4, 1.8) * (0.3 + mid * 1.5));

      var flowLen = 15 + mid * 100;
      var flowAngle = noise(trail.x * 0.004, trail.y * 0.004, frameT * 0.1) * 360;
      brush.flowLine(trail.x, trail.y, flowLen, flowAngle);
    }
  }

  // Beat → extra spline burst from waveform data
  if (features.beatFlash > 0.5 && audioEngine && audioEngine.timeData) {
    drawWaveformSpline(features);
  }
}

// Waveform as a smooth spline (upgrade from wanderer's line-segment approach)
function drawWaveformSpline(features) {
  var strength = features.beatStrength || 0.5;
  var nSamples = 16;
  var step = Math.floor(audioEngine.timeData.length / nSamples);

  // Position near a mid-trail for organic placement
  var anchor = midTrails[Math.floor(random(midTrails.length))];
  var cx = anchor && anchor.active ? anchor.x : random(-width * 0.3, width * 0.3);
  var cy = anchor && anchor.active ? anchor.y : random(-height * 0.3, height * 0.3);

  var spread = 60 + strength * 250;
  var pts = [];

  for (var i = 0; i < nSamples; i++) {
    var sample = audioEngine.timeData[i * step] || 0;
    var px = cx - spread / 2 + (i / (nSamples - 1)) * spread;
    var py = cy + sample * (30 + strength * 100);
    pts.push([px, py]);
  }

  if (pts.length >= 4) {
    brush.pick(random(["calligraphy", "2B", "HB"]));
    brush.stroke(getBeatColor());
    brush.strokeWeight(0.6 + strength * 2.0);
    brush.spline(pts, 0.6 + strength * 0.3);
  }
}

// ─── LAYER 3: NEAR — Sharp Strokes + Hatch (high frequencies) ────────────────────

function drawNearLayer(features) {
  var high = features.high;

  // Always update emitters (they drift through noise field)
  for (var i = 0; i < nearEmitters.length; i++) {
    nearEmitters[i].update(features, width, height);
  }

  // Draw sharp strokes — always at least 1, more with high energy
  var strokeCount = Math.max(1, Math.floor(1 + high * 8));
  for (var s = 0; s < strokeCount; s++) {
    var emitter = nearEmitters[Math.floor(random(nearEmitters.length))];
    if (!emitter.active) continue;

    var sharpBrush = random(["needle", "rotring", "pen", "HB", "2H"]);
    brush.pick(sharpBrush);
    brush.stroke(getLayerColor("near", features.centroid));
    brush.strokeWeight(random(0.15, 1.0) * (0.5 + high * 2));

    // Short, crisp lines radiating from emitter
    var angle = random(360);
    var len = 4 + high * 40;
    var x1 = emitter.x + random(-10, 10);
    var y1 = emitter.y + random(-10, 10);
    var x2 = x1 + Math.cos(angle * Math.PI / 180) * len;
    var y2 = y1 + Math.sin(angle * Math.PI / 180) * len;
    brush.line(x1, y1, x2, y2, 0.3 + high * 2);
  }

  // Hatch patterns on beats — crosshatch texture burst
  if (features.beatFlash > 0.6) {
    drawHatchBurst(features);
  }

  // Splatter dots — occasional even at low energy, frequent at high
  if (frameCount % 3 === 0) {
    var dotCount = Math.max(1, Math.floor(high * 6));
    for (var d = 0; d < dotCount; d++) {
      var em = nearEmitters[Math.floor(random(nearEmitters.length))];
      if (!em.active) continue;

      brush.pick("splatter");
      brush.stroke(getLayerColor("near", features.centroid));
      brush.strokeWeight(0.2 + high * 1.0);

      var dx = em.x + random(-50, 50);
      var dy = em.y + random(-50, 50);
      brush.line(dx, dy, dx + random(-3, 3), dy + random(-3, 3), 0.4 + high);
    }
  }
}

// Crosshatch burst — fine hatching that appears on strong treble beats
function drawHatchBurst(features) {
  var strength = features.beatStrength || 0.5;
  var em = nearEmitters[Math.floor(random(nearEmitters.length))];
  if (!em || !em.active) return;

  var hatchSize = 20 + strength * 50;
  var hatchAngle = random(360);
  var hatchSpacing = 4 + (1 - strength) * 6;  // tighter spacing on strong beats

  brush.fill(getLayerColor("near", features.centroid), 15 + strength * 20);
  brush.bleed(0.01 + strength * 0.04);  // very slight bleed
  brush.hatch(hatchSpacing, hatchAngle, { rand: 0.3, continuous: false });
  brush.rect(em.x - hatchSize / 2, em.y - hatchSize / 2, hatchSize, hatchSize);
  brush.noFill();
}

// ─── Flow Field Management ──────────────────────────────────────────────────────

function updateFlowField(features) {
  // Animate the field slowly — creates organic evolution
  brush.refreshField(frameT * 0.3);

  // Switch field type based on centroid (spectral brightness)
  // High centroid = bright/sharp sound → complex fields (zigzag, truncated)
  // Low centroid = dark/warm sound → smooth fields (waves, curved)
  fieldSwitchCooldown--;
  if (fieldSwitchCooldown <= 0 && features.beatFlash > 0.8) {
    var centroid = features.centroid || 0.3;
    var newIndex;

    if (centroid > 0.6) {
      newIndex = random([2, 3, 4]);  // truncated, zigzag, seabed
    } else if (centroid > 0.3) {
      newIndex = random([0, 1, 4]);  // waves, curved, seabed
    } else {
      newIndex = random([0, 1]);     // waves, curved (smoothest)
    }

    if (newIndex !== currentFieldIndex) {
      currentFieldIndex = newIndex;
      brush.field(FLOW_FIELDS[currentFieldIndex]);
      fieldSwitchCooldown = 90;  // ~3 seconds between switches
    }
  }
}

// ─── Erase: Subtractive moment on very strong beats ─────────────────────────────

function drawEraseFlash(features) {
  // Only on strong beats
  if ((features.beatStrength || 0) < 0.5) return;

  var hw = width / 2, hh = height / 2;

  // Small erased circle — reveals the background through accumulated layers
  var ex = random(-hw * 0.5, hw * 0.5);
  var ey = random(-hh * 0.5, hh * 0.5);
  var eSize = 15 + features.beatStrength * 40;

  brush.erase();
  brush.circle(ex, ey, eSize);
  brush.noErase();
}

// ─── p5 Setup ────────────────────────────────────────────────────────────────────
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
    console.log("p5.brush loaded — Audio Brush Depths");
  } catch (e) {
    console.error("p5.brush load failed:", e.message);
    brushReady = false;
  }

  // Initialize audio engine
  audioEngine = new AudioEngine();
  audioEngine.init('GlassHorizon.mp3');

  // Wire up UI
  document.getElementById('playBtn').addEventListener('click', function() {
    audioEngine.play();
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

  // Initialize deep pools
  for (var i = 0; i < MAX_DEEP_POOLS; i++) {
    deepPools.push(new DeepPool());
  }

  // Initialize mid trails
  for (var i = 0; i < NUM_MID_TRAILS; i++) {
    var trail = new MidTrail();
    trail.spawn(w, h);
    trail.color = getLayerColor("mid", 0.3);
    midTrails.push(trail);
  }

  // Initialize near emitters
  for (var i = 0; i < NUM_NEAR_EMITTERS; i++) {
    var em = new NearEmitter();
    em.spawn(w, h);
    nearEmitters.push(em);
  }

  // Draw initial background
  var bgHex = '#' +
    ('0' + BG_COLOR[0].toString(16)).slice(-2) +
    ('0' + BG_COLOR[1].toString(16)).slice(-2) +
    ('0' + BG_COLOR[2].toString(16)).slice(-2);
  background(bgHex);
}

// ─── p5 Draw ─────────────────────────────────────────────────────────────────────
function draw() {
  if (!brushReady) return;

  frameT = frameCount * 0.02;

  // Get audio features
  var features;
  if (audioEngine && audioEngine.isPlaying) {
    features = audioEngine.analyze();
  } else {
    features = generateSyntheticFeatures(frameT);
  }

  // ─── Beat edge detection ─────────────────────────────────────────
  var beatEdge = (features.beatFlash > 0.7 && prevBeatFlash <= 0.7);
  prevBeatFlash = features.beatFlash;
  if (beatEdge) beatCount++;

  // ─── Hue drift from centroid (slow spectral wander) ──────────────
  hueDrift += (features.centroid || 0.3) * 0.3;

  // ─── Flow field management ───────────────────────────────────────
  updateFlowField(features);

  // ─── Background fade ────────────────────────────────────────────
  // Slow enough for watercolor stains to persist, fast enough to breathe
  var baseFade = 2.2;
  var bpmFactor = constrain((features.bpm || 120) / 120, 0.8, 1.2);
  var fadeAlpha = baseFade * bpmFactor;

  // Quiet → faster fade (canvas breathes open), loud → slower (layers accumulate)
  if (features.rms < 0.03) fadeAlpha += 2.0;
  else if (features.rms > 0.25) fadeAlpha = Math.max(1.0, fadeAlpha - 0.6);

  fill(BG_COLOR[0], BG_COLOR[1], BG_COLOR[2], fadeAlpha);
  noStroke();
  rect(-width / 2, -height / 2, width, height);

  // ─── Draw layers in depth order ─────────────────────────────────

  // LAYER 1: DEEP — watercolor fills (bass) — farthest back
  drawDeepLayer(features);

  // LAYER 2: MID — flowing splines (mid) — middle ground
  drawMidLayer(features);

  // LAYER 3: NEAR — sharp strokes + hatch (high) — foreground
  drawNearLayer(features);

  // ─── Beat effects (cross-layer) ─────────────────────────────────
  if (beatEdge) {
    // Erase flash on very strong beats (subtractive moment)
    drawEraseFlash(features);
  }
}

// ─── Regenerate: clear canvas + respawn everything ───────────────────────────────
function regenerate() {
  var bgHex = '#' +
    ('0' + BG_COLOR[0].toString(16)).slice(-2) +
    ('0' + BG_COLOR[1].toString(16)).slice(-2) +
    ('0' + BG_COLOR[2].toString(16)).slice(-2);
  background(bgHex);

  // Reset noise seed
  noiseSeed(Math.floor(random(100000)));

  // Reset deep pools
  for (var i = 0; i < deepPools.length; i++) {
    deepPools[i].active = false;
  }

  // Respawn mid trails
  for (var i = 0; i < midTrails.length; i++) {
    midTrails[i].spawn(width, height);
    midTrails[i].color = getLayerColor("mid", 0.3);
  }

  // Respawn near emitters
  for (var i = 0; i < nearEmitters.length; i++) {
    nearEmitters[i].spawn(width, height);
  }

  // Reset flow field
  currentFieldIndex = 0;
  brush.field("waves");
  fieldSwitchCooldown = 0;
  hueDrift = 0;

  console.log("Regenerated — fresh depth canvas");
}

// ─── Keyboard handler ────────────────────────────────────────────────────────────
function keyPressed() {
  if (key === 'r' || key === 'R') {
    regenerate();
  }
}
