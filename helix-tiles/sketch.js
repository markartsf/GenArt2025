// =============================================================
// HELIX TILES — p5.js WEBGL + Web Audio API
// 50 textured geometric tiles on a 3D helix. Fixed 1920×1080.
//
// Audio → Visual mappings:
//   BASS pluck onset  → ripple wave of brightness travels along helix
//   BASS (smooth)     → helix radius breathes outward, bg darkens
//   VIOLIN mid        → tile brightness + rotation speed
//   HIGH frequencies  → warm blue tint shift across tiles
// =============================================================

'use strict';

const CANVAS_W  = 1920;
const CANVAS_H  = 1080;

const NUM_TILES   = 90;
const TILE_W      = 82;
const TILE_H      = 82;
const HELIX_TURNS = 3.5;
const BASE_RADIUS = 210;

// ─── 14 Color Schemes ────────────────────────────────────────────
const SCHEMES = [
  { name: 'Original', bg: '#050505', colors: ['#484064','#786b88','#dfaf66','#c16359','#719ca9'] },
  { name: 'Ember',    bg: '#0f0500', colors: ['#ff4500','#ff7030','#ffd060','#c44000','#8b2000'] },
  { name: 'Winter',   bg: '#010710', colors: ['#003680','#0095b0','#52b8cc','#a8d8e8','#e0f4fa'] },
  { name: 'Forest',   bg: '#080f04', colors: ['#1a472a','#2d6a4f','#52b788','#95d5b2','#d8f3dc'] },
  { name: 'Abyss',    bg: '#04000a', colors: ['#4000a0','#8000c0','#b040e0','#d080ff','#f0d0ff'] },
  { name: 'Dusk',     bg: '#0a040e', colors: ['#6b2fa0','#c77dff','#e0aaff','#ff6b9d','#ffb347'] },
  { name: 'Noir',     bg: '#030303', colors: ['#181818','#404040','#808080','#c0c0c0','#f0f0f0'] },
  { name: 'Coral',    bg: '#0f0500', colors: ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b'] },
  { name: 'Arctic',   bg: '#000810', colors: ['#00b4d8','#0077b6','#90e0ef','#caf0f8','#03045e'] },
  { name: 'Sunset',   bg: '#09030c', colors: ['#ff9a3c','#ff5858','#b721ff','#21d4fd','#f7ff00'] },
  { name: 'Jade',     bg: '#020a06', colors: ['#006466','#0b525b','#1b7a8e','#52b8cc','#a8e6cf'] },
  { name: 'Rose',     bg: '#0c0303', colors: ['#ff0a54','#ff477e','#ff85a1','#fbb1bd','#fff0f3'] },
  { name: 'Gold',     bg: '#080600', colors: ['#b8860b','#daa520','#ffd700','#ffe066','#fff8dc'] },
  { name: 'Toxic',    bg: '#050d00', colors: ['#39ff14','#00ff41','#adff2f','#7fff00','#caffbf'] },
];

let schemeIdx = 0;

// ─── Audio ────────────────────────────────────────────────────────
let audioCtx     = null;
let analyserNode = null;
let freqData     = null;
let audioReady   = false;
const FFT_SIZE   = 2048;
let BIN_HZ       = 48000 / FFT_SIZE;

let bassSmooth = 0, midSmooth = 0, highSmooth = 0;

function bandEnergy(data, loHz, hiHz) {
  const lo = Math.max(1, Math.floor(loHz / BIN_HZ));
  const hi = Math.min(data.length - 1, Math.ceil(hiHz / BIN_HZ));
  let s = 0;
  for (let i = lo; i <= hi; i++) s += data[i];
  return s / ((hi - lo + 1) * 255);
}

function makeFollower(up, dn) {
  let v = 0;
  return { feed: x => { const c = x > v ? up : dn; v += (x - v) * (1 - c); return v; } };
}

// Auto-normalizer: tracks decaying peak so compressed audio fills 0–1
function makeAutoNorm(decay) {
  let peak = 0.01;
  return {
    feed(v) {
      if (v > peak) peak = v;
      peak *= decay;
      return Math.min(1, v / peak);
    }
  };
}

const bassF    = makeFollower(0.4,  0.88);
const midF     = makeFollower(0.15, 0.97);
const highF    = makeFollower(0.20, 0.96);
const bassNorm = makeAutoNorm(0.9992);
const midNorm  = makeAutoNorm(0.9992);
const highNorm = makeAutoNorm(0.9992);

function makeOnset(winSize, thresh) {
  const buf = new Float32Array(winSize).fill(0.05);
  let pos = 0, cool = 0;
  return {
    feed(e) {
      const avg = buf.reduce((a, b) => a + b) / buf.length;
      const hit = cool <= 0 && e > avg * thresh && e > 0.04;
      buf[pos++ % buf.length] = e;
      if (cool > 0) cool--;
      if (hit) cool = 10;
      return hit;
    }
  };
}

const bassOnset  = makeOnset(16, 1.6);
const pluckOnset = makeOnset(8,  1.75);  // faster onset window for pluck/violin mid

// ─── Ripple system ────────────────────────────────────────────────
// Each ripple travels along the tile index axis, lighting up tiles it passes
const ripples = [];

function spawnRipple() {
  // Occasionally start from the far end for visual variety
  const fromEnd = Math.random() < 0.3;
  ripples.push({
    pos:      fromEnd ? NUM_TILES : 0,
    speed:    fromEnd ? -2.8 : 2.8,
    strength: 1.0 + Math.random() * 0.5,
  });
}

function updateRipples() {
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i].pos      += ripples[i].speed;
    ripples[i].strength *= 0.97;
    const gone = ripples[i].pos > NUM_TILES + 12
              || ripples[i].pos < -12
              || ripples[i].strength < 0.02;
    if (gone) ripples.splice(i, 1);
  }
}

