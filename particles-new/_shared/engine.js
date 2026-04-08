// Standalone single-viz particle engine.
// Usage: import { startEngine } from '../_shared/engine.js';
//        import * as viz from './sketch.js';
//        startEngine(viz);

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AudioEngine } from './audio.js';

const N = 25000;

export function startEngine(viz) {
  const _run = () => {
    const canvas = document.getElementById('canvas');

    // ── Three.js setup ────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x070710);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070710, 0.0018);

    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 2000);
    camera.position.set(0, 40, 280);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.05;
    controls.autoRotate      = true;
    controls.autoRotateSpeed = 0.3;

    // ── Particle geometry ─────────────────────────────────────────────────
    const geo    = new THREE.BufferGeometry();
    const posBuf = new Float32Array(N * 3);
    const colBuf = new Float32Array(N * 3);
    for (let k = 0; k < N * 3; k++) colBuf[k] = 0.08;
    geo.setAttribute('position', new THREE.BufferAttribute(posBuf, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colBuf, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.9, vertexColors: true, transparent: true,
      opacity: 0.38, sizeAttenuation: true,
      blending: THREE.AdditiveBlending, depthWrite: false
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // ── Audio engine ──────────────────────────────────────────────────────
    const audio = new AudioEngine();

    // ── Proxy objects — zero GC in hot loop ──────────────────────────────
    const _target = new THREE.Vector3();
    const _color  = new THREE.Color();

    // ── addControl ────────────────────────────────────────────────────────
    const _ctrlValues = new Map();
    function _addControl(id, label, min, max, initial) {
      if (_ctrlValues.has(id)) return _ctrlValues.get(id);
      _ctrlValues.set(id, initial);
      const panel = document.getElementById('controlsPanel');
      const wrap = document.createElement('div'); wrap.className = 'ctrl';
      const lbl = document.createElement('label'); lbl.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = min; inp.max = max;
      inp.step = (max - min) / 200; inp.value = initial;
      const val = document.createElement('span'); val.className = 'ctrl-val';
      val.textContent = parseFloat(initial).toFixed(2);
      inp.addEventListener('input', () => {
        _ctrlValues.set(id, parseFloat(inp.value));
        val.textContent = parseFloat(inp.value).toFixed(2);
      });
      wrap.appendChild(lbl); wrap.appendChild(inp); wrap.appendChild(val);
      panel.appendChild(wrap);
      return initial;
    }

    function _setInfo(title, desc) {
      const t = document.getElementById('hudTitle');
      const d = document.getElementById('hudDesc');
      if (t) t.textContent = title;
      if (d) d.textContent = desc;
    }

    function _annotate() {} // simplified

    // ── Initialize viz ────────────────────────────────────────────────────
    const vizState = viz.init ? viz.init(N) : null;
    if (viz.name) _setInfo(viz.name, viz.description || '');
    if (viz.name) document.title = viz.name;

    // ── Animation loop ────────────────────────────────────────────────────
    function animate() {
      requestAnimationFrame(animate);
      const t = performance.now() * 0.001;

      audio.update();
      const af = audio.features;

      if (viz.frame) viz.frame(vizState, t, af);

      if (viz.particleFn) {
        for (let i = 0; i < N; i++) {
          _target.set(0, 0, 0);
          _color.setRGB(0.08, 0.08, 0.08);
          viz.particleFn(i, N, _target, _color, t, THREE, _addControl, _setInfo, _annotate, af, vizState);
          const i3 = i * 3;
          posBuf[i3]     = _target.x;
          posBuf[i3 + 1] = _target.y;
          posBuf[i3 + 2] = _target.z;
          colBuf[i3]     = _color.r;
          colBuf[i3 + 1] = _color.g;
          colBuf[i3 + 2] = _color.b;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate    = true;
      }

      controls.autoRotateSpeed = 0.15 + af.rms * 3.5 + af.beat * 5;
      controls.update();
      mat.size = 0.7 + af.bass * 1.2 + af.beat * 1.5;

      if (audio.isPlaying) _updateStatus(af);

      renderer.render(scene, camera);
    }

    function _updateStatus(af) {
      const bar = v => {
        const n = Math.round(Math.min(v, 1) * 10);
        return '\u2593'.repeat(n) + '\u2591'.repeat(10 - n);
      };
      const el = document.getElementById('status');
      if (el) el.textContent =
        `B ${bar(af.bass)} M ${bar(af.mid)} H ${bar(af.high)} E ${bar(af.rms)} ${af.beat > 0.3 ? '\u25cf BEAT' : '\u25cb'}`;
    }

    // ── UI handlers ───────────────────────────────────────────────────────
    window._toggle = async () => {
      const playing = await audio.toggle();
      document.getElementById('playBtn').textContent = playing ? 'Pause' : 'Play';
    };

    window._loadFile = async (input) => {
      if (!input.files.length) return;
      await audio.loadFile(input.files[0]);
      if (audio.isPlaying) audio.player.start();
    };

    window._fullscreen = () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    };

    addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });

    addEventListener('keydown', e => {
      if (e.key === 'f' || e.key === 'F') window._fullscreen();
    });

    animate();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _run);
  } else {
    _run();
  }
}
