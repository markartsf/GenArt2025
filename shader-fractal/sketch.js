// GLSL Fractal — Audio Reactive (shape-morphing edition)
// Adapted from a p5.js WEBGL shader sketch.
// Audio drives SHAPE / GEOMETRY — animation pace is constant (no dizzying speed changes).
// Mouse: drag to orbit (rotate UV), scroll/vertical drag to zoom.
//
// Fragment shader uniforms:
//   iBass     → per-iteration fold rotation (morphs fractal symmetry group)
//   iMid      → fractal recursion scale (open wide ↔ tight dense folds)
//   iHigh     → palette color position (hue shifts on high-frequency energy)
//   iBeat     → subtle brightness pulse on detected beats
//   iRotation → UV rotation angle from mouse drag
//   iScale    → UV scale for zoom (< 1 = zoomed in, > 1 = zoomed out)
//   iRMS      → (available; currently unused — reserved for future use)

import p5 from 'p5';
import * as Tone from 'tone';

// ─── Audio preload ─────────────────────────────────────────────────────────────
const PRELOAD_SRC = '/clifford-attractor/BreathBetweenCircuits.mp3';

// ─── Audio normalization (calibrated for BreathBetweenCircuits LRA 11.6) ──────
const BASS_NORM       = 1 / 0.18;
const MID_NORM        = 1 / 0.15;
const HIGH_NORM       = 1 / 0.03;
const BEAT_THRESHOLD  = 0.012;
const FLUX_THRESHOLD  = 1.5;
const BEAT_COOLDOWN_F = 10;
const RMS_WIN         = 10;

// ─── Vertex shader (unchanged from original) ──────────────────────────────────
const vertShader = `#ifdef GL_ES
precision highp float;
#endif
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}`;

// ─── Fragment shader (shape-morphing, steady pace) ────────────────────────────
const fragShader = `#ifdef GL_ES
precision highp float;
#endif

uniform vec2  iResolution;
uniform float iTime;

// Audio uniforms (all 0.0–1.0 except iBeat which decays from 1.0)
uniform float iBass;      // bass energy   → per-iteration fold rotation (symmetry morph)
uniform float iMid;       // mid energy    → fractal recursion scale (open ↔ dense)
uniform float iHigh;      // high energy   → palette color position
uniform float iRMS;       // overall level → (reserved — not used for speed)
uniform float iBeat;      // beat pulse    → subtle brightness bump

// Orbit uniforms (mouse controlled)
uniform float iRotation;  // UV rotation angle in radians
uniform float iScale;     // UV scale: <1 zoomed in, >1 zoomed out

varying vec2 vTexCoord;

// Inigo Quilez palette (original formula preserved)
vec3 palette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.263, 0.416, 0.557);
  return sin(a) + cos(b) * cos(6.28318 * (c * cos(t) + sin(d)));
}

void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;   // aspect-ratio correction

  // ── Mouse orbit: scale then rotate ────────────────────────────────────────
  uv *= iScale;
  float cosR = cos(iRotation);
  float sinR = sin(iRotation);
  uv = mat2(cosR, -sinR, sinR, cosR) * uv;

  vec2 uv0 = uv;
  vec3 finalColor = vec3(0.0);

  // ── Steady animation pace — NOT audio driven ───────────────────────────────
  float timePhase = iTime * 0.16;

  // ── Audio drives SHAPE, not speed ─────────────────────────────────────────
  // Bass:  per-iteration fold rotation → morphs fractal symmetry group
  float foldAngle  = iBass * 0.35;
  mat2  foldMat    = mat2(cos(foldAngle), -sin(foldAngle),
                          sin(foldAngle),  cos(foldAngle));

  // Mid:   recursion scale — wide open rings (1.45) → tight dense folds (1.67)
  float fractalScale = 1.45 + iMid * 0.22;

  // High:  palette color position — hue shifts with high-frequency energy
  float colorShift   = iHigh * 3.5;

  // Ring frequency — narrow range keeps rings calm at all energy levels
  float ringFreq     = 6.0 + iBass * 4.0;

  // ── 4-iteration fractal loop ───────────────────────────────────────────────
  for (float i = 0.0; i < 4.0; i++) {
    uv = fract(uv * fractalScale) - 0.5;
    uv = foldMat * uv;                       // bass bends the fold each iteration

    float d = length(uv) * exp(-length(uv0));

    vec3 col = palette(length(uv0) + i * 0.4 + timePhase + colorShift);

    d = sin(d * ringFreq + timePhase) / ringFreq;
    d = abs(d) / 0.4;
    d = pow(0.01 / max(tan(d), 0.0001), 1.2);   // max() guards tan→0 divide

    finalColor += col * d;
  }

  // ── Beat pulse: gentle brightness lift + cool-white tint ──────────────────
  finalColor *= (1.0 + iBeat * 0.45);
  finalColor += vec3(0.02, 0.04, 0.08) * iBeat;

  gl_FragColor = vec4(finalColor, 1.0);
}`;