// Returns 0–1 flash intensity for tile at index i
function rippleAt(i) {
  let v = 0;
  for (const r of ripples) {
    const dist = Math.abs(i - r.pos);
    if (dist < 7) v = Math.max(v, r.strength * (1 - dist / 7));
  }
  return v;
}

// ─── Shape drawing (19 types) ─────────────────────────────────────
function drawShape(pg, shapeType, cols, sz) {
  const h = sz / 2;
  const c = (i) => cols[i % cols.length];

  pg.push();

  switch (shapeType % 19) {
    case 0: // solid circle + inner disc
      pg.noStroke(); pg.fill(c(0));
      pg.ellipse(h, h, sz * 0.72, sz * 0.72);
      pg.fill(c(2) + '60');
      pg.ellipse(h, h, sz * 0.38, sz * 0.38);
      break;

    case 1: // double ring
      pg.noFill();
      pg.stroke(c(0)); pg.strokeWeight(2.5);
      pg.ellipse(h, h, sz * 0.72, sz * 0.72);
      pg.stroke(c(1)); pg.strokeWeight(1.5);
      pg.ellipse(h, h, sz * 0.44, sz * 0.44);
      pg.noStroke(); pg.fill(c(2) + '55');
      pg.ellipse(h, h, sz * 0.28, sz * 0.28);
      break;

    case 2: // filled triangle
      pg.noStroke(); pg.fill(c(0));
      pg.triangle(h, sz * 0.08, sz * 0.08, sz * 0.92, sz * 0.92, sz * 0.92);
      pg.fill(c(1) + '80');
      pg.triangle(h, sz * 0.32, sz * 0.25, sz * 0.75, sz * 0.75, sz * 0.75);
      break;

    case 3: // layered squares
      pg.noStroke(); pg.fill(c(1));
      pg.rectMode(CENTER);
      pg.rect(h, h, sz * 0.64, sz * 0.64);
      pg.fill(c(0) + '70');
      pg.rect(h, h, sz * 0.36, sz * 0.36);
      pg.fill(c(2));
      pg.rect(h, h, sz * 0.14, sz * 0.14);
      break;

    case 4: // diamond
      pg.noStroke(); pg.fill(c(0));
      pg.beginShape();
      pg.vertex(h, sz * 0.06); pg.vertex(sz * 0.94, h);
      pg.vertex(h, sz * 0.94); pg.vertex(sz * 0.06, h);
      pg.endShape(CLOSE);
      pg.fill(c(1) + '60');
      pg.beginShape();
      pg.vertex(h, sz * 0.3);  pg.vertex(sz * 0.7, h);
      pg.vertex(h, sz * 0.7);  pg.vertex(sz * 0.3, h);
      pg.endShape(CLOSE);
      break;

    case 5: // cross / plus
      pg.noStroke(); pg.fill(c(0));
      pg.rectMode(CENTER);
      pg.rect(h, h, sz * 0.7, sz * 0.22);
      pg.rect(h, h, sz * 0.22, sz * 0.7);
      break;

    case 6: // X shape
      pg.noFill();
      pg.stroke(c(1)); pg.strokeWeight(4);
      pg.line(sz * 0.1, sz * 0.1, sz * 0.9, sz * 0.9);
      pg.line(sz * 0.9, sz * 0.1, sz * 0.1, sz * 0.9);
      pg.stroke(c(0) + '80'); pg.strokeWeight(2);
      pg.line(sz * 0.22, sz * 0.22, sz * 0.78, sz * 0.78);
      pg.line(sz * 0.78, sz * 0.22, sz * 0.22, sz * 0.78);
      break;

    case 7: { // 4-pointed star
      pg.noStroke(); pg.fill(c(0));
      pg.beginShape();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI / 4) - Math.PI / 2;
        const r = i % 2 === 0 ? sz * 0.42 : sz * 0.14;
        pg.vertex(h + Math.cos(a) * r, h + Math.sin(a) * r);
      }
      pg.endShape(CLOSE);
      break;
    }

    case 8: { // 6-pointed star
      pg.noStroke(); pg.fill(c(1));
      pg.beginShape();
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI / 6) - Math.PI / 2;
        const r = i % 2 === 0 ? sz * 0.42 : sz * 0.2;
        pg.vertex(h + Math.cos(a) * r, h + Math.sin(a) * r);
      }
      pg.endShape(CLOSE);
      break;
    }

    case 9: // concentric circles
      pg.noFill();
      for (let r = sz * 0.44; r > 4; r -= sz * 0.1) {
        const ci = Math.round(r / (sz * 0.1)) % cols.length;
        pg.stroke(cols[ci]); pg.strokeWeight(1.8);
        pg.ellipse(h, h, r * 2, r * 2);
      }
      break;

    case 10: // arc pair
      pg.noFill();
      pg.stroke(c(0)); pg.strokeWeight(3.5);
      pg.arc(h, h, sz * 0.74, sz * 0.74, 0, Math.PI * 1.4);
      pg.stroke(c(1)); pg.strokeWeight(2);
      pg.arc(h, h, sz * 0.46, sz * 0.46, Math.PI * 0.5, Math.PI * 2.1);
      pg.stroke(c(2) + '90'); pg.strokeWeight(1.5);
      pg.arc(h, h, sz * 0.26, sz * 0.26, Math.PI, Math.PI * 2.8);
      break;

    case 11: { // spiral
      pg.noFill(); pg.stroke(c(0)); pg.strokeWeight(1.8);
      pg.beginShape();
      for (let a = 0; a < Math.PI * 5; a += 0.09) {
        const r = a * sz * 0.075;
        if (r > sz * 0.46) break;
        pg.vertex(h + Math.cos(a) * r, h + Math.sin(a) * r);
      }
      pg.endShape();
      break;
    }

    case 12: // rotated nested squares
      pg.noFill();
      for (let i = 1; i <= 5; i++) {
        pg.stroke(c(i % cols.length)); pg.strokeWeight(1.5);
        pg.push();
        pg.translate(h, h);
        pg.rotate(i * 0.18);
        pg.rectMode(CENTER);
        pg.rect(0, 0, sz * 0.17 * i, sz * 0.17 * i);
        pg.pop();
      }
      break;

    case 13: // dot grid
      pg.noStroke();
      for (let gy = 1; gy <= 4; gy++) {
        for (let gx = 1; gx <= 4; gx++) {
          pg.fill(c((gx + gy) % cols.length));
          const dotSize = sz * (0.06 + ((gx * gy) % 3) * 0.03);
          pg.ellipse(gx * sz / 5, gy * sz / 5, dotSize, dotSize);
        }
      }
      break;

    case 14: // horizontal lines
      for (let ly = sz * 0.1; ly < sz * 0.94; ly += sz * 0.135) {
        const ci = Math.floor(ly / (sz * 0.135)) % cols.length;
        pg.stroke(cols[ci]);
        pg.strokeWeight(ly % (sz * 0.27) < sz * 0.135 ? 2.5 : 1.2);
        pg.line(sz * 0.06, ly, sz * 0.94, ly);
      }
      break;

    case 15: // wave form
      pg.noFill();
      pg.stroke(c(0)); pg.strokeWeight(2.5);
      pg.beginShape();
      for (let wx = 0; wx <= sz; wx += 2) {
        pg.vertex(wx, h + Math.sin((wx / sz) * Math.PI * 3.5) * sz * 0.3);
      }
      pg.endShape();
      pg.stroke(c(1)); pg.strokeWeight(1.5);
      pg.beginShape();
      for (let wx = 0; wx <= sz; wx += 2) {
        pg.vertex(wx, h + Math.sin((wx / sz) * Math.PI * 3.5 + Math.PI) * sz * 0.18);
      }
      pg.endShape();
      break;

    case 16: // scattered dots (deterministic)
      pg.noStroke();
      for (let d = 0; d < 22; d++) {
        pg.fill(c(d % cols.length));
        const dx = (Math.sin(d * 127.1 + 1.3) * 0.5 + 0.5) * sz * 0.86 + sz * 0.07;
        const dy = (Math.sin(d * 311.7 + 5.7) * 0.5 + 0.5) * sz * 0.86 + sz * 0.07;
        const dr = (Math.sin(d * 43.3  + 2.1) * 0.5 + 0.5) * sz * 0.1  + sz * 0.03;
        pg.ellipse(dx, dy, dr, dr);
      }
      break;

    case 17: // diagonal hatching
      pg.strokeWeight(1.5);
      for (let d = -sz; d < sz * 2; d += 8) {
        pg.stroke(c(0));
        pg.line(Math.max(0, d), Math.max(0, -d + sz), Math.min(sz, d + sz), Math.min(sz, sz - d));
      }
      pg.strokeWeight(1);
      for (let d = 0; d < sz * 2; d += 12) {
        pg.stroke(c(1));
        pg.line(Math.min(sz, d), 0, 0, Math.min(sz, d));
      }
      break;

    case 18: // glow ring
      pg.noStroke(); pg.fill(c(0) + '22');
      pg.ellipse(h, h, sz * 0.92, sz * 0.92);
      pg.fill(c(0) + '44');
      pg.ellipse(h, h, sz * 0.68, sz * 0.68);
      pg.stroke(c(1)); pg.strokeWeight(3); pg.noFill();
      pg.ellipse(h, h, sz * 0.72, sz * 0.72);
      pg.stroke(c(0)); pg.strokeWeight(2);
      pg.ellipse(h, h, sz * 0.46, sz * 0.46);
      pg.stroke(c(2)); pg.strokeWeight(1.5);
      pg.ellipse(h, h, sz * 0.24, sz * 0.24);
      pg.noStroke(); pg.fill(c(1));
      pg.ellipse(h, h, 6, 6);
      break;
  }

  pg.pop();
}

