import * as Tone from 'tone';

// Disable p5 friendly errors for performance
p5.disableFriendlyErrors = true;

// Global variables
let palette = [];
let motif;
let backgroundColor = '#0f0f0f';

// Audio
let player = null;
let compressor = null;
let bassMeter, midLowMeter, midHighMeter, highMeter;
let bassFilter, midLowFilter, midHighFilter, highFilter;
let isPlaying = false;

let audioFeatures = {
  bass: 0,
  midLow: 0,      // Violin 250-800Hz
  midHigh: 0,     // Pluck synth 800-2000Hz
  high: 0
};

// p5.js setup
window.setup = function() {
  const container = document.getElementById('canvas-container');
  const canvas = createCanvas(container.clientWidth, container.clientHeight, WEBGL);
  canvas.parent('canvas-container');

  angleMode(RADIANS);
  rectMode(CENTER);
  ellipseMode(CENTER);
  textAlign(CENTER, CENTER);
  pixelDensity(1);
  smooth();
  frameRate(30);
  noStroke();

  setupAudio();
  setupControls();
  init();

  // Handle window resize and fullscreen changes
  window.addEventListener('resize', handleResize);
  document.addEventListener('fullscreenchange', handleResize);
  document.addEventListener('webkitfullscreenchange', handleResize);
  document.addEventListener('mozfullscreenchange', handleResize);
}

function handleResize() {
  const container = document.getElementById('canvas-container');
  resizeCanvas(container.clientWidth, container.clientHeight);
  initCamera();
}

function setupAudio() {
  // Compressor to boost quiet audio
  compressor = new Tone.Compressor({
    threshold: -24,
    ratio: 4,
    attack: 0.003,
    release: 0.1
  });

  // Meters for each frequency band
  bassMeter = new Tone.Meter({ smoothing: 0.8 });
  midLowMeter = new Tone.Meter({ smoothing: 0.8 });
  midHighMeter = new Tone.Meter({ smoothing: 0.8 });
  highMeter = new Tone.Meter({ smoothing: 0.8 });

  // Filters
  bassFilter = new Tone.Filter({ frequency: 250, type: 'lowpass' });
  midLowFilter = new Tone.Filter({ frequency: 800, type: 'bandpass', Q: 1 });
  midHighFilter = new Tone.Filter({ frequency: 1400, type: 'bandpass', Q: 1 });
  highFilter = new Tone.Filter({ frequency: 2000, type: 'highpass' });

  // Connect compressor to filtered meters
  compressor.connect(bassFilter);
  bassFilter.connect(bassMeter);

  compressor.connect(midLowFilter);
  midLowFilter.connect(midLowMeter);

  compressor.connect(midHighFilter);
  midHighFilter.connect(midHighMeter);

  compressor.connect(highFilter);
  highFilter.connect(highMeter);

  // Connect to destination
  compressor.toDestination();
}

function setupControls() {
  const audioFileInput = document.getElementById('audioFile');
  const playPauseBtn = document.getElementById('playPause');
  const stopBtn = document.getElementById('stop');
  const resetBtn = document.getElementById('reset');
  const fullscreenBtn = document.getElementById('fullscreen');
  const statusText = document.getElementById('status');

  audioFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      statusText.textContent = 'Loading audio...';

      try {
        if (player) {
          player.stop();
          player.dispose();
        }

        const url = URL.createObjectURL(file);
        player = new Tone.Player(url);
        player.connect(compressor);

        await Tone.loaded();

        playPauseBtn.disabled = false;
        stopBtn.disabled = false;
        statusText.textContent = `✓ Audio loaded: ${file.name}`;
      } catch (error) {
        console.error('Error loading audio:', error);
        statusText.textContent = '✗ Error loading audio file';
      }
    }
  });

  playPauseBtn.addEventListener('click', async () => {
    if (!player) return;

    if (isPlaying) {
      player.stop();
      isPlaying = false;
      playPauseBtn.textContent = 'Play';
      statusText.textContent = 'Paused';
    } else {
      await Tone.start();
      player.start();
      isPlaying = true;
      playPauseBtn.textContent = 'Pause';
      statusText.textContent = '▶ Playing...';
    }
  });

  stopBtn.addEventListener('click', () => {
    if (player) {
      player.stop();
      isPlaying = false;
      playPauseBtn.textContent = 'Play';
      statusText.textContent = 'Stopped';
      resetAudioFeatures();
    }
  });

  resetBtn.addEventListener('click', () => {
    // Show visual feedback
    statusText.textContent = 'Resetting...';

    // Delay slightly to allow UI to update
    setTimeout(() => {
      init();
      statusText.textContent = 'Reset complete! (R key)';
    }, 50);
  });

  fullscreenBtn.addEventListener('click', () => {
    const container = document.getElementById('container');
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
      statusText.textContent = 'Resetting...';
      setTimeout(() => {
        init();
        statusText.textContent = 'Reset! (R key)';
      }, 50);
    }
  });
}

