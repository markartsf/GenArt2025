// Circle Packing — Audio Reactive + Mouse Control
// Ported from openprocessing.org (P5.js) to Canvas 2D + Tone.js
//
// Original: circle packing with radial distorted-diamond shapes + spoke lines,
//           OVERLAY blend + linear gradient fills, palette shuffle on click.
//
// Audio mapping:
//   Bass  → circle scale + radial wave displacement (field ripples outward)
//   Mid   → bezier distortion (tight diamonds → wild organic blobs)
//   High  → spoke count per circle (4 sparse → 12 dense)
//   RMS   → per-circle spin speed (faster with overall loudness)
//   Beat  → spin impulse + opacity burst
//
// Mouse:
//   X     → rotate entire composition in Z (−180° … +180°)
//   Y     → additional bezier distortion
//   Move  → composition origin drifts toward cursor
//   Click → new colour palettes + rebuild pack
//
// Keys: F → fullscreen  ·  R → repack

import * as Tone from 'tone';

// ─── Audio config ──────────────────────────────────────────────────────────────
const PRELOAD_SRC     = '/clifford-attractor/BreathBetweenCircuits.mp3';
const BASS_NORM       = 1 / 0.18;
const MID_NORM        = 1 / 0.15;
const HIGH_NORM       = 1 / 0.03;
const BEAT_THRESHOLD  = 0.012;
const FLUX_THRESHOLD  = 1.5;
const BEAT_COOLDOWN_F = 10;
const RMS_WIN         = 10;

// ─── Visual config ─────────────────────────────────────────────────────────────
const PACK_CANDIDATES = 2000;   // placement attempts (same as original)
const PACK_RADIUS_F   = 0.40;   // packing field radius = 40% of min(W,H)
const CIRCLE_MAX_F    = 0.13;   // max individual circle = 13% of min(W,H)
const SPOKE_MIN       = 4;      // minimum spokes per circle
const SPOKE_MAX       = 12;     // maximum spokes (driven by highs)
const DIST_BASE       = 0.18;   // bezier distortion when silent
const DIST_MID        = 0.32;   // mids add up to this extra distortion
const DIST_MOUSE      = 0.15;   // mouse Y adds up to this extra distortion
const SCALE_BASS      = 0.22;   // bass expands circles by up to 22%
const ORIGIN_LERP     = 0.055;  // composition follow lag (lower = slower)
const ORIGIN_RANGE    = 0.15;   // max shift = 15% of canvas dimension
// ── Motion
const COMP_ROT_RANGE  = Math.PI * 2; // mouse X sweeps ±180° of composition rotation
const COMP_ROT_LERP   = 0.04;        // composition rotation smoothing
const WAVE_AMP        = 0.38;        // bass wave amplitude (fraction of circle's dist-from-center)
const SPIN_IDLE       = 0.0008;      // constant idle drift (barely visible when silent)
const SPIN_RMS        = 0.028;       // sRMS multiplier for per-circle spin speed
const SPIN_BEAT       = 0.28;        // angular velocity kick applied on each beat
const ROT_VEL_DECAY   = 0.88;        // friction on beat-kick velocity

// ─── Colour palettes (from original, verbatim) ─────────────────────────────────
const BG_PALETTE = [
  '#488a50', '#bf5513', '#3b6fb6', '#4f3224',
  '#9a7f6e', '#1c3560', '#4a4e69', '#333',
  '#413e49', '#5da4a9'
];