// ─── Tile state ───────────────────────────────────────────────────
let tiles   = [];
let tileGfx = [];
let globalRot  = 0;
let paused     = false;
let colorShift = 0;

// ─── Second helix (revealed by sustained bass) ────────────────────
let globalRot2  = Math.PI;   // starts 180° offset → double-helix DNA shape
let bassAccum   = 0;         // charges up while bass is sustained
let revealAlpha = 0;         // 0 = hidden, 1 = fully visible

// ─── Rotation speed burst (audio-driven) ─────────────────────────
let rotSpeedBurst = 0;       // spiked on each onset, decays back to 0

// ─── Mouse orbit control ──────────────────────────────────────────
let userRotX   = 0;          // accumulated pitch from vertical drag
let userRotY   = 0;          // accumulated yaw from horizontal drag
let lastMouseX = 0;
let lastMouseY = 0;

function makeTileGraphic(tileData) {
  const pg  = createGraphics(TILE_W, TILE_H);
  const sch = SCHEMES[tileData.schemeIdx];
  pg.pixelDensity(1);
  pg.background(sch.bg);
  pg.colorMode(RGB);
  drawShape(pg, tileData.shapeType, sch.colors, TILE_W);
  return pg;
}

function regenerateAllGraphics() {
  for (let i = 0; i < NUM_TILES; i++) {
    if (tileGfx[i]) tileGfx[i].remove();
    tileGfx[i] = makeTileGraphic(tiles[i]);
  }
}

