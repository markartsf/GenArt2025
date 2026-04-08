import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as Tone from 'tone';

// ─── Constants ───────────────────────────────────────────────────────────
const N       = 25000;          // particle count
const GS      = 50;             // particles per group
const GN      = (N / GS) | 0;  // group count (500)
const BEAT_CD = 10;             // beat cooldown frames

// Dual-rate smoothing (fast attack, slow release — essential for transients)
const ATTACK  = 0.40;
const RELEASE = 0.06;

// Adaptive peak normalization (self-calibrating to ANY audio)
const PEAK_DECAY = 0.9997;      // forget old peaks over ~55s at 60fps

// ─── Pre-computed lookup tables (allocated once, zero GC) ───────────────
const gPhase   = new Float32Array(GN);
const gSeed    = new Float32Array(GN);
const gCenter  = new Float32Array(GN * 3);
const gFlat    = new Float32Array(GN);

const lSinT    = new Float32Array(GS);
const lCosT    = new Float32Array(GS);
const lGolden  = new Float32Array(GS);

for (let g = 0; g < GN; g++) {
  gPhase[g] = g / GN;
  gSeed[g]  = (g * 0.618033988749895) % 1;   // golden ratio distribution
}
for (let j = 0; j < GS; j++) {
  const f     = j / GS;
  lGolden[j]  = f * 2.399963;                 // golden angle (radians)
  const theta = Math.acos(1 - 2 * f);         // even sphere distribution
  lSinT[j]    = Math.sin(theta);
  lCosT[j]    = Math.cos(theta);
}

// ─── Three.js state ─────────────────────────────────────────────────────
let renderer, scene, camera, controls, points;
let posBuf, colBuf;

// ─── Audio state ────────────────────────────────────────────────────────
let player, wfAn, fftAn;
let isPlaying = false;
let sBass = 0, sMid = 0, sHigh = 0, sRMS = 0, sCentroid = 0;
let beatFlash = 0, cdFrames = 0;

// Adaptive peak tracking (auto-calibrates to any track)
let peakBass = 0.0001, peakMid = 0.0001, peakHigh = 0.0001, peakRMS = 0.0001;

// Local-average beat detection (works on compressed masters)
const RMS_WIN = 30;
const rmsWin  = new Float32Array(RMS_WIN);
let rmsWinIdx = 0;

// Spectral flux beat detection (catches timbral transients)
const prevSpec = new Float32Array(512);
let sFlux = 0;

// 3 attractor positions (mutated in-place, zero allocation)
const att = [
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 }
];

// ─── Initialization ─────────────────────────────────────────────────────
function init() {
  const canvas = document.getElementById('canvas');

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x070710);

  // Scene + exponential fog for depth
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070710, 0.0022);

  // Camera
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 2000);
  camera.position.set(0, 40, 280);

  // Orbit controls (auto-rotate, damped)
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.05;
  controls.autoRotate     = true;
  controls.autoRotateSpeed = 0.3;

  // ── Particle geometry (BufferGeometry, vertex colors) ──
  const geo = new THREE.BufferGeometry();
  posBuf = new Float32Array(N * 3);
  colBuf = new Float32Array(N * 3);

  // Seed at origin (first frame positions them correctly)
  for (let i = 0; i < N * 3; i++) {
    posBuf[i] = 0;
    colBuf[i] = 0.2;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(posBuf, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colBuf, 3));

  const mat = new THREE.PointsMaterial({
    size:            1.2,
    vertexColors:    true,
    transparent:     true,
    opacity:         0.65,
    sizeAttenuation: true,
    blending:        THREE.AdditiveBlending,
    depthWrite:      false
  });

  points = new THREE.Points(geo, mat);
  scene.add(points);

  // ── Audio analysers ──
  wfAn  = new Tone.Analyser('waveform', 1024);
  fftAn = new Tone.Analyser('fft', 512);

  // ── Events ──
  addEventListener('resize', onResize);
  addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') window._fullscreen();
  });

  // Boot animation loop
  animate();
}

// ─── Audio loading ──────────────────────────────────────────────────────
async function loadAudio(url) {
  if (player) { player.stop(); player.dispose(); }
  player = new Tone.Player(url);
  player.connect(wfAn);
  player.connect(fftAn);
  player.toDestination();
  player.loop = true;
  await Tone.loaded();
}

