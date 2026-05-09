import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import * as Tone from 'tone';

// ─── Frame rate cap ───────────────────────────────────────────────────────────
const TARGET_FPS  = 30;
const FRAME_MS    = 1000 / TARGET_FPS;

// ─── Audio tuning ─────────────────────────────────────────────────────────────
const PRELOAD_SRC     = '/lorenz-attractor/GlassHorizon.mp3';
const BASS_NORM       = 1 / 0.15;
const MID_NORM        = 1 / 0.12;
const HIGH_NORM       = 1 / 0.02;
const BEAT_THRESHOLD  = 0.012;
const FLUX_THRESHOLD  = 1.5;
const BEAT_COOLDOWN_F = 10;
const RMS_WIN         = 10;

// ─── Layer 1 — audio-reactive HSL torus ───────────────────────────────────────
// bass → radius, mid → tube, high → warp
const BASE_RADIUS = 66;
const BASE_TUBE   = 14;
const BASE_WARP   = 0.4;
const BASE_SPEED  = 0.6;

// ─── Layer 2 — stylized aurora shader torus ───────────────────────────────────
// high → radius, bass → warp, mid → tube  (complementary to layer 1)
const BASE_RADIUS2 = 66;
const BASE_TUBE2   = 12;
const BASE_WARP2   = 0.5;
const BASE_SPEED2  = 0.45;