const PALETTES = [
  ['#e9dbce','#ea526f','#fceade','#e2c290','#6b2d5c','#25ced1'],
  ['#e9dbce','#d77a61','#223843','#eff1f3','#dbd3d8','#d8b4a0'],
  ['#e29578','#006d77','#83c5be','#ffddd2','#edf6f9'],
  ['#e9dbce','#cc3528','#028090','#00a896','#f8c522'],
  ['#e9dbce','#92accc','#f8f7c1','#f46902','#da506a','#fae402'],
  ['#e42268','#fb8075','#761871','#5b7d9c','#a38cb4','#476590'],
  ['#f9b4ab','#679186','#fdebd3','#264e70','#bbd4ce'],
  ['#1f306e','#c7417b','#553772','#8f3b76','#f5487f'],
  ['#e0f0ea','#95adbe','#574f7d','#503a65','#3c2a4d'],
  ['#413e4a','#b38184','#73626e','#f0b49e','#f7e4be'],
  ['#ff4e50','#fc913a','#f9d423','#ede574','#e1f5c4'],
  ['#99b898','#fecea8','#ff847c','#e84a5f','#2a363b'],
  ['#69d2e7','#a7dbd8','#e0e4cc','#f38630','#fa6900'],
  ['#fe4365','#fc9d9a','#f9cdad','#c8c8a9','#83af9b'],
  ['#ecd078','#d95b43','#c02942','#542437','#53777a'],
  ['#556270','#4ecdc4','#c7f464','#ff6b6b','#c44d58'],
  ['#774f38','#e08e79','#f1d4af','#ece5ce','#c5e0dc'],
  ['#e8ddcb','#cdb380','#036564','#033649','#031634'],
  ['#490a3d','#bd1550','#e97f02','#f8ca00','#8a9b0f'],
  ['#594f4f','#9de0ad','#547980','#45ada8','#e5fcc2'],
  ['#00a0b0','#cc333f','#6a4a3c','#eb6841','#edc951'],
  ['#5bc0eb','#fde74c','#9bc53d','#e55934','#fa7921'],
  ['#ed6a5a','#9bc1bc','#f4f1bb','#5ca4a9','#e6ebe0'],
  ['#ef476f','#ffd166','#06d6a0','#118ab2','#073b4c'],
  ['#22223b','#c9ada7','#4a4e69','#9a8c98','#f2e9e4'],
  ['#114b5f','#1a936f','#88d498','#c6dabf','#f3e9d2'],
  ['#3d5a80','#98c1d9','#e0fbfc','#ee6c4d','#293241'],
  ['#06aed5','#f0c808','#086788','#fff1d0','#dd1c1a'],
  ['#540d6e','#ee4266','#ffd23f','#3bceac','#0ead69'],
  ['#c9cba3','#e26d5c','#ffe1a8','#723d46','#472d30'],
  ['#3c4cad','#5FB49C','#e8a49c'],
  ['#1c3560','#ff6343','#f2efdb','#fea985'],
  ['#e0d7c5','#488a50','#b59a55','#bf5513','#3b6fb6','#4f3224','#9a7f6e'],
  ['#DEEFB7','#5FB49C','#ed6a5a'],
  ['#2B2B2B','#91B3E1','#2F5FB3','#3D4B89','#AE99E8','#DBE2EC'],
  ['#ffbe0b','#fb5607','#ff006e','#8338ec','#3a86ff'],
  ['#A8C25D','#5B7243','#FFA088','#FFFB42','#a9cff0','#2D6EA6'],
  ['#F9F9F1','#191A18','#E15521','#3391CF','#E4901C','#F5B2B1','#009472']
];

// ─── Module state ──────────────────────────────────────────────────────────────
let canvas, ctx, W, H, dpr;
let player = null, waveAnalyzer = null, fftAnalyzer = null;
let isPlaying = false;

// Smoothed audio bands
let sBass = 0, sMid = 0, sHigh = 0, sRMS = 0;
let rawRMS = 0, avgRMS = 0;
let rmsWin       = new Array(RMS_WIN).fill(0);
let beatFlash    = 0;
let beatCooldown = 0;
let spectralFlux = 0;
let prevSpectrum = null;

// Mouse / composition origin
let mouseX = 0, mouseY = 0;
let originX = 0, originY = 0;

// Motion state
let time     = 0;      // frame counter for wave phase
let compRot  = 0;      // current composition Z-rotation (mouse X driven)
let newBeat  = false;  // true for the one frame a beat fires