window._toggle = async function () {
  await Tone.start();
  if (!isPlaying) {
    if (!player) await loadAudio('/audio-tunnel/GlassHorizon.mp3');
    player.start();
    isPlaying = true;
    document.getElementById('playBtn').textContent = 'Pause';
  } else {
    player.stop();
    isPlaying = false;
    sBass = sMid = sHigh = sRMS = sCentroid = beatFlash = sFlux = 0;
    peakBass = peakMid = peakHigh = peakRMS = 0.0001;
    rmsWinIdx = 0;
    rmsWin.fill(0);
    prevSpec.fill(0);
    document.getElementById('playBtn').textContent = 'Play';
  }
};

window._loadFile = async function (input) {
  if (!input.files.length) return;
  const url = URL.createObjectURL(input.files[0]);
  await loadAudio(url);
  if (isPlaying) player.start();
};

window._fullscreen = function () {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
};

// ─── Audio feature extraction ───────────────────────────────────────────
function updateAudio() {
  if (!isPlaying || !player) return;

  const wf  = wfAn.getValue();
  const fft = fftAn.getValue();

  // RMS from waveform
  let sq = 0;
  for (let i = 0; i < wf.length; i++) sq += wf[i] * wf[i];
  const rawRMS = Math.sqrt(sq / wf.length);

  // FFT → frequency bands + spectral flux (single pass)
  const bins = fft.length;
  const bEnd = (bins * 0.10) | 0;
  const mEnd = (bins * 0.50) | 0;
  let bSum = 0, mSum = 0, hSum = 0;
  let bN = 0, mN = 0, hN = 0;
  let wSum = 0, tMag = 0;
  let fluxPos = 0;

  for (let i = 0; i < bins; i++) {
    const mag = Math.max(0, Math.pow(10, fft[i] / 20));
    if (i < bEnd)      { bSum += mag; bN++; }
    else if (i < mEnd) { mSum += mag; mN++; }
    else               { hSum += mag; hN++; }
    wSum += mag * i;
    tMag += mag;

    // Spectral flux: sum of positive magnitude changes (timbral transients)
    const diff = mag - prevSpec[i];
    if (diff > 0) fluxPos += diff;
    prevSpec[i] = mag;
  }

  const rawBass = bN > 0 ? bSum / bN : 0;
  const rawMid  = mN > 0 ? mSum / mN : 0;
  const rawHigh = hN > 0 ? hSum / hN : 0;
  const rawFlux = fluxPos / bins;

  // ── Adaptive peak tracking (self-calibrates to ANY audio) ──
  peakBass = Math.max(rawBass, peakBass * PEAK_DECAY);
  peakMid  = Math.max(rawMid,  peakMid  * PEAK_DECAY);
  peakHigh = Math.max(rawHigh, peakHigh * PEAK_DECAY);
  peakRMS  = Math.max(rawRMS,  peakRMS  * PEAK_DECAY);

  // Normalize to [0,1] using adaptive peaks (works with any track)
  const nB = peakBass > 0.0001 ? rawBass / peakBass : 0;
  const nM = peakMid  > 0.0001 ? rawMid  / peakMid  : 0;
  const nH = peakHigh > 0.0001 ? rawHigh / peakHigh : 0;
  const nR = peakRMS  > 0.0001 ? rawRMS  / peakRMS  : 0;

  // ── Dual-rate smoothing (fast attack, slow release) ──
  sBass += (nB > sBass ? ATTACK : RELEASE) * (nB - sBass);
  sMid  += (nM > sMid  ? ATTACK : RELEASE) * (nM - sMid);
  sHigh += (nH > sHigh ? ATTACK : RELEASE) * (nH - sHigh);
  sRMS  += (nR > sRMS  ? ATTACK : RELEASE) * (nR - sRMS);
  sCentroid += 0.10 * ((tMag > 0 ? wSum / tMag / bins : 0) - sCentroid);

  // ── Spectral flux smoothing ──
  sFlux += (rawFlux > sFlux ? 0.3 : 0.05) * (rawFlux - sFlux);

  // ── Local-average beat detection (works on compressed masters) ──
  rmsWin[rmsWinIdx % RMS_WIN] = rawRMS;
  rmsWinIdx++;
  let rmsAvg = 0;
  for (let k = 0; k < RMS_WIN; k++) rmsAvg += rmsWin[k];
  rmsAvg /= RMS_WIN;

  // Dual trigger: RMS spike above local average OR spectral flux spike
  const rmsSpike  = rawRMS  > rmsAvg * 1.12;     // 12% above local average
  const fluxSpike = rawFlux > sFlux  * 1.5;       // 50% above smoothed flux

  cdFrames = Math.max(0, cdFrames - 1);
  if ((rmsSpike || fluxSpike) && cdFrames <= 0) {
    beatFlash = 1;
    cdFrames  = BEAT_CD;
  }
  beatFlash *= 0.86;
}