// ─── Canvas fit helper ────────────────────────────────────────────
let _cnvEl = null;
function applyCanvasFit() {
  if (!_cnvEl) return;
  const s = Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H);
  _cnvEl.style.position        = 'fixed';
  _cnvEl.style.top             = '50%';
  _cnvEl.style.left            = '50%';
  _cnvEl.style.transformOrigin = 'center center';
  _cnvEl.style.transform       = `translate(-50%, -50%) scale(${s})`;
}

// ─── p5 setup ─────────────────────────────────────────────────────
function setup() {
  const cnv = createCanvas(CANVAS_W, CANVAS_H, WEBGL);
  _cnvEl = cnv.elt;          // raw DOM element — style it directly
  applyCanvasFit();
  frameRate(30);
  randomSeed(42);

  for (let i = 0; i < NUM_TILES; i++) {
    const t     = i / NUM_TILES;
    const angle = t * TWO_PI * HELIX_TURNS;
    // tan() gives organic radius variation along the helix
    const tanVal = Math.tan(angle * 0.045);
    const radius = constrain(BASE_RADIUS + 42 * tanVal, 90, 320);

    tiles.push({
      i,
      angle,
      radius,
      // Horizontal helix: tiles span the full canvas width left-to-right
      xPos:        map(t, 0, 1, -900, 900),
      shapeType:   floor(random(19)),
      schemeIdx:   floor(random(SCHEMES.length)),
      rotZ:        random(TWO_PI),
      rotZSpeed:   random(-0.0018, 0.0018),
      scale:       1.0,
      scaleTarget: 1.0,
      // Size variation: a mix of small, medium, and large tiles
      sizeMult:    random() < 0.2 ? random(1.4, 2.0) : random(0.55, 1.25),
      // Depth scatter: tiles float slightly in front of / behind the helix surface
      zOffset:     random(-55, 55),
    });
    tileGfx.push(null);
  }

  regenerateAllGraphics();
}