// Pack state
let circles    = [];
let currentBg  = '#333';
let pal1 = [], pal2 = [], pal3 = [];

// ─── Palette helpers ───────────────────────────────────────────────────────────
function _randFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function _shufflePalettes() {
  pal1 = _randFrom(PALETTES).slice();
  pal2 = _randFrom(PALETTES).slice();
  pal3 = _randFrom(PALETTES).slice();
  currentBg = _randFrom(BG_PALETTE);
}

// ─── Circle packing ────────────────────────────────────────────────────────────
// Precomputes the field of non-overlapping circles. Each circle stores normalised
// bezier offsets so distortion can be scaled by audio each frame without re-running
// the random generator.
function _buildPack() {
  const packR = Math.min(W, H) * PACK_RADIUS_F;
  const maxD  = Math.min(W, H) * CIRCLE_MAX_F * 2;  // max diameter
  const pts   = [];

  for (let i = 0; i < PACK_CANDIDATES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const s     = Math.random() * maxD;       // diameter
    const r     = s / 2;
    const d     = Math.random() * packR;
    const x     = Math.cos(angle) * (d - r);
    const y     = Math.sin(angle) * (d - r);
    let ok = true;
    for (const p of pts) {
      if (Math.hypot(x - p.x, y - p.y) < (s + p.s) * 0.6) { ok = false; break; }
    }
    if (ok && r > 4) pts.push({ x, y, s, r });
  }

  circles = pts.map(p => ({
    x:   p.x,
    y:   p.y,
    r:   p.r - 3,  // small padding, matches original's `p.z - 5`
    rot: Math.random() * Math.PI * 2,

    // Normalised bezier offsets in [-1, 1].  Scaled by val × r at draw time.
    n81: Math.random() * 2 - 1,
    n23: Math.random() * 2 - 1,
    n45: Math.random() * 2 - 1,
    n67: Math.random() * 2 - 1,

    // Anchor arm lengths as fraction of r  [0.2 .. 0.5]
    nAA: 0.2 + Math.random() * 0.3,
    nAB: 0.2 + Math.random() * 0.3,

    // Gradient colours (two palettes)
    gCol1: _randFrom(pal1),
    gCol2: _randFrom(pal2),

    // One spoke colour per possible spoke (SPOKE_MAX), picked from pal3
    spokeColors: Array.from({ length: SPOKE_MAX }, () => _randFrom(pal3)),

    // ── Motion properties ──────────────────────────────────────────────────
    rotDir:   Math.random() < 0.5 ? 1 : -1,  // independent spin direction
    rotVel:   0,                               // angular velocity (beat kicks this)
    baseAngle: Math.atan2(p.y, p.x),          // angle from composition centre
    baseDist:  Math.hypot(p.x, p.y),          // distance from composition centre
    phaseOff:  Math.random() * Math.PI * 2,   // per-circle wave phase offset
  }));
}

// ─── Draw distorted diamond at current canvas origin ───────────────────────────
// Direct port of P5.js distortedCircle().
// P5 bezierVertex(cp1x,cp1y, cp2x,cp2y, x,y)  ≡  Canvas bezierCurveTo(cp1x,cp1y, cp2x,cp2y, x,y)
function _drawDistorted(c, r, val) {
  const rh  = r / 2;
  const aA  = c.nAA * r;
  const aB  = c.nAB * r;
  const d81 = c.n81 * r * val;
  const d23 = c.n23 * r * val;
  const d45 = c.n45 * r * val;
  const d67 = c.n67 * r * val;

  //  Points:  p1=top  p2=right  p3=bottom  p4=left
  ctx.beginPath();
  ctx.moveTo(0, -rh);                                                          // p1
  ctx.bezierCurveTo( aA,        -rh + d81,   rh + d23, -aB,        rh,  0);   // p1→p2
  ctx.bezierCurveTo( rh - d23,   aA,          aB,        rh + d45,   0,  rh);  // p2→p3
  ctx.bezierCurveTo(-aA,         rh - d45,  -rh + d67,   aB,       -rh,  0);  // p3→p4
  ctx.bezierCurveTo(-rh - d67,  -aA,        -aB,        -rh - d81,   0, -rh); // p4→p1
  ctx.closePath();
}

