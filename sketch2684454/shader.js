var shaderConfig = {
  // パラメータ設定
  gradientType: 0,  // 0:Linear, 1:Radial, 2:Conic, 3:Diamond, 4:Spiral, 5:Star, 6:Kaleidoscope
  animationType: 1, // 0:None, 1:Move, 2:Rotate, 3:Wave, 4:Pulse, 5:Wave Pattern, 6:Noise
  speed: 1.0,       // アニメーション速度
  angle: 0,         // グラデーションの角度（Linear用）
  scale: 1.0,       // グラデーションのスケール
  color1: [1.0, 0.0, 0.0],
  color2: [0.0, 1.0, 0.0],  
  color3: [0.0, 0.0, 1.0],
};

var vertShader = `
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

var fragShader = `
precision mediump float;
varying vec2 vTexCoord;

uniform float uTime;
uniform float uGradientType;
uniform float uAnimationType;
uniform float uSpeed;
uniform float uAngle;
uniform float uScale;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

mat2 rotate2d(float angle) {
  return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
}

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
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
    // speedが0の場合はアニメーションなし
    // 元のmixValueをそのまま使用
  }
  else if (uAnimationType == 1.0) { // Move
    // 元のmixValueを保存
    float originalValue = mixValue;
    // speedが0の場合は元の値を使用
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
  
  vec3 color;
  if (mixValue < 0.5) {
    color = mix(uColor1, uColor2, mixValue * 2.0);
  } else {
    color = mix(uColor2, uColor3, (mixValue - 0.5) * 2.0);
  }
  
  gl_FragColor = vec4(color, 1.0);
}
`


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

// 最大16色まで対応
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
  
  // インデックスに基づいて色を選択
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
    // speedが0の場合はアニメーションなし
  }
  else if (uAnimationType == 1.0) { // Move
    // 元のmixValueを保存
    float originalValue = mixValue;
    // speedが0の場合は元の値を使用
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
  
  // 色を取得
  vec3 color = getColorAt(mixValue);
  
  gl_FragColor = vec4(color, 1.0);
}
`;