function initCamera() {
  ortho(-width, width, -height, height, -10000, 10000);
  // Closer camera for larger view
  const d = 600;
  camera(d, -d, d, 0, 0, 0, 0, 1, 0);
}

function init() {
  initCamera();

  // Fall color palette (matching our previous projects)
  const orgPalette = {
    colors: [
      '#D9A84E', // Cadmium Yellow
      '#D9534F', // Naphthol Red
      '#E67E50', // Cadmium Orange
      '#8B1A1A', // Dark Red
      '#8B2252', // Burgundy
      '#8B4513', // Dark Brown
      '#CC8033', // Neutral Orange
      '#F0DC82', // Yellow
    ]
  };

  palette = repeatPalette(orgPalette, 1);

  // RANDOMIZE BACKGROUND COLOR on each reset
  backgroundColor = palette.colors[randomInt(0, palette.colors.length - 1)];
  // Darken the background color
  const bgColor = color(backgroundColor);
  backgroundColor = color(
    hue(bgColor),
    saturation(bgColor),
    brightness(bgColor) * 0.15 // Much darker
  );

  motif = new Motif({
    originX: 0,
    originY: 0,
    originZ: 0,
  });
}

function updateAudioFeatures() {
  if (!isPlaying) return;

  // Get meter values
  const bassDb = bassMeter.getValue();
  const midLowDb = midLowMeter.getValue();
  const midHighDb = midHighMeter.getValue();
  const highDb = highMeter.getValue();

  // Convert dB to linear 0-1 range
  const dbToLinear = (db) => Math.max(0, (db + 60) / 60);

  audioFeatures.bass = dbToLinear(bassDb);
  audioFeatures.midLow = dbToLinear(midLowDb);
  audioFeatures.midHigh = dbToLinear(midHighDb);
  audioFeatures.high = dbToLinear(highDb);
}

function resetAudioFeatures() {
  audioFeatures.bass = 0;
  audioFeatures.midLow = 0;
  audioFeatures.midHigh = 0;
  audioFeatures.high = 0;
}

window.draw = function() {
  background(backgroundColor);
  orbitControl();

  updateAudioFeatures();

  if (motif) {
    motif.run();
  }
}

// ============================================
// GRADIENT SHADER CLASS
// ============================================

const vertShader = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;
}
`;

const flexibleFragShader = `
precision mediump float;
varying vec2 vTexCoord;

uniform float uTime;
uniform float uGradientType;
uniform float uAnimationType;
uniform float uSpeed;
uniform float uAngle;
uniform float uScale;
uniform int uColorCount;

// Maximum 16 colors
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec3 uColor5;
uniform vec3 uColor6;
uniform vec3 uColor7;
uniform vec3 uColor8;
uniform vec3 uColor9;
uniform vec3 uColor10;
uniform vec3 uColor11;
uniform vec3 uColor12;
uniform vec3 uColor13;
uniform vec3 uColor14;
uniform vec3 uColor15;

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

