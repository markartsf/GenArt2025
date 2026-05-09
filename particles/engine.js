import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AudioEngine } from './audio.js';
import { visualizations } from './visualizations/index.js';

// ─── Constants ───────────────────────────────────────────────────────────
const N = 25000;

// ─── State ───────────────────────────────────────────────────────────────
let renderer, scene, camera, controls, points;
let posBuf, colBuf;
const audio = new AudioEngine();

// Proxy objects reused every particle call (zero GC)
const _target = new THREE.Vector3();
const _color  = new THREE.Color();

// Current visualization
let currentViz = null;
let vizState   = null;
let vizId      = null;

// addControl system
const _controlValues = new Map();   // "vizId::ctrlId" → float
const _controlEls    = new Map();   // "vizId::ctrlId" → DOM element
let _currentVizId    = null;

// setInfo / annotate
const _hudTitle = () => document.getElementById('hudTitle');
const _hudDesc  = () => document.getElementById('hudDesc');

// ─── addControl implementation ──────────────────────────────────────────
function _addControl(id, label, min, max, initial) {
  const key = `${_currentVizId}::${id}`;

  if (_controlValues.has(key)) return _controlValues.get(key);

  // First call: create slider
  _controlValues.set(key, initial);

  const panel = document.getElementById('controlsPanel');
  const wrap = document.createElement('div');
  wrap.className = 'ctrl';
  wrap.dataset.viz = _currentVizId;

  const lbl = document.createElement('label');
  lbl.textContent = label;

  const inp = document.createElement('input');
  inp.type = 'range';
  inp.min = min;
  inp.max = max;
  inp.step = (max - min) / 200;
  inp.value = initial;
  inp.addEventListener('input', () => {
    _controlValues.set(key, parseFloat(inp.value));
    val.textContent = parseFloat(inp.value).toFixed(2);
  });

  const val = document.createElement('span');
  val.className = 'ctrl-val';
  val.textContent = initial.toFixed(2);

  wrap.appendChild(lbl);
  wrap.appendChild(inp);
  wrap.appendChild(val);
  panel.appendChild(wrap);
  _controlEls.set(key, wrap);

  return initial;
}

function _setInfo(title, desc) {
  const t = _hudTitle();
  const d = _hudDesc();
  if (t) t.textContent = title;
  if (d) d.textContent = desc;
}

function _annotate(_id, _pos, _label) {
  // Simplified: annotations shown as HUD subtitle
  // Full CSS2DRenderer can be added later
}

// ─── Visualization switching ────────────────────────────────────────────
async function switchViz(id) {
  // Stop old viz from running during async load (prevents control leaking)
  currentViz = null;

  // Hide ALL controls, then show only the new viz's
  _controlEls.forEach((el) => { el.style.display = 'none'; });

  _currentVizId = id;
  vizId = id;

  // Load module (cached after first import by Vite)
  const viz = visualizations[id];
  const mod = await viz.module();
  currentViz = mod;

  // Initialize persistent state
  vizState = mod.init ? mod.init(N) : null;

  // Show existing controls for this viz
  _controlEls.forEach((el, key) => {
    el.style.display = key.startsWith(id + '::') ? '' : 'none';
  });

  // Reset HUD
  _setInfo(viz.name, '');
}

// ─── Initialization ─────────────────────────────────────────────────────
async function init() {
  const canvas = document.getElementById('canvas');

  renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x070710);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070710, 0.0022);

  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 2000);
  camera.position.set(0, 40, 280);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping   = true;
  controls.dampingFactor   = 0.05;
  controls.autoRotate      = true;
  controls.autoRotateSpeed = 0.3;

  // Particle geometry
  const geo = new THREE.BufferGeometry();
  posBuf = new Float32Array(N * 3);
  colBuf = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) { posBuf[i] = 0; colBuf[i] = 0.2; }

  geo.setAttribute('position', new THREE.BufferAttribute(posBuf, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colBuf, 3));

  const mat = new THREE.PointsMaterial({
    size:            0.9,
    vertexColors:    true,
    transparent:     true,
    opacity:         0.38,
    sizeAttenuation: true,
    blending:        THREE.AdditiveBlending,
    depthWrite:      false
  });

  points = new THREE.Points(geo, mat);
  scene.add(points);

  // Populate viz selector
  const sel = document.getElementById('vizSelect');
  for (const [id, v] of Object.entries(visualizations)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = v.name;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => switchViz(sel.value));

  // Load first visualization
  const firstId = Object.keys(visualizations)[0];
  sel.value = firstId;
  await switchViz(firstId);

  // Events
  addEventListener('resize', onResize);
  addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  });

  animate();
}

// ─── Per-frame particle update ──────────────────────────────────────────
function updateParticles(time) {
  if (!currentViz) return;

  const af = audio.features;

  // Per-frame simulation step (e.g., Lorenz integration)
  if (currentViz.frame) currentViz.frame(vizState, time, af);

  // Per-particle loop
  const fn = currentViz.particleFn;
  if (!fn) return;

  for (let i = 0; i < N; i++) {
    _target.set(0, 0, 0);
    _color.setRGB(0.2, 0.2, 0.2);

    fn(i, N, _target, _color, time, THREE, _addControl, _setInfo, _annotate, af, vizState);

    const i3 = i * 3;
    posBuf[i3]     = _target.x;
    posBuf[i3 + 1] = _target.y;
    posBuf[i3 + 2] = _target.z;
    colBuf[i3]     = _color.r;
    colBuf[i3 + 1] = _color.g;
    colBuf[i3 + 2] = _color.b;
  }

  points.geometry.attributes.position.needsUpdate = true;
  points.geometry.attributes.color.needsUpdate    = true;
}

// ─── Animation loop ─────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  const t = performance.now() * 0.001;

  audio.update();
  updateParticles(t);

  const af = audio.features;
  controls.autoRotateSpeed = 0.15 + af.rms * 3.5 + af.beat * 5;
  controls.update();
  points.material.size = 0.7 + af.bass * 1.2 + af.beat * 1.5;

  if (audio.isPlaying) updateStatus();

  renderer.render(scene, camera);
}

// ─── Status ─────────────────────────────────────────────────────────────
function updateStatus() {
  const bar = v => {
    const n = Math.round(Math.min(v, 1) * 10);
    return '\u2593'.repeat(n) + '\u2591'.repeat(10 - n);
  };
  const af = audio.features;
  const el = document.getElementById('status');
  el.textContent =
    `B ${bar(af.bass)} M ${bar(af.mid)} H ${bar(af.high)} E ${bar(af.rms)} ${af.beat > 0.3 ? '\u25cf BEAT' : '\u25cb'}`;
}

// ─── UI handlers ────────────────────────────────────────────────────────
window._toggle = async function () {
  const playing = await audio.toggle();
  document.getElementById('playBtn').textContent = playing ? 'Pause' : 'Play';
};

window._loadFile = async function (input) {
  if (!input.files.length) return;
  await audio.loadFile(input.files[0]);
  if (audio.isPlaying) audio.player.start();
};

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}
window._fullscreen = toggleFullscreen;

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

// ─── Boot ───────────────────────────────────────────────────────────────
addEventListener('DOMContentLoaded', init);