// ─── Draw all packed circles each frame ────────────────────────────────────────
function _drawCircles() {
  // Audio-driven parameters (all → 0/base when stopped)
  const distVal    = DIST_BASE + sMid * DIST_MID + (mouseY / H) * DIST_MOUSE;
  const scaleMod   = 1.0 + sBass * SCALE_BASS;
  const nums       = Math.round(SPOKE_MIN + sHigh * (SPOKE_MAX - SPOKE_MIN));
  const gradAlpha  = 0.60 + beatFlash * 0.30;
  const spokeAlpha = 0.45 + beatFlash * 0.45;
  const step       = (Math.PI * 2) / nums;
  const spinSpeed  = SPIN_IDLE + sRMS * SPIN_RMS;  // continuous spin rate

  // ── Whole-field composition rotation (mouse X) ────────────────────────────
  // All circles rotate around the composition origin as one rigid body.
  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(compRot);
  // From here all circles are drawn relative to (0,0) = composition centre.

  for (const c of circles) {
    // ── Per-circle spin ──────────────────────────────────────────────────
    c.rot    += spinSpeed * c.rotDir;
    if (newBeat) c.rotVel += c.rotDir * SPIN_BEAT;   // beat kick
    c.rot    += c.rotVel;
    c.rotVel *= ROT_VEL_DECAY;

    // ── Radial wave displacement (bass drives amplitude) ─────────────────
    // Each circle oscillates along its own outward direction with a phase
    // offset → neighbouring circles are at different wave phases, creating
    // a rippling / breathing motion across the whole field.
    const wave       = Math.sin(time * 0.04 + c.phaseOff);
    const radialDisp = sBass * c.baseDist * WAVE_AMP * wave;
    const cx = c.x + Math.cos(c.baseAngle) * radialDisp;
    const cy = c.y + Math.sin(c.baseAngle) * radialDisp;

    const r = c.r * scaleMod;
    if (r < 3) continue;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(c.rot);

    // Gradient in circle-local space
    const grad = ctx.createLinearGradient(0, -r, 0, r);
    grad.addColorStop(0, c.gCol1);
    grad.addColorStop(1, c.gCol2);

    // ── Distorted diamonds at each spoke tip (OVERLAY, gradient filled) ──
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = gradAlpha;
    ctx.fillStyle   = grad;

    for (let i = 0; i < nums; i++) {
      const angle = i * step;
      const ex    = r * Math.sin(angle);
      const ey    = r * Math.cos(angle);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(Math.atan2(ey, ex));
      _drawDistorted(c, r, distVal);
      ctx.fill();
      ctx.restore();
    }

    // ── Spoke lines + tip dots (source-over, coloured strokes) ───────────
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = spokeAlpha;
    ctx.lineWidth   = 0.5 + beatFlash * 0.8;

    for (let i = 0; i < nums; i++) {
      const angle = i * step;
      const ex    = r * Math.sin(angle);
      const ey    = r * Math.cos(angle);
      const col   = c.spokeColors[i % SPOKE_MAX];

      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(ex, ey, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Restore composition rotation transform
  ctx.restore();

  // Clean up blend state
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// ─── Audio analysis ────────────────────────────────────────────────────────────
function _readAudio() {
  // Always decay beat flash even when stopped
  beatFlash    *= 0.85;
  beatCooldown  = Math.max(0, beatCooldown - 1);

  if (!isPlaying) return;

  // FFT → band energies (dB → linear)
  const spec = fftAnalyzer.getValue();
  const bins  = spec.length;
  const bEnd  = Math.floor(bins * 0.10);
  const mEnd  = Math.floor(bins * 0.50);

  let bSum = 0, mSum = 0, hSum = 0;
  for (let i = 0; i < bins; i++) {
    const lin = Math.pow(10, spec[i] / 20);
    if      (i < bEnd) bSum += lin;
    else if (i < mEnd) mSum += lin;
    else               hSum += lin;
  }
  const rawBass = bSum / bEnd;
  const rawMid  = mSum / (mEnd - bEnd);
  const rawHigh = hSum / (bins - mEnd);

  // Waveform → RMS
  const wf = waveAnalyzer.getValue();
  let sq = 0;
  for (const v of wf) sq += v * v;
  rawRMS = Math.sqrt(sq / wf.length);

  // Smooth bands
  sBass += 0.08 * (Math.min(1, rawBass * BASS_NORM) - sBass);
  sMid  += 0.07 * (Math.min(1, rawMid  * MID_NORM)  - sMid);
  sHigh += 0.18 * (Math.min(1, rawHigh * HIGH_NORM) - sHigh);
  sRMS  += 0.10 * (rawRMS - sRMS);

  // Spectral flux — transient detector
  let fluxRaw = 0;
  if (prevSpectrum !== null) {
    for (let i = 0; i < bins; i++)
      fluxRaw += Math.max(0, spec[i] - prevSpectrum[i]);
    fluxRaw /= bins;
  }
  prevSpectrum = Array.from(spec);
  spectralFlux += 0.5 * (fluxRaw - spectralFlux);

  // Beat detection: dual — local RMS delta OR spectral flux
  rmsWin.shift(); rmsWin.push(rawRMS);
  avgRMS = rmsWin.reduce((s, v) => s + v, 0) / RMS_WIN;

  const beatByRMS  = (rawRMS - avgRMS) > BEAT_THRESHOLD;
  const beatByFlux = spectralFlux > FLUX_THRESHOLD;

  if ((beatByRMS || beatByFlux) && beatCooldown <= 0) {
    beatFlash    = 1.0;
    beatCooldown = BEAT_COOLDOWN_F;
    newBeat      = true;   // consumed in _drawCircles, cleared in _loop
  }

  // Level meters
  document.getElementById('bassMeter').style.height = (sBass * 100) + '%';
  document.getElementById('midMeter').style.height  = (sMid  * 100) + '%';
  document.getElementById('highMeter').style.height = (sHigh * 100) + '%';

  const beatSrc = beatByFlux ? 'F' : (beatByRMS ? 'R' : '-');
  _setStatus(
    `RMS:${rawRMS.toFixed(3)}  [${beatSrc}]  B:${sBass.toFixed(2)} M:${sMid.toFixed(2)} H:${sHigh.toFixed(2)}`,
    'ready'
  );
}

// ─── Main render loop ──────────────────────────────────────────────────────────
function _loop() {
  requestAnimationFrame(_loop);
  _readAudio();

  time++;

  // Lerp composition origin toward mouse target (Y-axis drift)
  const tx = W / 2 + (mouseX - W / 2) * ORIGIN_RANGE;
  const ty = H / 2 + (mouseY - H / 2) * ORIGIN_RANGE;
  originX += ORIGIN_LERP * (tx - originX);
  originY += ORIGIN_LERP * (ty - originY);

  // Mouse X → composition Z-rotation:  left edge = −180°, right edge = +180°
  const targetRot = (mouseX / W - 0.5) * COMP_ROT_RANGE;
  compRot += COMP_ROT_LERP * (targetRot - compRot);

  // Clear with background colour each frame
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha  = 1;
  ctx.fillStyle    = currentBg;
  ctx.fillRect(0, 0, W, H);

  if (circles.length > 0) _drawCircles();

  newBeat = false;  // consumed; reset after draw
}

// ─── Canvas resize ─────────────────────────────────────────────────────────────
function _resize() {
  dpr = window.devicePixelRatio || 1;
  W   = window.innerWidth;
  H   = window.innerHeight;
  canvas.width        = W * dpr;
  canvas.height       = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.resetTransform();
  ctx.scale(dpr, dpr);

  // Re-centre and rebuild for new dimensions
  originX = W / 2;
  originY = H / 2;
  mouseX  = W / 2;
  mouseY  = H / 2;
  _buildPack();
}

// ─── Audio setup ───────────────────────────────────────────────────────────────
function _setupAudio() {
  waveAnalyzer = new Tone.Analyser('waveform', 1024);
  fftAnalyzer  = new Tone.Analyser('fft', 512);
  _loadTrack(PRELOAD_SRC);

  document.getElementById('playBtn').addEventListener('click', _togglePlay);
  document.getElementById('stopBtn').addEventListener('click', _stop);
  document.getElementById('repackBtn').addEventListener('click', () => {
    _shufflePalettes();
    _buildPack();
  });
  document.getElementById('audioFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    _setStatus(`Loading ${f.name}…`, 'loading');
    await _loadTrackFromFile(URL.createObjectURL(f), f.name);
  });
  document.getElementById('fullscreenBtn').addEventListener('click', _toggleFullscreen);
}

function _loadTrack(url) {
  _setStatus('Loading audio…', 'loading');
  if (player) { if (isPlaying) { player.stop(); isPlaying = false; } player.dispose(); }
  player = new Tone.Player(url, () => {
    document.getElementById('playBtn').disabled = false;
    document.getElementById('stopBtn').disabled = false;
    _setStatus('Ready — Press Play', 'ready');
  }).toDestination();
  player.volume.value = 0;
  player.loop = true;
  player.connect(waveAnalyzer);
  player.connect(fftAnalyzer);
}

async function _loadTrackFromFile(url, name) {
  if (player) { if (isPlaying) { player.stop(); isPlaying = false; } player.dispose(); }
  return new Promise(resolve => {
    player = new Tone.Player(url, () => {
      document.getElementById('playBtn').disabled = false;
      document.getElementById('stopBtn').disabled = false;
      _setStatus(`Ready — ${name}`, 'ready');
      resolve();
    }).toDestination();
    player.volume.value = 0;
    player.loop = true;
    player.connect(waveAnalyzer);
    player.connect(fftAnalyzer);
  });
}

async function _togglePlay() {
  if (!player) return;
  if (isPlaying) {
    player.stop(); isPlaying = false;
    document.getElementById('playBtn').textContent = 'Play';
  } else {
    await Tone.start(); player.start(); isPlaying = true;
    document.getElementById('playBtn').textContent = 'Pause';
  }
}

function _stop() {
  if (!player) return;
  player.stop(); isPlaying = false;
  document.getElementById('playBtn').textContent = 'Play';

  // Reset all audio + motion state
  sBass = sMid = sHigh = sRMS = rawRMS = avgRMS = 0;
  spectralFlux = 0; prevSpectrum = null;
  rmsWin = new Array(RMS_WIN).fill(0);
  beatFlash = 0; beatCooldown = 0; newBeat = false;
  for (const c of circles) c.rotVel = 0;

  document.getElementById('bassMeter').style.height = '0%';
  document.getElementById('midMeter').style.height  = '0%';
  document.getElementById('highMeter').style.height = '0%';

  _setStatus('Stopped. Press Play.', 'ready');
}

function _toggleFullscreen() {
  const el = document.getElementById('container');
  if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
  else document.exitFullscreen();
}

function _setStatus(msg, cls) {
  const el = document.getElementById('status');
  el.textContent = msg; el.className = cls || '';
}

// ─── Init ──────────────────────────────────────────────────────────────────────
function init() {
  canvas = document.getElementById('c');
  ctx    = canvas.getContext('2d');

  _shufflePalettes();

  _resize();
  window.addEventListener('resize', _resize);
  document.addEventListener('fullscreenchange', () => setTimeout(_resize, 50));

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  canvas.addEventListener('click', () => {
    _shufflePalettes();
    _buildPack();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') _toggleFullscreen();
    if (e.key === 'r' || e.key === 'R') { _shufflePalettes(); _buildPack(); }
  });

  _setupAudio();
  requestAnimationFrame(_loop);
}

init();