mat2 rotate2d(float angle) {
  return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
}

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec3 getColorAt(float position) {
  if (uColorCount <= 1) return uColor0;

  float scaledPos = position * float(uColorCount - 1);
  int index = int(floor(scaledPos));
  float fraction = fract(scaledPos);

  vec3 color1, color2;

  if (index == 0) {
    color1 = uColor0;
    color2 = uColor1;
  } else if (index == 1) {
    color1 = uColor1;
    color2 = (uColorCount > 2) ? uColor2 : uColor1;
  } else if (index == 2) {
    color1 = uColor2;
    color2 = (uColorCount > 3) ? uColor3 : uColor2;
  } else if (index == 3) {
    color1 = uColor3;
    color2 = (uColorCount > 4) ? uColor4 : uColor3;
  } else if (index == 4) {
    color1 = uColor4;
    color2 = (uColorCount > 5) ? uColor5 : uColor4;
  } else if (index == 5) {
    color1 = uColor5;
    color2 = (uColorCount > 6) ? uColor6 : uColor5;
  } else if (index == 6) {
    color1 = uColor6;
    color2 = (uColorCount > 7) ? uColor7 : uColor6;
  } else if (index == 7) {
    color1 = uColor7;
    color2 = (uColorCount > 8) ? uColor8 : uColor7;
  } else if (index == 8) {
    color1 = uColor8;
    color2 = (uColorCount > 9) ? uColor9 : uColor8;
  } else if (index == 9) {
    color1 = uColor9;
    color2 = (uColorCount > 10) ? uColor10 : uColor9;
  } else if (index == 10) {
    color1 = uColor10;
    color2 = (uColorCount > 11) ? uColor11 : uColor10;
  } else if (index == 11) {
    color1 = uColor11;
    color2 = (uColorCount > 12) ? uColor12 : uColor11;
  } else if (index == 12) {
    color1 = uColor12;
    color2 = (uColorCount > 13) ? uColor13 : uColor12;
  } else if (index == 13) {
    color1 = uColor13;
    color2 = (uColorCount > 14) ? uColor14 : uColor13;
  } else if (index == 14) {
    color1 = uColor14;
    color2 = (uColorCount > 15) ? uColor15 : uColor14;
  } else {
    color1 = uColor15;
    color2 = uColor15;
  }
  return mix(color1, color2, fraction);
}

