const VERT_SRC = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision highp float;

uniform vec2  iResolution;
uniform float iTime;
uniform float uBass;
uniform float uTTwists;
uniform float uTwist;
uniform float uGlowScale;

float t;
vec3  ret_col;
vec3  h;

#define I_MAX  120.
#define E      0.00001
#define FAR    50.

void rotate(inout vec2 v, float angle) {
  v = vec2(
     cos(angle)*v.x + sin(angle)*v.y,
    -sin(angle)*v.x + cos(angle)*v.y
  );
}

vec3 camera(vec2 uv) {
  return normalize(vec3(uv.x, uv.y, -1.0));
}

float scene(vec3 p) {
  p.z += 25.;
  rotate(p.xz, 1.57 - 0.5*iTime);
  rotate(p.yz, 1.57 - 0.5*iTime);

  float var = atan(p.x, p.y);
  vec2 q = vec2(length(p.xy) - 9., p.z);
  rotate(q, var * uTTwists + iTime * 0.4);

  vec2 oq = q;
  q = abs(q) - vec2(3., 3.) - sin(q) * 7.;

  float s = iTime;
  if (oq.x < q.x && oq.y > q.y) {
    rotate(q, (var * uTwist + s) * 3.14 + s);
  } else {
    rotate(q, (0.28 - var * uTwist + s) * 3.14 + s);
  }

  ret_col = 1. - vec3(0.350, 0.2, 0.3);
  q *= 0.2;

  float mind = length(q) + 0.5 + 1.05*(
    length(fract(q * 0.5 * (3. + 3.*sin(var - iTime))) - 0.5) - 1.215
  );

  float A = mind - sin(var - iTime*2. + 3.14) * 0.125;
  float B = mind - sin(var - iTime*2.) * 0.5;
  h -= vec3(-3.20,  0.20,  1.0 ) * 0.0025 / (0.051 + A*A);
  h -= vec3( 1.20, -0.50, -0.50) * 0.025  / (0.501 + B*B);
  h += vec3( 0.25,  0.40,  0.50) * 0.0025 / (0.021 + mind*mind);

  float audio = uBass * 0.3 + 0.05;
  h += audio * 0.1 - 0.005;

  return mind;
}

vec2 march(vec3 pos, vec3 dir) {
  vec2 dist = vec2(0.0);
  vec2 s    = vec2(0.0);

  for (float i = -1.; i < I_MAX; i++) {
    vec3 p = pos + dir * dist.y;
    dist.x = scene(p);
    dist.y += dist.x * 0.2;
    if (log(dist.y*dist.y / dist.x / 1e5) > 0.0 || dist.x < E || dist.y > FAR) break;
    s.x++;
  }
  s.y = dist.y;
  return s;
}

