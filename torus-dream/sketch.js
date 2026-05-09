import * as THREE from 'three';
import { EffectComposer }  from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AfterimagePass }  from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { ShaderPass }      from 'three/examples/jsm/postprocessing/ShaderPass.js';
import * as Tone from 'tone';

// ─── Config ───────────────────────────────────────────────────────────────────
const PRELOAD_SRC   = '/lorenz-attractor/GlassHorizon.mp3';
const TARGET_FPS    = 30;
const FRAME_MS      = 1000 / TARGET_FPS;
const COUNT_1       = 80000;   // layer 1 — GPU-computed, essentially free
const COUNT_2       = 40000;   // layer 2 — offset torus
const CANVAS2D_RATE = 3;       // paint Canvas 2D every N render frames (10fps feel)

// Audio tuning
const BASS_NORM       = 1 / 0.15;
const MID_NORM        = 1 / 0.12;
const HIGH_NORM       = 1 / 0.02;
const BEAT_THRESHOLD  = 0.012;
const FLUX_THRESHOLD  = 1.5;
const BEAT_COOLDOWN_F = 10;
const RMS_WIN         = 10;

// ─── GLSL: torus position computed entirely on the GPU ────────────────────────
// aIndex holds the particle's index (0..count-1), position is a dummy vec3.
// Audio drives radius, tube, warp via uniforms — zero JS per-particle work.
const TorusVertexShader = `
  attribute float aIndex;

  uniform float uCount;
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uBeat;
  uniform float uHueShift;
  uniform float uWindings;   // 20 or 21 — separates the two layers visually

  varying vec3  vCol;
  varying float vAlpha;

  // Compact HSL → RGB (no branches, GLSL-safe)
  vec3 hsl2rgb(float h, float s, float l) {
    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
  }

  void main() {
    float idx = aIndex;
    float p   = idx / uCount;

    float a = p * 6.28318530718 * uWindings;
    float b = mod(idx, 200.0) / 200.0 * 6.28318530718;

    float radius = 66.0 + uBass * 38.0;
    float tube   = 14.0 + uMid  * 20.0;
    float warp   = 0.40 + uHigh * 2.8 + uBeat * 9.0;

    float t = uTime;
    float w = sin(a * 0.5 + t) * warp + cos(b * 2.0 + t) * warp * 0.5;
    float r = radius + tube * cos(b) + w;

    vec3 pos = vec3(
      r * cos(a),
      tube * sin(b) + sin(a + t) * warp * 5.0,
      r * sin(a)
    );

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

    // Perspective point size — particles recede naturally
    float ptSize = (1.6 + uBass * 1.8) * (240.0 / max(1.0, gl_Position.w));
    gl_PointSize = clamp(ptSize, 0.5, 7.0);

    // Full-saturation palette, same range as torus-swarm — blending handles softness
    float hue = mod(p + t * 0.04 + uHueShift, 1.0);
    float sat = 0.80 + 0.18 * sin(b + t * 0.35);
    float lit = clamp(0.40 + 0.24 * sin(a + t) + uBeat * 0.18, 0.0, 0.82);
    vCol   = hsl2rgb(hue, sat, lit);
    vAlpha = 0.72 + uBeat * 0.20;
  }
`;

const TorusFragmentShader = `
  varying vec3  vCol;
  varying float vAlpha;

  void main() {
    // Soft circular disc — smooth edge for a painted, non-digital feel
    vec2  uv   = gl_PointCoord - 0.5;
    float d    = length(uv);
    if (d > 0.5) discard;
    float soft = 1.0 - smoothstep(0.25, 0.5, d);
    gl_FragColor = vec4(vCol, vAlpha * soft);
  }
`;