void main() {
  vec2 st = (vTexCoord - 0.5) * uScale;
  float t = uTime;
  float mixValue = 0.0;

  // Gradient types
  if (uGradientType == 0.0) { // Linear
    vec2 rotated = rotate2d(uAngle) * st;
    mixValue = rotated.x + 0.5;
  }
  else if (uGradientType == 1.0) { // Radial
    mixValue = 1.0 - length(st);
  }
  else if (uGradientType == 2.0) { // Conic
    mixValue = (atan(st.y, st.x) + PI) / TWO_PI;
  }
  else if (uGradientType == 3.0) { // Diamond
    mixValue = 1.0 - (abs(st.x) + abs(st.y));
  }
  else if (uGradientType == 4.0) { // Spiral
    float r = length(st);
    float a = atan(st.y, st.x);
    mixValue = 1.0 - mod(r + a / TWO_PI, 1.0);
  }
  else if (uGradientType == 5.0) { // Star
    float a = atan(st.y, st.x);
    float r = length(st);
    float star = 0.5 + 0.5 * cos(5.0 * a);
    mixValue = 1.0 - (r / star);
  }
  else if (uGradientType == 6.0) { // Kaleidoscope
    float a = atan(st.y, st.x);
    float segments = 8.0;
    float segmentAngle = mod(a, TWO_PI / segments) * segments;
    mixValue = 1.0 - (sin(segmentAngle + length(st) * 5.0) * 0.5 + 0.5);
  }

  // Animations
  if (uSpeed == 0.0) {
    // No animation
  }
  else if (uAnimationType == 1.0) { // Move
    float originalValue = mixValue;
    mixValue = uSpeed == 0.0 ? originalValue : mod(originalValue + t * uSpeed, 1.0);
  }
  else if (uAnimationType == 2.0) { // Rotate
    vec2 rotated = rotate2d(t) * st;
    if (uGradientType == 0.0) {
      mixValue = rotated.x + 0.5;
    } else if (uGradientType == 2.0) {
      mixValue = (atan(rotated.y, rotated.x) + PI) / TWO_PI;
    }
  }
  else if (uAnimationType == 3.0) { // Wave
    mixValue += sin(st.y * 10.0 + t * 3.0) * 0.1;
  }
  else if (uAnimationType == 4.0) { // Pulse
    float pulse = sin(t * 2.0) * 0.5 + 0.5;
    mixValue *= (0.5 + pulse * 0.5);
  }
  else if (uAnimationType == 5.0) { // Wave Pattern
    float wave = sin(mixValue * 3.0 + t * 2.0) * 0.5 + 0.5;
    mixValue = wave;
  }
  else if (uAnimationType == 6.0) { // Noise
    float n = noise(st * 5.0 + t);
    mixValue = mix(mixValue, n, 0.3);
  }

  mixValue = clamp(mixValue, 0.0, 1.0);
  vec3 color = getColorAt(mixValue);
  gl_FragColor = vec4(color, 1.0);
}
`;

class GradientShader {
  constructor(vertShader, fragShader, colors = null) {
    this.shader = createShader(vertShader, fragShader);
    const defaultColors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    this.config = {
      gradientType: 0,
      animationType: 0,
      speed: 0.0,
      angle: 0,
      scale: 1.0,
      colors: colors || defaultColors,
    };
  }

  apply() {
    shader(this.shader);
    this.updateUniforms();
  }

  updateUniforms() {
    const currentTime = millis() / 1000.0;
    this.shader.setUniform('uTime', this.config.speed === 0 ? 0 : currentTime);
    this.shader.setUniform('uGradientType', this.config.gradientType);
    this.shader.setUniform('uAnimationType', this.config.animationType);
    this.shader.setUniform('uSpeed', this.config.speed);
    this.shader.setUniform('uAngle', this.config.angle);
    this.shader.setUniform('uScale', this.config.scale);
    this.shader.setUniform('uColorCount', this.config.colors.length);
    for (let i = 0; i < Math.min(16, this.config.colors.length); i++) {
      this.shader.setUniform(`uColor${i}`, this.config.colors[i]);
    }
  }

  setGradientType(type) {
    this.config.gradientType = type;
  }

  setAnimationType(type) {
    this.config.animationType = type;
  }

  setColors(...colors) {
    if (Array.isArray(colors[0])) {
      this.config.colors = colors[0].map(color => {
        if (typeof color === 'string' && color.startsWith('#')) {
          const c = window.color(color);
          return [red(c) / 255, green(c) / 255, blue(c) / 255];
        }
        return color;
      });
    } else {
      this.config.colors = colors.map(color => {
        if (typeof color === 'string' && color.startsWith('#')) {
          const c = window.color(color);
          return [red(c) / 255, green(c) / 255, blue(c) / 255];
        }
        return color;
      });
    }
  }

  setSpeed(speed) {
    this.config.speed = speed;
  }

  setAngle(angle) {
    this.config.angle = angle;
  }

  setScale(scale) {
    this.config.scale = scale;
  }
}

// ============================================
// ELEMENT CLASS (AUDIO-REACTIVE)
// ============================================

class Element {
  constructor(props = {}) {
    this.id = props.id ?? 0;
    this.isDisplay = props.isDisplay ?? true;
    this.originX = props.originX ?? 0;
    this.originY = props.originY ?? 0;
    this.originZ = props.originZ ?? 0;
    this.x = props.x ?? 0;
    this.y = props.y ?? 0;
    this.z = props.z ?? 0;

    if (props.baseSize !== undefined) {
      this.baseSize = props.baseSize;
      this.w = this.baseSize;
      this.h = this.baseSize;
      this.d = this.baseSize;
      this.radius = this.baseSize;
    } else {
      this.w = props.w ?? 100;
      this.h = props.h ?? 100;
      this.d = props.d ?? 100;
      this.radius = props.radius ?? 100;
    }

    this.scaleX = props.scaleX ?? 1;
    this.scaleY = props.scaleY ?? 1;
    this.scaleZ = props.scaleZ ?? 1;
    this.angleX = props.angleX ?? 0;
    this.angleY = props.angleY ?? 0;
    this.angleZ = props.angleZ ?? 0;

    // AUDIO-REACTIVE: Base rotation speeds (SLOWED DOWN)
    this.baseAngleXAccel = props.angleXAccel ?? 0.003;
    this.baseAngleYAccel = props.angleYAccel ?? 0.003;
    this.baseAngleZAccel = props.angleZAccel ?? 0.003;

    // VARIED COLOR SCHEMES: Mix monochromatic, analogous, and full palette
    const colorType = random();

    if (colorType < 0.3) {
      // 30% use monochromatic (single color variations)
      const baseColor = palette.colors[randomInt(0, palette.colors.length - 1)];
      this.colors = generateColorScheme(baseColor, 'monochromatic');
    } else if (colorType < 0.6) {
      // 30% use analogous (neighboring colors)
      const baseIndex = randomInt(0, palette.colors.length - 1);
      this.colors = [
        palette.colors[baseIndex],
        palette.colors[(baseIndex + 1) % palette.colors.length],
        palette.colors[(baseIndex + 2) % palette.colors.length],
        palette.colors[(baseIndex + 7) % palette.colors.length],
      ];
    } else {
      // 40% use full palette variety
      this.colors = shuffleArray([...palette.colors]).slice(0, randomInt(3, 6));
    }

    this.colors = shuffleArray(this.colors);

    this.gradientShader = new GradientShader(vertShader, flexibleFragShader);
    this.gradientShader.setColors(this.colors);

    // VARIED GRADIENT TYPES: 0=Linear, 1=Radial, 2=Conic, 3=Diamond, 4=Spiral, 5=Star, 6=Kaleidoscope
    const gradientTypes = [0, 1, 2, 3, 4, 5, 6];
    this.gradientShader.setGradientType(gradientTypes[randomInt(0, gradientTypes.length - 1)]);

    // VARIED ANIMATION TYPES: 0=None, 1=Move, 2=Rotate, 3=Wave, 4=Pulse, 5=Wave Pattern, 6=Noise
    const animationTypes = [1, 2, 3, 4, 5, 6]; // Exclude 0 (none) for more interest
    this.gradientShader.setAnimationType(animationTypes[randomInt(0, animationTypes.length - 1)]);

    this.baseShaderSpeed = random(-2, 2);

    // AUDIO-REACTIVE: Size pulsing parameters (VARIED on reset)
    this.amplitudeSize = random(30, 100);
    this.phaseShiftX = random(-PI, PI);
    this.phaseShiftY = random(-PI, PI);

    // Vary element sizes more dramatically
    const sizeType = random();
    if (sizeType < 0.33) {
      // Large elements
      this.targetW = random(800, 2000);
      this.targetH = random(800, 2000);
    } else if (sizeType < 0.66) {
      // Medium elements
      this.targetW = random(400, 1000);
      this.targetH = random(400, 1000);
    } else {
      // Small elements
      this.targetW = random(200, 600);
      this.targetH = random(200, 600);
    }
  }

  randomizeProperties() {
    // FAST: Just update properties without recreating shader
    this.angleX = getRandomStepAngleInRadians(4, 0, TWO_PI);
    this.angleY = getRandomStepAngleInRadians(4, 0, TWO_PI);
    this.angleZ = getRandomStepAngleInRadians(4, 0, TWO_PI);

    this.baseAngleXAccel = random(-0.003, 0.003);
    this.baseAngleYAccel = random(-0.003, 0.003);
    this.baseAngleZAccel = random(-0.003, 0.003);

    // Update colors
    const colorType = random();
    if (colorType < 0.3) {
      const baseColor = palette.colors[randomInt(0, palette.colors.length - 1)];
      this.colors = generateColorScheme(baseColor, 'monochromatic');
    } else if (colorType < 0.6) {
      const baseIndex = randomInt(0, palette.colors.length - 1);
      this.colors = [
        palette.colors[baseIndex],
        palette.colors[(baseIndex + 1) % palette.colors.length],
        palette.colors[(baseIndex + 2) % palette.colors.length],
        palette.colors[(baseIndex + 7) % palette.colors.length],
      ];
    } else {
      this.colors = shuffleArray([...palette.colors]).slice(0, randomInt(3, 6));
    }
    this.colors = shuffleArray(this.colors);
    this.gradientShader.setColors(this.colors);

    // Update gradient and animation types
    const gradientTypes = [0, 1, 2, 3, 4, 5, 6];
    this.gradientShader.setGradientType(gradientTypes[randomInt(0, gradientTypes.length - 1)]);

    const animationTypes = [1, 2, 3, 4, 5, 6];
    this.gradientShader.setAnimationType(animationTypes[randomInt(0, animationTypes.length - 1)]);

    this.baseShaderSpeed = random(-2, 2);

    // Update size parameters
    this.amplitudeSize = random(30, 100);
    this.phaseShiftX = random(-PI, PI);
    this.phaseShiftY = random(-PI, PI);

    const sizeType = random();
    if (sizeType < 0.33) {
      this.targetW = random(800, 2000);
      this.targetH = random(800, 2000);
    } else if (sizeType < 0.66) {
      this.targetW = random(400, 1000);
      this.targetH = random(400, 1000);
    } else {
      this.targetW = random(200, 600);
      this.targetH = random(200, 600);
    }
  }

  run = () => {
    if (!this.isDisplay) return;

    // AUDIO-REACTIVE: Adjust shader speed based on audio
    const shaderSpeed = this.baseShaderSpeed * (1 + audioFeatures.midLow * 2);
    this.gradientShader.setSpeed(shaderSpeed);

    this.gradientShader.apply();
    push();
    translate(this.originX, this.originY, this.originZ);
    scale(this.scaleX, this.scaleY, this.scaleZ);

    // AUDIO-REACTIVE: Rotation speeds
    // Violin (midLow) = smooth rotation changes
    // Pluck (midHigh) = sharp rotation bursts
    const violinRotation = audioFeatures.midLow * 0.02;
    const pluckRotation = audioFeatures.midHigh * 0.05;

    this.angleX += this.baseAngleXAccel + violinRotation + pluckRotation;
    this.angleY += this.baseAngleYAccel + violinRotation + pluckRotation;
    this.angleZ += this.baseAngleZAccel + violinRotation + pluckRotation;

    rotateX(this.angleX);
    rotateY(this.angleY);
    rotateZ(this.angleZ);

    // AUDIO-REACTIVE: Size pulsing
    // Base cosine animation + violin smooth pulsing + pluck sharp bursts
    const baseW = this.amplitudeSize * cos(frameCount * 0.05 + this.phaseShiftX);
    const baseH = this.amplitudeSize * cos(frameCount * 0.07 + this.phaseShiftY);

    const violinPulse = audioFeatures.midLow * 300;
    const pluckBurst = Math.pow(audioFeatures.midHigh, 1.5) * 600;

    this.w = baseW + this.targetW + violinPulse + pluckBurst;
    this.h = baseH + this.targetH + violinPulse + pluckBurst;

    plane(this.w, this.h);
    pop();
    resetShader();
  }
}

// ============================================
// MOTIF CLASS
// ============================================

class Motif {
  constructor(props = {}) {
    this.id = props.id ?? 0;
    this.isDisplay = props.isDisplay ?? true;
    this.originX = props.originX ?? 0;
    this.originY = props.originY ?? 0;
    this.originZ = props.originZ ?? 0;
    this.scaleX = props.scaleX ?? 1;
    this.scaleY = props.scaleY ?? 1;
    this.scaleZ = props.scaleZ ?? 1;
    this.angleX = props.angleX ?? 0;
    this.angleY = props.angleY ?? 0;
    this.angleZ = props.angleZ ?? 0;

    // AUDIO-REACTIVE: Base rotation for whole motif (SLOWED DOWN)
    this.baseAngleXAccel = random(-0.002, 0.002);
    this.baseAngleYAccel = random(-0.002, 0.002);
    this.baseAngleZAccel = random(-0.002, 0.002);

    this.colors = props.colors ?? palette.colors.slice();
    this.colors = shuffleArray(this.colors);

    // Use fixed medium grid to avoid expensive recreation
    // This prevents lag on reset
    this.repeatX = 6;
    this.repeatY = 6;
    this.repeatZ = 6;

    // Create or reuse elements
    if (!this.elements) {
      this.elements = [];
    }

    const targetCount = this.repeatX * this.repeatY * this.repeatZ;

    // Create new elements if we don't have enough
    if (this.elements.length < targetCount) {
      const elementsNeeded = targetCount - this.elements.length;
      for (let n = 0; n < elementsNeeded; n++) {
        const element = new Element({
          originX: 0,
          originY: 0,
          originZ: 0,
          angleX: getRandomStepAngleInRadians(4, 0, TWO_PI),
          angleY: getRandomStepAngleInRadians(4, 0, TWO_PI),
          angleZ: getRandomStepAngleInRadians(4, 0, TWO_PI),
          angleXAccel: random(-0.003, 0.003),
          angleYAccel: random(-0.003, 0.003),
          angleZAccel: random(-0.003, 0.003),
        });
        this.elements.push(element);
      }
    }

    // Randomize existing elements on reset (much faster than recreating)
    for (let i = 0; i < this.elements.length; i++) {
      const element = this.elements[i];
      element.randomizeProperties();
    }
  }

  run = () => {
    if (!this.isDisplay) return;

    push();
    translate(this.originX, this.originY, this.originZ);
    scale(this.scaleX, this.scaleY, this.scaleZ);

    // AUDIO-REACTIVE: Whole motif rotates with violin
    const violinRotation = audioFeatures.midLow * 0.01;
    this.angleX += this.baseAngleXAccel + violinRotation;
    this.angleY += this.baseAngleYAccel + violinRotation;
    this.angleZ += this.baseAngleZAccel + violinRotation;

    rotateX(this.angleX);
    rotateY(this.angleY);
    rotateZ(this.angleZ);

    // AUDIO-REACTIVE: Show fewer/more elements based on energy
    const totalEnergy = (audioFeatures.midLow + audioFeatures.midHigh) / 2;
    const visibleCount = Math.floor(this.elements.length * (0.3 + totalEnergy * 0.7));

    // Draw elements (only up to visibleCount)
    for (let i = 0; i < Math.min(visibleCount, this.elements.length); i++) {
      const element = this.elements[i];
      element.run();
    }
    pop();
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function randomInt(minNum, maxNum) {
  return minNum + Math.floor(Math.random() * (maxNum - minNum + 1));
}

function getRandomStepAngleInRadians(numSteps, minAngle = 0, maxAngle = TWO_PI) {
  if (numSteps <= 0 || !Number.isFinite(numSteps)) {
    throw new Error('numSteps must be a positive finite number');
  }
  const angleRange = maxAngle - minAngle;
  const stepAngle = angleRange / numSteps;
  const randomStep = Math.floor(Math.random() * numSteps);
  return minAngle + (randomStep * stepAngle);
}

function repeatPalette(orgPalette, count) {
  return {
    colors: orgPalette.colors
  };
}

// Simple monochromatic color scheme generator
function generateColorScheme(baseColor, type) {
  const c = color(baseColor);
  const h = hue(c);
  const s = saturation(c);
  const b = brightness(c);

  const colors = [];
  for (let i = 0; i < 5; i++) {
    const newB = (b + (i - 2) * 15) % 100;
    const newColor = color(h, s, Math.max(20, Math.min(80, newB)));
    colors.push(colorToHex(newColor));
  }
  return colors;
}

function colorToHex(c) {
  return '#' + [red(c), green(c), blue(c)].map(v => {
    const hex = Math.floor(v).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}