// ─── p5 draw ──────────────────────────────────────────────────────
function draw() {
  if (paused) return;

  // ── Audio ──
  if (audioReady && analyserNode) {
    analyserNode.getByteFrequencyData(freqData);
    const bassE = bandEnergy(freqData,  60,  350);
    const midE  = bandEnergy(freqData, 700, 5000);
    const highE = bandEnergy(freqData, 5000, 16000);

    // Normalize so compressed audio fills the full 0–1 range
    bassSmooth = bassNorm.feed(bassF.feed(bassE));
    midSmooth  = midNorm.feed(midF.feed(midE));
    highSmooth = highNorm.feed(highF.feed(highE));

    if (bassOnset.feed(bassE)) {
      spawnRipple();
      for (const t of tiles) t.scaleTarget = 1.55 + random(0.25);
      rotSpeedBurst += 0.022;   // big kick on bass hit
    }
    // Pluck synth lives in mid range — detect onsets there too
    if (pluckOnset.feed(midE)) {
      spawnRipple();
      for (const t of tiles) t.scaleTarget = 1.35 + random(0.20);
      rotSpeedBurst += 0.012;   // smaller kick on pluck
    }

    colorShift = highSmooth;

    // Sustained-bass detector: charges when bass is consistently above threshold,
    // drains slowly so the second helix lingers for a few seconds after bass fades
    const bassSustained = bassSmooth > 0.28;
    bassAccum = lerp(bassAccum, bassSustained ? 1.0 : 0.0, bassSustained ? 0.022 : 0.005);
    // Reveal alpha fades in/out smoothly once accumulator crosses threshold
    revealAlpha = lerp(revealAlpha, bassAccum > 0.50 ? 1.0 : 0.0, 0.016);

    document.getElementById('bass-meter').style.width = (bassSmooth * 100).toFixed(1) + '%';
    document.getElementById('mid-meter').style.width  = (midSmooth  * 100).toFixed(1) + '%';
    document.getElementById('high-meter').style.width = (highSmooth * 100).toFixed(1) + '%';
    document.getElementById('state-label').textContent = 'playing';
  }

  // Advance ripples
  updateRipples();

  // Decay tile scales
  for (const t of tiles) {
    t.scaleTarget = lerp(t.scaleTarget, 1.0, 0.10);
    t.scale       = lerp(t.scale, t.scaleTarget, 0.10);
  }

  // Rotation speed: base drift + sustained mid/bass + per-beat burst
  rotSpeedBurst *= 0.92;   // burst decays back to 0 over ~25 frames
  globalRot += 0.0006 + bassSmooth * 0.0030 + midSmooth * 0.0018 + rotSpeedBurst;

  // Helix radius breathing — bass expands the ring dramatically
  const radiusMod = 1.0 + bassSmooth * 0.38;

  // ── Background — pure black with subtle warm flash on beat ──
  const bgPulse = (bassSmooth * bassSmooth) + (midSmooth * 0.15);
  background(
    bgPulse * 35 + colorShift * 8,
    bgPulse * 20,
    bgPulse * 18
  );

  // Camera: user mouse orbit + fixed perspective tilt + audio nudge
  rotateY(userRotY + 0.10 + midSmooth  * 0.04);
  rotateX(userRotX - 0.14 - bassSmooth * 0.05);

  // ── Draw tiles — horizontal helix (X axis) ──
  for (let i = 0; i < NUM_TILES; i++) {
    const tile       = tiles[i];
    const worldAngle = tile.angle + globalRot;

    // Helix axis = X; winding is in Y-Z plane
    const x = tile.xPos;
    const y = sin(worldAngle) * tile.radius * radiusMod;
    const z = cos(worldAngle) * tile.radius * radiusMod + tile.zOffset;

    push();
    translate(x, y, z);

    // Billboard: face outward from the horizontal helix axis
    rotateX(-worldAngle);

    // Per-tile Z rotation (very slow)
    tile.rotZ += tile.rotZSpeed;
    rotateZ(tile.rotZ);

    // ── Tile brightness: starts DARK, reacts strongly to audio ──
    const flash = rippleAt(i);   // 0–1 as wave passes this tile

    // Tiles start very dark; violin lifts brightness; ripple flash bursts white
    const tintVal  = constrain(floor(18 + midSmooth * 230 + flash * 237), 0, 255);
    const tintR    = constrain(tintVal + floor(flash * 70),  0, 255);  // warm burst on flash
    const tintB    = constrain(tintVal + floor(colorShift * 90), 0, 255);  // cool with highs

    tint(tintR, tintVal, tintB);
    texture(tileGfx[i]);
    noStroke();

    const s = tile.scale * tile.sizeMult * TILE_W;
    plane(s, s);

    pop();
  }

  // ── Second helix: counter-rotating, cool-tinted, revealed by sustained bass ──
  if (revealAlpha > 0.01) {
    // Counter-rotate: moves opposite direction to first helix
    globalRot2 -= 0.0006 + midSmooth * 0.0018;

    for (let i = 0; i < NUM_TILES; i++) {
      const tile       = tiles[i];
      const worldAngle = tile.angle + globalRot2;

      // Slightly larger orbit so it interlaces visually with the first helix
      const x = tile.xPos;
      const y = sin(worldAngle) * tile.radius * radiusMod * 1.15;
      const z = cos(worldAngle) * tile.radius * radiusMod * 1.15 + tile.zOffset;

      push();
      translate(x, y, z);
      rotateX(-worldAngle);
      rotateZ(-tile.rotZ);   // mirror the per-tile spin

      const flash2 = rippleAt(i);

      // Cool blue/teal tint — contrasts the warm first helix
      const brightness = constrain(floor((18 + midSmooth * 230 + flash2 * 237) * revealAlpha), 0, 255);
      const tR = constrain(brightness * 0.55 + floor(flash2 * 60 * revealAlpha), 0, 255);
      const tG = constrain(brightness * 0.85, 0, 255);
      const tB = constrain(brightness * 1.0  + floor(colorShift * 80 * revealAlpha), 0, 255);

      tint(tR, tG, tB);
      texture(tileGfx[i]);
      noStroke();

      const s2 = tile.scale * tile.sizeMult * TILE_W * 0.88;
      plane(s2, s2);

      pop();
    }
  }
}