// ─── GLSL: film grain + vignette + sepia + gate wobble ───────────────────────
const FilmShader = {
  uniforms: {
    tDiffuse:  { value: null },
    uTime:     { value: 0 },
    uGrain:    { value: 0.065 },
    uSepia:    { value: 0.22 },
    uVignette: { value: 2.8 },
    uFlicker:  { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uSepia;
    uniform float uVignette;
    uniform float uFlicker;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      // Subtle gate wobble — horizontal instability like a projector
      vec2 uv = vUv;
      uv.x += sin(uv.y * 550.0 + uTime * 6.0) * 0.00035;

      vec4 col = texture2D(tDiffuse, uv);

      // Film grain — unique per frame via time seed
      float g = rand(uv * 1.8 + fract(uTime * 47.3));
      col.rgb += (g - 0.5) * uGrain;

      // Vignette — warm darkening at edges
      vec2 vc = uv - 0.5;
      float v = 1.0 - dot(vc, vc) * uVignette;
      col.rgb *= max(0.0, v);

      // Sepia tint — desaturates toward warm tone
      float luma = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      vec3 sepia = vec3(luma * 1.08, luma * 0.88, luma * 0.66);
      col.rgb = mix(col.rgb, sepia, uSepia);

      // Projector flicker
      col.rgb *= uFlicker;

      gl_FragColor = clamp(col, 0.0, 1.0);
    }
  `
};

// ─── Helper: build a Points geometry with aIndex attribute ────────────────────
function makeTorusGeo(count) {
  const indices = new Float32Array(count);
  for (let i = 0; i < count; i++) indices[i] = i;

  const geo = new THREE.BufferGeometry();
  // Dummy position — Three.js needs it; shader ignores it for placement
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aIndex',   new THREE.BufferAttribute(indices, 1));
  // Fixed bounding sphere so frustum culling never hides particles
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
  return geo;
}

// ─── Helper: build the shared ShaderMaterial for a torus layer ───────────────
function makeTorusMat(windings) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCount:    { value: 1 },
      uTime:     { value: 0 },
      uBass:     { value: 0 },
      uMid:      { value: 0 },
      uHigh:     { value: 0 },
      uBeat:     { value: 0 },
      uHueShift: { value: 0 },
      uWindings: { value: windings },
    },
    vertexShader:   TorusVertexShader,
    fragmentShader: TorusFragmentShader,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.NormalBlending,
  });
}

// ─── Main sketch class ────────────────────────────────────────────────────────
class DreamTorus {
  constructor() {
    // Audio state
    this.sBass = 0; this.sMid = 0; this.sHigh = 0; this.sRMS = 0;
    this.sCentroid = 0;
    this.rawRMS = 0; this.avgRMS = 0;
    this.spectralFlux = 0; this.prevSpectrum = null;
    this.rmsWin       = new Array(RMS_WIN).fill(0);
    this.beatFlash    = 0; this.warpBurst = 0; this.beatCooldown = 0;
    this.beatTimes    = []; this.lastBeatTime = 0;
    this.estimatedBPM = 120;
    this.hueShift     = 0;
    this.isPlaying    = false;

    // Timing
    this._lastFrameTime = 0;
    this._canvas2dFrame = 0;
    this.camAngle       = 0;

    this._setupThree();
    this._setupCanvas2D();
    this._setupAudio();
    this._setupControls();
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  // ── Three.js ──────────────────────────────────────────────────────────────
  _setupThree() {
    const container = document.getElementById('threejs-container');

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.005);

    this.camera = new THREE.PerspectiveCamera(
      60, container.clientWidth / container.clientHeight, 0.1, 2000
    );
    this.camera.position.set(0, 20, 120);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x000000, 1);
    container.appendChild(this.renderer.domElement);

    // ── Layer 1: main torus (80k points, bass→radius, mid→tube, high→warp) ──
    this.mat1   = makeTorusMat(20);
    const geo1  = makeTorusGeo(COUNT_1);
    this.mat1.uniforms.uCount.value = COUNT_1;
    this.points1 = new THREE.Points(geo1, this.mat1);
    this.points1.frustumCulled = false;
    this.scene.add(this.points1);

    // ── Layer 2: offset torus (40k points, complementary audio mapping) ──────
    // Same winding count — initial rotation already creates the visual offset
    this.mat2   = makeTorusMat(20);
    const geo2  = makeTorusGeo(COUNT_2);
    this.mat2.uniforms.uCount.value = COUNT_2;
    this.points2 = new THREE.Points(geo2, this.mat2);
    this.points2.frustumCulled = false;
    this.points2.rotation.set(0.32, 0.18, 0.10);
    this.scene.add(this.points2);

    // ── Post-processing: bloom → afterimage → film ────────────────────────────
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.35, 0.5, 0.60   // strength, radius, threshold — very restrained
    );
    this.composer.addPass(this.bloomPass);

    // Afterimage: dreamy trail — damp 0.88 is gentler than 0.92, won't blow out
    this.afterPass = new AfterimagePass(0.88);
    this.composer.addPass(this.afterPass);

    // Film grain + vignette + sepia + gate wobble
    this.filmPass = new ShaderPass(FilmShader);
    this.composer.addPass(this.filmPass);

    this.clock = new THREE.Clock();
    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    const c = document.getElementById('threejs-container');
    this.camera.aspect = c.clientWidth / c.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(c.clientWidth, c.clientHeight);
    this.composer.setSize(c.clientWidth, c.clientHeight);
    this.canvas2d.width  = c.clientWidth;
    this.canvas2d.height = c.clientHeight;
  }

  // ── Canvas 2D light-leak overlay ─────────────────────────────────────────
  _setupCanvas2D() {
    this.canvas2d = document.getElementById('canvas2d-overlay');
    const c = document.getElementById('threejs-container');
    this.canvas2d.width  = c.clientWidth;
    this.canvas2d.height = c.clientHeight;
    this.ctx2d = this.canvas2d.getContext('2d');
  }

  // Painted every CANVAS2D_RATE frames — gives a ~10fps "old film" quality.
  // CSS mix-blend-mode: screen blends these warm blobs additively over WebGL.
  _drawCanvas2D(time) {
    const ctx = this.ctx2d;
    const w   = this.canvas2d.width;
    const h   = this.canvas2d.height;

    // Slow fade rather than full clear — accumulation adds soft depth
    ctx.fillStyle = 'rgba(0, 0, 0, 0.055)';
    ctx.fillRect(0, 0, w, h);

    // Primary light leak — warm amber, drifts with bass
    const lx = w * 0.5 + Math.sin(time * 0.11) * w * 0.28 * (1 + this.sBass * 0.4);
    const ly = h * 0.32 + Math.cos(time * 0.17) * h * 0.14;
    const lr = w * (0.18 + this.sBass * 0.28);
    const g1 = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
    g1.addColorStop(0, `hsla(38, 75%, 62%, ${0.028 + this.sBass * 0.038})`);
    g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);

    // Secondary leak — cooler violet, driven by highs
    const hx = w * 0.5 + Math.sin(time * 0.08 + 2.1) * w * 0.22;
    const hy = h * 0.68 + Math.cos(time * 0.13 + 1.3) * h * 0.18;
    const hr = w * (0.12 + this.sHigh * 0.18);
    const g2 = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
    g2.addColorStop(0, `hsla(270, 50%, 55%, ${0.018 + this.sHigh * 0.028})`);
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);

    // Dust mote — random tiny bright speck
    if (Math.random() < 0.25) {
      ctx.fillStyle = `rgba(255, 248, 230, ${Math.random() * 0.12})`;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 1.2 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Occasional thin vertical scratch
    if (Math.random() < 0.04) {
      const sx = Math.random() * w;
      ctx.strokeStyle = `rgba(255, 245, 210, ${Math.random() * 0.06})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx + (Math.random() - 0.5) * 3, h);
      ctx.stroke();
    }
  }

  // ── Audio setup ──────────────────────────────────────────────────────────
  // Use Tone.Analyser (Tone-native nodes) — reliable cross-browser,
  // confirmed working in torus-swarm. Tone handles AudioContext state internally.
  _setupAudio() {
    this.analyzer    = new Tone.Analyser('waveform', 2048);
    this.fftAnalyzer = new Tone.Analyser('fft', 1024);

    Tone.Destination.volume.value = 0;
    Tone.Destination.mute = false;
    this._setStatus('Loading audio...', 'loading');
    this._createPlayer(PRELOAD_SRC);
  }

  _connectAnalysers() {
    this.player.connect(this.analyzer);
    this.player.connect(this.fftAnalyzer);
  }

  _createPlayer(url) {
    if (this.player) {
      if (this.isPlaying) { this.player.stop(); this.isPlaying = false; }
      this.player.dispose(); this.player = null;
    }
    this.player = new Tone.Player(url, () => {
      document.getElementById('playBtn').disabled = false;
      document.getElementById('stopBtn').disabled = false;
      this._setStatus('Ready — Press Play.', 'ready');
    }).toDestination();
    this.player.volume.value = 0;
    this.player.loop = true;
    this._connectAnalysers();
  }

  _createPlayerFromFile(url, name) {
    return new Promise(resolve => {
      if (this.player) {
        if (this.isPlaying) { this.player.stop(); this.isPlaying = false; }
        this.player.dispose(); this.player = null;
      }
      this.player = new Tone.Player(url, () => {
        document.getElementById('playBtn').disabled = false;
        document.getElementById('stopBtn').disabled = false;
        this._setStatus(`Ready — ${name}. Press Play.`, 'ready');
        resolve();
      }).toDestination();
      this.player.volume.value = 0;
      this.player.loop = true;
      this._connectAnalysers();
    });
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  _setupControls() {
    document.getElementById('playBtn').addEventListener('click', () => this._togglePlay());
    document.getElementById('stopBtn').addEventListener('click', () => this._stop());
    document.getElementById('fullscreenBtn').addEventListener('click', () => this._toggleFullscreen());
    document.getElementById('audioFile').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      document.getElementById('playBtn').disabled = true;
      document.getElementById('stopBtn').disabled = true;
      this._setStatus(`Loading ${f.name}...`, 'loading');
      await this._createPlayerFromFile(URL.createObjectURL(f), f.name);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'f' || e.key === 'F') this._toggleFullscreen();
    });
  }

  async _togglePlay() {
    if (!this.player) return;
    if (this.isPlaying) {
      this.player.stop(); this.isPlaying = false;
      document.getElementById('playBtn').textContent = 'Play';
    } else {
      await Tone.start();
      await Tone.getContext().resume();
      Tone.Destination.mute = false;
      this.player.start(); this.isPlaying = true;
      document.getElementById('playBtn').textContent = 'Pause';
    }
  }

  _stop() {
    if (!this.player) return;
    this.player.stop(); this.isPlaying = false;
    document.getElementById('playBtn').textContent = 'Play';
    this.sBass = this.sMid = this.sHigh = this.sRMS = 0;
    this.rawRMS = 0; this.avgRMS = 0;
    this.spectralFlux = 0; this.prevSpectrum = null;
    this.rmsWin    = new Array(RMS_WIN).fill(0);
    this.beatFlash = 0; this.warpBurst = 0; this.beatCooldown = 0;
    this.hueShift  = 0;
    this._setStatus('Stopped. Press Play.', 'ready');
  }

  _toggleFullscreen() {
    const el = document.getElementById('container');
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  }

  _setStatus(msg, cls) {
    const el = document.getElementById('status');
    el.textContent = msg; el.className = cls || '';
  }

  // ── Audio analysis ────────────────────────────────────────────────────────
  _readAudio() {
    const spec = this.fftAnalyzer.getValue(); // Float32Array of dB values, 512 bins
    const wf   = this.analyzer.getValue();    // Float32Array -1..1 waveform
    const bins = spec.length;
    const bEnd = Math.floor(bins * 0.10);
    const mEnd = Math.floor(bins * 0.50);

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

    let sq = 0; for (const v of wf) sq += v * v;
    this.rawRMS = Math.sqrt(sq / wf.length);

    // Higher alpha = faster audio response, less smoothing lag.
    // Rise fast (0.5) on upward transients, fall slower (0.18) for natural decay.
    const alphaRise = 0.50;
    const alphaFall = 0.18;
    const newBass = Math.min(1, rawBass * BASS_NORM);
    const newMid  = Math.min(1, rawMid  * MID_NORM);
    const newHigh = Math.min(1, rawHigh * HIGH_NORM);
    this.sBass += (newBass > this.sBass ? alphaRise : alphaFall) * (newBass - this.sBass);
    this.sMid  += (newMid  > this.sMid  ? alphaRise : alphaFall) * (newMid  - this.sMid);
    this.sHigh += (newHigh > this.sHigh ? alphaRise : alphaFall) * (newHigh - this.sHigh);
    this.sRMS  += alphaRise * (this.rawRMS - this.sRMS);

    let wSum = 0, magSum = 0;
    for (let i = 0; i < bins; i++) {
      const lin = Math.pow(10, spec[i] / 20);
      wSum += i * lin; magSum += lin;
    }
    this.sCentroid += alphaFall * ((magSum > 0 ? wSum / magSum / bins : 0) - this.sCentroid);

    let fluxRaw = 0;
    if (this.prevSpectrum) {
      for (let i = 0; i < bins; i++) fluxRaw += Math.max(0, spec[i] - this.prevSpectrum[i]);
      fluxRaw /= bins;
    }
    if (!this.prevSpectrum) this.prevSpectrum = new Float32Array(bins);
    this.prevSpectrum.set(spec);
    this.spectralFlux += 0.5 * (fluxRaw - this.spectralFlux);

    this.rmsWin.shift(); this.rmsWin.push(this.rawRMS);
    this.avgRMS = this.rmsWin.reduce((s, v) => s + v, 0) / RMS_WIN;

    const beatByRMS  = (this.rawRMS - this.avgRMS) > BEAT_THRESHOLD;
    const beatByFlux = this.spectralFlux > FLUX_THRESHOLD;

    if ((beatByRMS || beatByFlux) && this.beatCooldown <= 0) {
      this.beatFlash = 1.0; this.warpBurst = 1.0;
      this.beatCooldown = BEAT_COOLDOWN_F;
      const now = performance.now();
      if (this.lastBeatTime > 0) {
        const interval = now - this.lastBeatTime;
        this.beatTimes.push(interval);
        if (this.beatTimes.length > 8) this.beatTimes.shift();
        if (this.beatTimes.length >= 4) {
          const avg = this.beatTimes.reduce((s, v) => s + v, 0) / this.beatTimes.length;
          this.estimatedBPM = Math.max(60, Math.min(180, 60000 / avg));
        }
      }
      this.lastBeatTime = now;
    }
    this.beatFlash    *= 0.84;
    this.warpBurst    *= 0.78;
    this.beatCooldown  = Math.max(0, this.beatCooldown - 1);
    this.hueShift      = (this.hueShift + this.sCentroid * 0.003) % 1;

    document.getElementById('bassMeter').style.height = (this.sBass * 100) + '%';
    document.getElementById('midMeter').style.height  = (this.sMid  * 100) + '%';
    document.getElementById('highMeter').style.height = (this.sHigh * 100) + '%';

    const beatSrc = this.spectralFlux > FLUX_THRESHOLD ? 'F' : (beatByRMS ? 'R' : '-');
    this._setStatus(
      `BPM:${Math.round(this.estimatedBPM)}  [${beatSrc}]  B:${this.sBass.toFixed(2)} M:${this.sMid.toFixed(2)} H:${this.sHigh.toFixed(2)}`,
      'ready'
    );
  }

  // ── Render loop ───────────────────────────────────────────────────────────
  _animate(timestamp = 0) {
    requestAnimationFrame(this._animate);

    const elapsed = timestamp - this._lastFrameTime;
    if (elapsed < FRAME_MS) return;
    this._lastFrameTime = timestamp - (elapsed % FRAME_MS);

    if (this.isPlaying) this._readAudio();

    const time    = this.clock.getElapsedTime();
    const playing = this.isPlaying;
    const bpm     = this.estimatedBPM / 120;

    // ── Camera drift — always moving, audio speeds it up ────────────────────
    this.camAngle += playing ? 0.0009 + this.sMid * 0.0018 : 0.0004;
    const tCamZ    = playing ? 120 - this.sBass * 20 : 120;
    this.camera.position.set(
      Math.sin(this.camAngle)        * (tCamZ * 0.12),
      20 + Math.sin(this.camAngle * 0.5) * (tCamZ * 0.06),
      tCamZ
    );
    this.camera.lookAt(0, 0, 0);

    // ── Mesh rotation — visible even without audio ────────────────────────────
    this.points1.rotation.y += playing ? 0.0012 + this.sBass * 0.0020 : 0.0006;
    this.points2.rotation.y += playing ? 0.0018 + this.sHigh * 0.0018 : 0.0009;
    this.points2.rotation.x += playing ? 0.0006 + this.sMid  * 0.0012 : 0.0003;

    // ── Layer 1 uniforms — bass→radius, mid→tube, high→warp ─────────────────
    const speed1 = playing ? 0.55 * bpm * (1 + this.sRMS * 0.5) : 0.14;
    this.mat1.uniforms.uTime.value     = time * speed1;
    this.mat1.uniforms.uBass.value     = this.sBass;
    this.mat1.uniforms.uMid.value      = this.sMid;
    this.mat1.uniforms.uHigh.value     = this.sHigh;
    this.mat1.uniforms.uBeat.value     = this.warpBurst;
    this.mat1.uniforms.uHueShift.value = this.hueShift;

    // ── Layer 2 uniforms — high→radius, bass→warp (complementary) ────────────
    const speed2 = playing ? 0.42 * bpm * (1 + this.sHigh * 0.45) : 0.11;
    // Swap which audio band drives which param by remapping into the same uniforms
    this.mat2.uniforms.uTime.value     = time * speed2;
    this.mat2.uniforms.uBass.value     = this.sHigh;   // high drives radius on layer 2
    this.mat2.uniforms.uMid.value      = this.sMid;
    this.mat2.uniforms.uHigh.value     = this.sBass;   // bass drives warp on layer 2
    this.mat2.uniforms.uBeat.value     = this.warpBurst;
    this.mat2.uniforms.uHueShift.value = (this.hueShift + 0.45) % 1; // offset hue

    // ── Bloom pulses on beats — kept subtle so it reads as warmth, not flare ──
    this.bloomPass.strength = 0.35 + this.beatFlash * 0.65;

    // ── Afterimage damp — ease off during loud passages for crispness ─────────
    this.afterPass.uniforms.damp.value = 0.88 - this.sRMS * 0.06;

    // ── Film shader — grain and flicker vary per frame ────────────────────────
    this.filmPass.uniforms.uTime.value    = time;
    this.filmPass.uniforms.uFlicker.value = 0.97 + Math.random() * 0.06;

    // ── Canvas 2D — painted at ~10fps for old-film quality ───────────────────
    this._canvas2dFrame++;
    if (this._canvas2dFrame >= CANVAS2D_RATE) {
      this._canvas2dFrame = 0;
      this._drawCanvas2D(time);
    }

    this.composer.render();
  }
}

new DreamTorus();