// ─── Chromatic aberration post pass (from ParticlesSwarmStylized) ─────────────
const ChromaticShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAmount:  { value: 0.0014 },
    uTime:    { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform float uTime;
    varying vec2 vUv;
    void main(){
      vec2 c = vUv - 0.5;
      float d = dot(c, c);
      float a = uAmount * (1.0 + d * 2.0);
      vec2 dir = normalize(c + 1e-6);
      float r = texture2D(tDiffuse, vUv - dir * a).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv + dir * a).b;
      vec3 col = vec3(r, g, b);
      col *= smoothstep(1.1, 0.2, d * 2.0);
      gl_FragColor = vec4(col, 1.0);
    }
  `
};

// ─── Layer 2 ShaderMaterial — aurora palette ──────────────────────────────────
const AuroraVertexShader = `
  attribute float aEnergy;
  varying float vEnergy;
  varying vec3  vInstanceColor;
  void main(){
    vEnergy = aEnergy;
    #ifdef USE_INSTANCING_COLOR
      vInstanceColor = instanceColor;
    #else
      vInstanceColor = vec3(1.0);
    #endif
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const AuroraFragmentShader = `
  uniform float uTime;
  uniform vec3  uColorA, uColorB, uColorC, uColorD;
  varying float vEnergy;
  varying vec3  vInstanceColor;

  vec3 palette(float t){
    t = clamp(t, 0.0, 1.0);
    if (t < 0.33)      return mix(uColorA, uColorB, t / 0.33);
    else if (t < 0.66) return mix(uColorB, uColorC, (t - 0.33) / 0.33);
    else               return mix(uColorC, uColorD, (t - 0.66) / 0.34);
  }

  void main(){
    float pulse = 0.5 + 0.5 * sin(uTime * 1.7 + vEnergy * 6.2831);
    vec3 grad   = palette(fract(vEnergy + uTime * 0.04));
    vec3 col    = mix(vInstanceColor, grad, 0.35);
    col        *= 0.85 + 0.25 * pulse;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Sketch ───────────────────────────────────────────────────────────────────
class TorusSwarm {
  constructor() {
    this.count = 40000;

    // Smoothed audio
    this.sBass = 0; this.sMid = 0; this.sHigh = 0; this.sRMS = 0;
    this.sCentroid = 0;

    // Beat / flux state
    this.rawRMS = 0; this.avgRMS = 0;
    this.spectralFlux = 0; this.prevSpectrum = null;
    this.rmsWin       = new Array(RMS_WIN).fill(0);
    this.beatFlash    = 0; this.warpBurst = 0;
    this.beatCooldown = 0;
    this.beatTimes    = []; this.lastBeatTime = 0;
    this.estimatedBPM = 120;

    // Visual state
    this.hueShift      = 0;
    this.camAngle      = 0;
    this.camZ          = 100;
    this._lastFrameTime = 0;

    this.isPlaying = false;

    this._setupThree();
    this._setupAudio();
    this._setupControls();
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  // ── Three.js setup ──────────────────────────────────────────────────────────
  _setupThree() {
    const container = document.getElementById('threejs-container');

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.007);

    this.camera = new THREE.PerspectiveCamera(
      60, container.clientWidth / container.clientHeight, 0.1, 2000
    );
    this.camera.position.set(0, 0, 100);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // Post: bloom → chromatic aberration
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      1.8, 0.4, 0
    );
    this.composer.addPass(this.bloomPass);
    this.chromaPass = new ShaderPass(ChromaticShader);
    this.composer.addPass(this.chromaPass);

    // Shared scratch objects — reused across both loops, no allocations
    this.dummy        = new THREE.Object3D();
    this.pColor       = new THREE.Color();
    this.target       = new THREE.Vector3();
    this.pColor2      = new THREE.Color();
    this.target2      = new THREE.Vector3();
    this.lookAtScratch = new THREE.Vector3();

    // ── Layer 1: audio-reactive HSL torus (MeshBasicMaterial) ─────────────────
    const geo1 = new THREE.ConeGeometry(0.1, 0.5, 4).rotateX(Math.PI / 2);
    const mat1 = new THREE.MeshBasicMaterial({ color: 0x00aaff });
    this.mesh = new THREE.InstancedMesh(geo1, mat1, this.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.mesh);

    this.positions = [];
    const ic1 = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      const p = i / this.count;
      const a = p * Math.PI * 2.0 * 20.0;
      const b = (i % 200) / 200 * Math.PI * 2.0;
      const r = BASE_RADIUS + BASE_TUBE * Math.cos(b);
      this.positions.push(new THREE.Vector3(
        r * Math.cos(a), BASE_TUBE * Math.sin(b), r * Math.sin(a)
      ));
      this.mesh.setColorAt(i, ic1.setHSL(p, 1.0, 0.5));
    }
    this.mesh.instanceColor.needsUpdate = true;

    // ── Layer 2: stylized aurora ShaderMaterial torus ──────────────────────────
    // Tilt mesh2 so the two tori clearly intersect rather than coincide
    // — zero per-particle cost, single object matrix op
    this.mesh2Rotation = new THREE.Euler(0.32, 0.18, 0.10);

    const geo2 = new THREE.ConeGeometry(0.12, 0.6, 4).rotateX(Math.PI / 2);

    // Per-instance energy — random, set once, drives the shader pulse
    const energy = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) energy[i] = Math.random();
    geo2.setAttribute('aEnergy', new THREE.InstancedBufferAttribute(energy, 1));

    this.mat2 = new THREE.ShaderMaterial({
      transparent: false,
      blending: THREE.NormalBlending,
      depthWrite: true,
      uniforms: {
        uTime:   { value: 0 },
        uColorA: { value: new THREE.Color('#0a3d8f') }, // deep blue
        uColorB: { value: new THREE.Color('#4be0d0') }, // cyan
        uColorC: { value: new THREE.Color('#ff5fa8') }, // magenta
        uColorD: { value: new THREE.Color('#ffb84d') }, // amber
      },
      vertexShader:   AuroraVertexShader,
      fragmentShader: AuroraFragmentShader,
    });
    this.mat2.defines = { USE_INSTANCING_COLOR: '' };

    this.mesh2 = new THREE.InstancedMesh(geo2, this.mat2, this.count);
    this.mesh2.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh2.rotation.copy(this.mesh2Rotation);
    this.scene.add(this.mesh2);

    this.positions2 = [];
    const ic2 = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      const p = i / this.count;
      const a = p * Math.PI * 2.0 * 20.0;
      const b = (i % 200) / 200 * Math.PI * 2.0;
      const r = BASE_RADIUS2 + BASE_TUBE2 * Math.cos(b);
      this.positions2.push(new THREE.Vector3(
        r * Math.cos(a), BASE_TUBE2 * Math.sin(b), r * Math.sin(a)
      ));
      this.mesh2.setColorAt(i, ic2.setHSL(p, 1.0, 0.5));
    }
    this.mesh2.instanceColor.needsUpdate = true;

    // Orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.clock = new THREE.Clock();
    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    const c = document.getElementById('threejs-container');
    this.camera.aspect = c.clientWidth / c.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(c.clientWidth, c.clientHeight);
    this.composer.setSize(c.clientWidth, c.clientHeight);
  }

  // ── Audio setup ─────────────────────────────────────────────────────────────
  // Using native Web Audio AnalyserNodes instead of Tone.Analyser —
  // Tone.Analyser can silently break the destination chain in Safari.
  // Native nodes are tap-only (no output), so they never touch the speaker path.
  _setupAudio() {
    const rawCtx = Tone.getContext().rawContext;

    this._waveNode = rawCtx.createAnalyser();
    this._waveNode.fftSize = 2048;
    this._waveData = new Float32Array(this._waveNode.fftSize);

    this._fftNode = rawCtx.createAnalyser();
    this._fftNode.fftSize = 1024;
    this._fftData = new Float32Array(this._fftNode.frequencyBinCount); // 512 bins

    Tone.Destination.volume.value = 0;
    Tone.Destination.mute = false;
    this._setStatus('Loading audio...', 'loading');
    this._createPlayer(PRELOAD_SRC);
  }

  _connectAnalysers() {
    // Tap the player's audio output into both native analysers.
    // Tone.js connect() accepts native AudioNodes; analysers have no output
    // so they never interfere with the Tone.Destination → speakers path.
    this.player.connect(this._waveNode);
    this.player.connect(this._fftNode);
  }

  _createPlayer(url) {
    if (this.player) {
      if (this.isPlaying) { this.player.stop(); this.isPlaying = false; }
      this.player.dispose();
      this.player = null;
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
    return new Promise((resolve) => {
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

  // ── Controls ────────────────────────────────────────────────────────────────
  _setupControls() {
    document.getElementById('playBtn').addEventListener('click', () => this._togglePlay());
    document.getElementById('stopBtn').addEventListener('click', () => this._stop());
    document.getElementById('fullscreenBtn').addEventListener('click', () => this._toggleFullscreen());
    document.getElementById('audioFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      this._setStatus(`Loading ${f.name}...`, 'loading');
      document.getElementById('playBtn').disabled = true;
      document.getElementById('stopBtn').disabled = true;
      await this._createPlayerFromFile(URL.createObjectURL(f), f.name);
    });
    document.addEventListener('keydown', (e) => {
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
    this.rmsWin       = new Array(RMS_WIN).fill(0);
    this.beatFlash    = 0; this.warpBurst = 0; this.beatCooldown = 0;
    this.hueShift     = 0;
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

  // ── Audio analysis ──────────────────────────────────────────────────────────
  _readAudio() {
    // Pull fresh data into pre-allocated buffers — no allocations per frame
    this._fftNode.getFloatFrequencyData(this._fftData);   // dB values, same as Tone.Analyser fft
    this._waveNode.getFloatTimeDomainData(this._waveData); // -1..1, same as Tone.Analyser waveform

    const spec = this._fftData;
    const bins = spec.length; // 512
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

    const wf = this._waveData;
    let sq = 0; for (const v of wf) sq += v * v;
    this.rawRMS = Math.sqrt(sq / wf.length);

    const alpha = 0.25;
    this.sBass += alpha * (Math.min(1, rawBass * BASS_NORM) - this.sBass);
    this.sMid  += alpha * (Math.min(1, rawMid  * MID_NORM)  - this.sMid);
    this.sHigh += alpha * (Math.min(1, rawHigh * HIGH_NORM) - this.sHigh);
    this.sRMS  += alpha * (this.rawRMS - this.sRMS);

    // Spectral centroid
    let wSum = 0, magSum = 0;
    for (let i = 0; i < bins; i++) {
      const lin = Math.pow(10, spec[i] / 20);
      wSum += i * lin; magSum += lin;
    }
    const rawCent = magSum > 0 ? wSum / magSum / bins : 0;
    this.sCentroid += alpha * (rawCent - this.sCentroid);

    // Spectral flux — compare current frame to previous
    let fluxRaw = 0;
    if (this.prevSpectrum) {
      for (let i = 0; i < bins; i++) {
        fluxRaw += Math.max(0, spec[i] - this.prevSpectrum[i]);
      }
      fluxRaw /= bins;
    }
    // Save current spectrum into pre-allocated buffer (no Array.from allocation)
    if (!this.prevSpectrum) this.prevSpectrum = new Float32Array(bins);
    this.prevSpectrum.set(this._fftData);
    this.spectralFlux += 0.5 * (fluxRaw - this.spectralFlux);

    // Beat detection — dual RMS delta + spectral flux
    this.rmsWin.shift(); this.rmsWin.push(this.rawRMS);
    this.avgRMS = this.rmsWin.reduce((s, v) => s + v, 0) / RMS_WIN;

    const beatByRMS  = (this.rawRMS - this.avgRMS) > BEAT_THRESHOLD;
    const beatByFlux = this.spectralFlux > FLUX_THRESHOLD;

    if ((beatByRMS || beatByFlux) && this.beatCooldown <= 0) {
      this.beatFlash    = 1.0;
      this.warpBurst    = 1.0;
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
    this.beatFlash    *= 0.85;
    this.warpBurst    *= 0.80;
    this.beatCooldown  = Math.max(0, this.beatCooldown - 1);

    this.hueShift = (this.hueShift + this.sCentroid * 0.003) % 1;

    // Meters
    document.getElementById('bassMeter').style.height = (this.sBass * 100) + '%';
    document.getElementById('midMeter').style.height  = (this.sMid  * 100) + '%';
    document.getElementById('highMeter').style.height = (this.sHigh * 100) + '%';

    const beatSrc = beatByFlux ? 'F' : (beatByRMS ? 'R' : '-');
    this._setStatus(
      `BPM:${Math.round(this.estimatedBPM)}  RMS:${this.rawRMS.toFixed(3)}  [${beatSrc}]  B:${this.sBass.toFixed(2)} M:${this.sMid.toFixed(2)} H:${this.sHigh.toFixed(2)}`,
      'ready'
    );
  }

  // ── Render loop ─────────────────────────────────────────────────────────────
  _animate(timestamp = 0) {
    requestAnimationFrame(this._animate);

    // Frame rate gate — skip render if budget not elapsed
    const elapsed = timestamp - this._lastFrameTime;
    if (elapsed < FRAME_MS) return;
    this._lastFrameTime = timestamp - (elapsed % FRAME_MS);

    if (this.isPlaying) this._readAudio();

    const time = this.clock.getElapsedTime();

    // ── Shared audio params ────────────────────────────────────────────────────
    const bpmFactor = this.estimatedBPM / 120;
    const playing   = this.isPlaying;

    // ── Layer 1 params (bass→radius, mid→tube, high→warp) ─────────────────────
    const speedMult1  = playing ? BASE_SPEED  * bpmFactor * (1 + this.sRMS  * 0.6)  : BASE_SPEED  * 0.25;
    const t1          = time * speedMult1;
    const radius1     = BASE_RADIUS + this.sBass * 38;
    const tube1       = BASE_TUBE   + this.sMid  * 20;
    const warp1       = BASE_WARP   + this.sHigh * 2.8 + this.warpBurst * 9;
    const hueShift    = this.hueShift;
    const beatL1      = this.beatFlash * 0.35;

    // ── Layer 2 params (high→radius, bass→warp, mid→tube) — complementary ─────
    const speedMult2  = playing ? BASE_SPEED2 * bpmFactor * (1 + this.sHigh * 0.5)  : BASE_SPEED2 * 0.25;
    const t2          = time * speedMult2;
    const radius2     = BASE_RADIUS2 + this.sHigh * 30;
    const tube2       = BASE_TUBE2   + this.sMid  * 15;
    const warp2       = BASE_WARP2   + this.sBass * 3.5 + this.warpBurst * 7;
    const beatL2      = this.beatFlash * 0.25;

    // Update shader uniforms
    this.mat2.uniforms.uTime.value    = t2;
    this.chromaPass.uniforms.uTime.value = time;

    // ── Camera orbit — always on, audio boosts speed when playing ─────────────
    this.controls.update();
    this.camAngle += playing
      ? 0.0010 + this.sMid * 0.0020
      : 0.0005;
    const targetCamZ = playing ? 105 - this.sBass * 22 : 105;
    this.camZ += 0.04 * (targetCamZ - this.camZ);
    this.camera.position.set(
      Math.sin(this.camAngle)        * this.camZ * 0.12,
      Math.sin(this.camAngle * 0.55) * this.camZ * 0.06,
      this.camZ
    );
    this.camera.lookAt(0, 0, 0);

    // ── Mesh rotation — each layer spins on different axes ────────────────────
    // Layer 1: slow Y spin, bass nudges speed on beats
    this.mesh.rotation.y += playing
      ? 0.0006 + this.sBass * 0.0018
      : 0.0003;

    // Layer 2: Y + X drift, creating a changing intersection angle over time
    this.mesh2.rotation.y += playing
      ? 0.0009 + this.sHigh * 0.0015
      : 0.0005;
    this.mesh2.rotation.x += playing
      ? 0.0003 + this.sMid  * 0.0008
      : 0.00015;

    // Bloom reacts to beats (both layers share the same bloom pass)
    this.bloomPass.strength = 1.6 + this.beatFlash * 2.8;

    const count = this.count;

    // ── Layer 1 particle loop ─────────────────────────────────────────────────
    for (let i = 0; i < count; i++) {
      const p = i / count;
      const a = p * Math.PI * 2.0 * 20.0;
      const b = (i % 200) / 200 * Math.PI * 2.0;

      const cosA = Math.cos(a), sinA = Math.sin(a);
      const cosB = Math.cos(b), sinB = Math.sin(b);

      const w = Math.sin(a * 0.5 + t1) * warp1 + Math.cos(b * 2.0 + t1) * warp1 * 0.5;
      const r = radius1 + tube1 * cosB + w;

      this.target.set(r * cosA, tube1 * sinB + Math.sin(a + t1) * warp1 * 5.0, r * sinA);

      const hue   = (p + t1 * 0.04 + hueShift) % 1;
      const light = Math.min(0.88, 0.38 + 0.22 * Math.sin(a + t1) + beatL1);
      this.pColor.setHSL(hue, 1.0, light);

      this.positions[i].lerp(this.target, 0.1);
      this.dummy.position.copy(this.positions[i]);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.pColor);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate  = true;

    // ── Layer 2 particle loop ─────────────────────────────────────────────────
    for (let i = 0; i < count; i++) {
      const p = i / count;
      const a = p * Math.PI * 2.0 * 20.0;
      const b = (i % 200) / 200 * Math.PI * 2.0;

      const cosA = Math.cos(a), sinA = Math.sin(a);
      const cosB = Math.cos(b), sinB = Math.sin(b);

      const w2 = Math.sin(a * 0.5 + t2) * warp2 + Math.cos(b * 2.0 + t2) * warp2 * 0.5;
      const r2  = radius2 + tube2 * cosB + w2;

      this.target2.set(r2 * cosA, tube2 * sinB + Math.sin(a + t2) * warp2 * 5.0, r2 * sinA);

      // Stylized color: depth-shifted hue + chroma variation (from ParticlesSwarmStylized)
      const depth  = (this.target2.z + radius2) / (radius2 * 2 + 1e-6);
      const hue2   = (p + t2 * 0.1 + depth * 0.15 + hueShift) % 1;
      const sat2   = 0.85 + 0.15 * Math.cos(b + t2 * 0.6);
      const light2 = Math.min(0.88, 0.50 + 0.20 * Math.sin(a + t2) + beatL2);
      this.pColor2.setHSL(hue2, sat2, light2);

      this.positions2[i].lerp(this.target2, 0.1);
      this.dummy.position.copy(this.positions2[i]);
      // Orient cones toward velocity target ("fish-school" feel from stylized version)
      this.lookAtScratch.copy(this.target2).multiplyScalar(1.05);
      this.dummy.lookAt(this.lookAtScratch);
      this.dummy.updateMatrix();
      this.mesh2.setMatrixAt(i, this.dummy.matrix);
      this.mesh2.setColorAt(i, this.pColor2);
    }
    this.mesh2.instanceMatrix.needsUpdate = true;
    if (this.mesh2.instanceColor) this.mesh2.instanceColor.needsUpdate = true;

    this.composer.render();
  }
}

new TorusSwarm();