function windowResized() {
  applyCanvasFit();
}

// ─── Audio loading ────────────────────────────────────────────────
async function initAudio(arrayBuffer) {
  if (audioCtx) audioCtx.close();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  BIN_HZ   = audioCtx.sampleRate / FFT_SIZE;

  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  analyserNode  = audioCtx.createAnalyser();
  analyserNode.fftSize = FFT_SIZE;
  analyserNode.smoothingTimeConstant = 0.50;  // lower = sharper transients for onset detection
  freqData = new Uint8Array(FFT_SIZE / 2);

  const src  = audioCtx.createBufferSource();
  src.buffer = decoded;
  src.loop   = true;
  src.connect(analyserNode);
  analyserNode.connect(audioCtx.destination);
  src.start(0);

  audioReady = true;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('playBtn').textContent   = 'Pause';
  document.getElementById('state-label').textContent = 'playing';
}

window.loadBundled = async function () {
  try {
    const resp = await fetch('../dist/assets/circles01a.mp3');
    await initAudio(await resp.arrayBuffer());
  } catch (e) {
    alert('Could not load circles01a.mp3\n' + e.message);
  }
};

window.loadAudioFile = async function (input) {
  const file = input.files[0];
  if (!file) return;
  await initAudio(await file.arrayBuffer());
};