void main() {
  t = iTime * 0.125;
  h = vec3(0.0);

  vec2 uv  = (gl_FragCoord.xy - iResolution * 0.5) / iResolution.y;
  vec3 dir = camera(uv);
  vec3 pos = vec3(0.0, 0.0, 4.5 + 1.5*sin(t * 10.));

  vec2 inter = march(pos, dir);
  vec3 col   = ret_col * (1.0 - inter.x * 0.0125) + h * 0.4;
  gl_FragColor = vec4(col * uGlowScale, 1.0);
}
`;

export class TwistedTorus {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this._glCanvas = null;
    this._gl = null;
    this._prog = null;
    this._locs = null;
    this._resizeObserver = null;
    this._isDisposed = false;
    this._shaderTime = 0;
    this._lastTime = 0;
    this._sBass = 0;
    this._sMid = 0;
    this._sHigh = 0;
    this._sRMS = 0;
    this._prevRMS = 0;
    this._rmsWin = [];
    this._beatFlash = 0;
    this._beatCooldown = 0;
    this._initWebGL();
  }

  _initWebGL() {
    this._glCanvas = document.createElement('canvas');
    Object.assign(this._glCanvas.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '1',
    });
    document.getElementById('canvas-container').appendChild(this._glCanvas);

    const gl = this._glCanvas.getContext('webgl') ||
               this._glCanvas.getContext('experimental-webgl');
    if (!gl) { console.error('TwistedTorus: WebGL not supported'); return; }
    this._gl = gl;

    const vs = this._compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = this._compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('TwistedTorus: link error', gl.getProgramInfoLog(prog));
      return;
    }
    this._prog = prog;

    // Fullscreen quad as triangle strip
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(prog);
    this._locs = {
      iTime:      gl.getUniformLocation(prog, 'iTime'),
      iRes:       gl.getUniformLocation(prog, 'iResolution'),
      uBass:      gl.getUniformLocation(prog, 'uBass'),
      uTTwists:   gl.getUniformLocation(prog, 'uTTwists'),
      uTwist:     gl.getUniformLocation(prog, 'uTwist'),
      uGlowScale: gl.getUniformLocation(prog, 'uGlowScale'),
    };

    this._syncSize();
    this._resizeObserver = new ResizeObserver(() => this._syncSize());
    this._resizeObserver.observe(document.getElementById('canvas-container'));
    this._lastTime = performance.now() / 1000;
  }

  _compile(type, src) {
    const gl = this._gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('TwistedTorus shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  _syncSize() {
    if (!this._gl) return;
    const el = document.getElementById('canvas-container');
    // Render at CSS pixel resolution — DPR scaling is brutal for a raymarcher
    const w = el.clientWidth;
    const h = el.clientHeight;
    this._glCanvas.width  = w;
    this._glCanvas.height = h;
    this._gl.viewport(0, 0, w, h);
  }

  reset() {
    if (this._isDisposed) {
      this._isDisposed = false;
      this._initWebGL();
    }
    this._sBass = this._sMid = this._sHigh = this._sRMS = 0;
    this._prevRMS = 0;
    this._rmsWin = [];
    this._beatFlash = 0;
    this._beatCooldown = 0;
    this._shaderTime = 0;
    this._lastTime = performance.now() / 1000;
  }

  draw(af) {
    if (this._isDisposed || !this._gl || !this._prog) return;

    // Keep 2D canvas black so previous sketch doesn't bleed through
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const now = performance.now() / 1000;
    const dt  = Math.min(now - this._lastTime, 0.1); // clamp large gaps
    this._lastTime = now;

    // Smooth raw audio values (α=0.15)
    const α = 0.15;
    this._sBass += α * ((af.bass || 0) - this._sBass);
    this._sMid  += α * ((af.mid  || 0) - this._sMid);
    this._sHigh += α * ((af.high || 0) - this._sHigh);
    this._sRMS  += α * ((af.rms  || 0) - this._sRMS);

    // Normalize to 0–1 against typical maximums for this audio pipeline
    const nBass = Math.min(1, this._sBass / 0.15);
    const nMid  = Math.min(1, this._sMid  / 0.12);
    const nHigh = Math.min(1, this._sHigh / 0.02);
    const nRMS  = Math.min(1, this._sRMS  / 0.12);

    // Beat detection: delta vs 10-frame local RMS average (works on compressed audio)
    const rms = af.rms || 0;
    this._rmsWin.push(rms);
    if (this._rmsWin.length > 10) this._rmsWin.shift();
    const avgRMS = this._rmsWin.reduce((a, b) => a + b, 0) / this._rmsWin.length;
    if (rms - avgRMS > 0.015 && this._beatCooldown === 0) {
      this._beatFlash = 1.0;
      this._beatCooldown = 15;
    }
    if (this._beatCooldown > 0) this._beatCooldown--;
    this._beatFlash *= 0.85;

    // Advance shader time at audio-reactive speed
    this._shaderTime += dt * (0.4 + nRMS * 2.0);

    const gl = this._gl;
    const L  = this._locs;
    gl.useProgram(this._prog);
    gl.uniform2f(L.iRes,       this._glCanvas.width, this._glCanvas.height);
    gl.uniform1f(L.iTime,      this._shaderTime);
    gl.uniform1f(L.uBass,      nBass);
    gl.uniform1f(L.uTTwists,   0.75 + nBass * 3.5);
    gl.uniform1f(L.uTwist,     3.3  + nMid  * 6.0);
    gl.uniform1f(L.uGlowScale, 0.8  + nHigh * 2.5 + this._beatFlash * 2.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    this._isDisposed = true;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (this._glCanvas?.parentNode) {
      this._glCanvas.parentNode.removeChild(this._glCanvas);
    }
    this._glCanvas = null;
    if (this._gl && this._prog) this._gl.deleteProgram(this._prog);
    this._prog = null;
    this._gl   = null;
    this._locs = null;
  }
}