// ─── p5 sketch (instance mode) ────────────────────────────────────────────────
const sketch = (p) => {
  let theShader;

  // Tone.js audio objects
  let player      = null;
  let waveAnalyzer = null;
  let fftAnalyzer  = null;
  let isPlaying    = false;

  // Smoothed audio features
  let sBass = 0, sMid = 0, sHigh = 0, sRMS = 0, sCentroid = 0;
  let rawRMS = 0, avgRMS = 0;

  // Beat detection state
  let rmsWin       = new Array(RMS_WIN).fill(0);
  let beatFlash    = 0;
  let beatCooldown = 0;
  let beatTimes    = [];
  let estimatedBPM = 120;
  let lastBeatTime = 0;
  let spectralFlux = 0;
  let prevSpectrum = null;

  // Mouse orbit state
  let orbitRotation = 0;
  let orbitScale    = 1.0;
  let prevMX = 0, prevMY = 0;

  // ── Setup ────────────────────────────────────────────────────────────────────
  p.setup = function () {
    const cnv = p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    cnv.parent('canvas-container');
    p.pixelDensity(1);
    p.noStroke();
    theShader = p.createShader(vertShader, fragShader);
    _setupAudio();
  };

  // ── Audio setup ──────────────────────────────────────────────────────────────
  function _setupAudio() {
    waveAnalyzer = new Tone.Analyser('waveform', 1024);
    fftAnalyzer  = new Tone.Analyser('fft', 512);
    _loadTrack(PRELOAD_SRC);

    document.getElementById('playBtn').addEventListener('click', _togglePlay);
    document.getElementById('stopBtn').addEventListener('click', _stop);
    document.getElementById('resetBtn').addEventListener('click', _resetView);
    document.getElementById('audioFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      _setStatus(`Loading ${f.name}...`, 'loading');
      await _loadTrackFromFile(URL.createObjectURL(f), f.name);
    });
    document.getElementById('fullscreenBtn').addEventListener('click', _toggleFullscreen);
  }

  function _loadTrack(url) {
    _setStatus('Loading audio...', 'loading');
    if (player) {
      if (isPlaying) { player.stop(); isPlaying = false; }
      player.dispose();
    }
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
    if (player) {
      if (isPlaying) { player.stop(); isPlaying = false; }
      player.dispose();
    }
    return new Promise((resolve) => {
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
    sBass = sMid = sHigh = sRMS = rawRMS = avgRMS = 0;
    spectralFlux = 0; prevSpectrum = null;
    rmsWin = new Array(RMS_WIN).fill(0);
    beatFlash = 0; beatCooldown = 0;
    _setStatus('Stopped. Press Play.', 'ready');
  }

  function _resetView() {
    orbitRotation = 0;
    orbitScale    = 1.0;
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

  // ── Audio analysis (same pipeline as Clifford attractor) ─────────────────────
  function _readAudio() {
    if (!isPlaying) return;

    const spec = fftAnalyzer.getValue();
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

    const wf = waveAnalyzer.getValue();
    let sq = 0; for (const v of wf) sq += v * v;
    rawRMS = Math.sqrt(sq / wf.length);

    // Per-band smoothing — slow alphas let shape breathe over 2–3 seconds
    // rather than jerking on every transient (bass/mid slowest = gradual morphing)
    sBass += 0.06 * (Math.min(1, rawBass * BASS_NORM) - sBass);
    sMid  += 0.05 * (Math.min(1, rawMid  * MID_NORM)  - sMid);
    sHigh += 0.15 * (Math.min(1, rawHigh * HIGH_NORM) - sHigh);
    sRMS  += 0.08 * (rawRMS - sRMS);

    // Spectral flux — transient detector
    let fluxRaw = 0;
    if (prevSpectrum !== null) {
      for (let i = 0; i < bins; i++)
        fluxRaw += Math.max(0, spec[i] - prevSpectrum[i]);
      fluxRaw /= bins;
    }
    prevSpectrum = Array.from(spec);
    spectralFlux += 0.5 * (fluxRaw - spectralFlux);

    // Beat detection: dual RMS delta + spectral flux
    rmsWin.shift(); rmsWin.push(rawRMS);
    avgRMS = rmsWin.reduce((s, v) => s + v, 0) / RMS_WIN;

    const beatByRMS  = (rawRMS - avgRMS) > BEAT_THRESHOLD;
    const beatByFlux = spectralFlux > FLUX_THRESHOLD;

    if ((beatByRMS || beatByFlux) && beatCooldown <= 0) {
      beatFlash    = 1.0;
      beatCooldown = BEAT_COOLDOWN_F;
      const now = performance.now();
      if (lastBeatTime > 0) {
        const interval = now - lastBeatTime;
        beatTimes.push(interval);
        if (beatTimes.length > 8) beatTimes.shift();
        if (beatTimes.length >= 4) {
          const avgI = beatTimes.reduce((s, v) => s + v, 0) / beatTimes.length;
          estimatedBPM = Math.max(60, Math.min(180, 60000 / avgI));
        }
      }
      lastBeatTime = now;
    }
    beatFlash    *= 0.82;
    beatCooldown  = Math.max(0, beatCooldown - 1);

    // Level meters
    document.getElementById('bassMeter').style.height = (sBass * 100) + '%';
    document.getElementById('midMeter').style.height  = (sMid  * 100) + '%';
    document.getElementById('highMeter').style.height = (sHigh * 100) + '%';

    // Status
    const beatSrc = beatByFlux ? 'F' : (beatByRMS ? 'R' : '-');
    _setStatus(
      `BPM:${Math.round(estimatedBPM)}  RMS:${rawRMS.toFixed(3)}  [${beatSrc}]  B:${sBass.toFixed(2)} M:${sMid.toFixed(2)} H:${sHigh.toFixed(2)}`,
      'ready'
    );
  }

  // ── Draw ─────────────────────────────────────────────────────────────────────
  p.draw = function () {
    _readAudio();

    p.shader(theShader);

    theShader.setUniform('iResolution', [p.width, p.height]);
    theShader.setUniform('iTime',       p.millis() / 1000.0);
    theShader.setUniform('iBass',       sBass);
    theShader.setUniform('iMid',        sMid);
    theShader.setUniform('iHigh',       sHigh);
    theShader.setUniform('iRMS',        sRMS);
    theShader.setUniform('iBeat',       beatFlash);
    theShader.setUniform('iRotation',   orbitRotation);
    theShader.setUniform('iScale',      orbitScale);

    // Full-screen quad
    p.rect(-p.width / 2, -p.height / 2, p.width, p.height);
  };

  // ── Mouse orbit controls ──────────────────────────────────────────────────────
  p.mousePressed = function () {
    prevMX = p.mouseX;
    prevMY = p.mouseY;
  };

  p.mouseDragged = function () {
    const dx = p.mouseX - prevMX;
    const dy = p.mouseY - prevMY;

    orbitRotation += dx * 0.007;           // horizontal drag → rotate
    orbitScale    *= (1 - dy * 0.004);     // vertical drag   → zoom
    orbitScale     = Math.max(0.15, Math.min(6.0, orbitScale));

    prevMX = p.mouseX;
    prevMY = p.mouseY;
  };

  p.doubleClicked = function () {
    _resetView();
  };

  p.mouseWheel = function (event) {
    // scroll up (negative delta) = zoom in (orbitScale shrinks)
    orbitScale *= (1 + event.delta * 0.001);
    orbitScale  = Math.max(0.15, Math.min(6.0, orbitScale));
    return false;   // prevent page scroll
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  p.keyPressed = function () {
    if (p.key === 'f' || p.key === 'F') _toggleFullscreen();
    if (p.key === 'r' || p.key === 'R') _resetView();
  };

  p.windowResized = function () {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };
};

new p5(sketch);