window.startNoAudio = function () {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('state-label').textContent = 'no audio';
};

window.togglePlayPause = function () {
  paused = !paused;
  if (audioCtx) paused ? audioCtx.suspend() : audioCtx.resume();
  document.getElementById('playBtn').textContent = paused ? 'Play' : 'Pause';
};

// Cycle through all 14 schemes together
window.cycleScheme = function () {
  schemeIdx = (schemeIdx + 1) % SCHEMES.length;
  for (const t of tiles) t.schemeIdx = schemeIdx;
  regenerateAllGraphics();
  document.getElementById('schemeBtn').textContent = 'Scheme: ' + SCHEMES[schemeIdx].name;
};

// Randomise shapes + mixed schemes
window.reshuffleTiles = function () {
  randomSeed(Math.floor(Math.random() * 99999));
  for (const t of tiles) {
    t.shapeType = floor(random(19));
    t.schemeIdx = floor(random(SCHEMES.length));
  }
  regenerateAllGraphics();
};

window.toggleFullscreen = function () {
  const btn = document.getElementById('fsBtn');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      document.body.classList.add('fullscreen-mode');
      btn.textContent = '✕ Exit Fullscreen';
    });
  } else {
    document.exitFullscreen().then(() => {
      document.body.classList.remove('fullscreen-mode');
      btn.textContent = '⛶ Fullscreen';
    });
  }
};

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    document.body.classList.remove('fullscreen-mode');
    const b = document.getElementById('fsBtn');
    if (b) b.textContent = '⛶ Fullscreen';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 's' || e.key === 'S') window.cycleScheme();
  if (e.key === 'r' || e.key === 'R') window.reshuffleTiles();
  if (e.key === ' ') { e.preventDefault(); window.togglePlayPause(); }
  // Reset orbit to default view
  if (e.key === '0') { userRotX = 0; userRotY = 0; }
});

// ─── Mouse orbit ──────────────────────────────────────────────────
function mousePressed() {
  // Only orbit when clicking on the canvas, not the UI buttons
  if (mouseY < height) {
    lastMouseX = mouseX;
    lastMouseY = mouseY;
  }
}

function mouseDragged() {
  const dx = mouseX - lastMouseX;
  const dy = mouseY - lastMouseY;
  userRotY += dx * 0.005;
  userRotX += dy * 0.005;
  lastMouseX = mouseX;
  lastMouseY = mouseY;
}