// ─── Particle murmuration update ────────────────────────────────────────
function updateParticles(t) {
  // Audio-driven parameters (gentle defaults when silent)
  const bass = isPlaying ? sBass : 0.12;
  const mid  = isPlaying ? sMid  : 0.08;
  const high = isPlaying ? sHigh : 0.02;
  const rms  = isPlaying ? sRMS  : 0.06;
  const beat = isPlaying ? beatFlash : 0;

  const speed    = 0.4 + rms * 3.5;               // silence=slow, loud=fast
  const cohesion = 28 - bass * 24;                // bass compresses the flock
  const scatter  = 1.0 + high * 45;               // highs shatter the surface
  const waveAmp  = 5 + mid * 60;                  // mids drive the turning wave

  const ts = t * speed;

  // ── Update 3 orbiting attractors ──
  const R = 50 + bass * 90;                       // bass breathes the whole swarm

  att[0].x = Math.cos(ts * 0.30) * R;
  att[0].y = Math.sin(ts * 0.20) * R * 0.50 + Math.cos(ts * 0.15) * 18;
  att[0].z = Math.sin(ts * 0.25) * R * 0.70;

  att[1].x = Math.cos(ts * 0.35 + 2.09) * R;
  att[1].y = Math.sin(ts * 0.22 + 2.09) * R * 0.50;
  att[1].z = Math.sin(ts * 0.28 + 2.09) * R * 0.70;

  att[2].x = Math.cos(ts * 0.28 + 4.19) * R;
  att[2].y = Math.sin(ts * 0.18 + 4.19) * R * 0.50;
  att[2].z = Math.sin(ts * 0.32 + 4.19) * R * 0.70;

  // Beat-triggered directional burst (dramatic shape shift)
  if (beat > 0.15) {
    const b = beat * 50;
    att[0].y += b;
    att[1].x -= b;
    att[2].z += b;
  }

  // ── Phase 1: Group centers (500 iterations) ──
  for (let g = 0; g < GN; g++) {
    const gp    = gPhase[g];
    const blend = gp * 6.2832;

    // Attractor blend weights (audio shifts which attractor dominates)
    const w0  = 0.40 + 0.35 * Math.sin(blend + bass * 8);
    const w1  = 0.35 + 0.30 * Math.cos(blend * 1.3 + mid * 8);
    const w2  = 0.25 + 0.25 * Math.sin(blend * 0.7 + high * 8);
    const ws  = w0 + w1 + w2;

    let cx = (att[0].x * w0 + att[1].x * w1 + att[2].x * w2) / ws;
    let cy = (att[0].y * w0 + att[1].y * w1 + att[2].y * w2) / ws;
    let cz = (att[0].z * w0 + att[1].z * w1 + att[2].z * w2) / ws;

    // Wave propagation (information ripple through flock)
    const wp = gp * 15 - ts * 2.5;
    cx += Math.sin(wp) * waveAmp;
    cy += Math.cos(wp * 0.8 + 0.5) * waveAmp * 0.6;
    cz += Math.sin(wp * 0.6 + 1.5) * waveAmp * 0.4;

    const gi = g * 3;
    gCenter[gi]     = cx;
    gCenter[gi + 1] = cy;
    gCenter[gi + 2] = cz;

    // Sheet formation (periodic flattening)
    gFlat[g] = 0.12 + 0.88 * Math.abs(Math.sin(t * 0.35 + gp * 3.5));
  }

  // ── Phase 2: Individual particles (25,000 iterations — tight loop) ──
  const hueBase = 0.58 + sCentroid * 0.25;

  for (let i = 0; i < N; i++) {
    const g  = (i / GS) | 0;           // group index (fast floor)
    const j  = i - g * GS;             // local index within group
    const gi = g * 3;

    // Group center
    const cx = gCenter[gi];
    const cy = gCenter[gi + 1];
    const cz = gCenter[gi + 2];

    // Local offset: golden-angle sphere + time rotation
    const phi  = lGolden[j] + t * 0.5 + gSeed[g] * 6.2832;
    const sinP = Math.sin(phi);
    const cosP = Math.cos(phi);
    const sinT = lSinT[j];     // pre-computed
    const cosT = lCosT[j];     // pre-computed

    // Radius: denser in center, sparser at edges
    const r    = cohesion * (0.3 + 0.7 * ((j + 1) / GS));
    const flat = gFlat[g];

    const lx = cosP * sinT * r;
    const ly = cosT * r * flat;
    const lz = sinP * sinT * r;

    // Turbulence (cheap trig-based noise, 3 calls)
    const ti = i * 0.0137 + t;
    const nx = Math.sin(ti * 7.3) * scatter;
    const ny = Math.cos(ti * 5.7) * scatter * 0.7;
    const nz = Math.sin(ti * 6.1 + 1.3) * scatter * 0.8;

    const pi = i * 3;
    posBuf[pi]     = cx + lx + nx;
    posBuf[pi + 1] = cy + ly + ny;
    posBuf[pi + 2] = cz + lz + nz;

    // ── Color: HSL → RGB (inline, zero allocation) ──
    // Rich saturated colors — luminance driven hard by audio energy
    const h = ((hueBase + gPhase[g] * 0.20 + beat * 0.12 + bass * 0.08) % 1 + 1) % 1;
    const s = Math.min(0.50 + high * 0.35 + beat * 0.15, 1);
    const l = Math.min(0.02 + rms * 0.20 + beat * 0.28, 0.50);

    const c  = (1 - Math.abs(2 * l - 1)) * s;
    const x  = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m  = l - c * 0.5;
    const sc = (h * 6) | 0;

    let rv, gv, bv;
    if      (sc <= 0) { rv = c; gv = x; bv = 0; }
    else if (sc === 1) { rv = x; gv = c; bv = 0; }
    else if (sc === 2) { rv = 0; gv = c; bv = x; }
    else if (sc === 3) { rv = 0; gv = x; bv = c; }
    else if (sc === 4) { rv = x; gv = 0; bv = c; }
    else               { rv = c; gv = 0; bv = x; }

    colBuf[pi]     = rv + m;
    colBuf[pi + 1] = gv + m;
    colBuf[pi + 2] = bv + m;
  }

  // Flag buffers for GPU upload
  points.geometry.attributes.position.needsUpdate = true;
  points.geometry.attributes.color.needsUpdate    = true;
}

// ─── Animation loop ─────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  const t = performance.now() * 0.001;    // seconds

  updateAudio();
  updateParticles(t);

  // Camera reacts to energy (dramatic orbit speed changes)
  controls.autoRotateSpeed = 0.15 + sRMS * 3.5 + beatFlash * 5;
  controls.update();

  // Particle size pulses with bass and beats
  points.material.size = 1.0 + sBass * 2.0 + beatFlash * 2.5;

  // Status bar
  if (isPlaying) updateStatus();

  renderer.render(scene, camera);
}

// ─── Status display ─────────────────────────────────────────────────────
function updateStatus() {
  const bar = v => {
    const n = Math.round(Math.min(v, 1) * 10);
    return '\u2593'.repeat(n) + '\u2591'.repeat(10 - n);
  };
  const el = document.getElementById('status');
  el.textContent =
    `B ${bar(sBass)} M ${bar(sMid)} H ${bar(sHigh)} E ${bar(sRMS)} ${beatFlash > 0.3 ? '\u25cf BEAT' : '\u25cb'}`;
}

// ─── Resize handler ─────────────────────────────────────────────────────
function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

// ─── Boot ───────────────────────────────────────────────────────────────
addEventListener('DOMContentLoaded', init);
