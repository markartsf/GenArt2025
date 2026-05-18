// Project Brushstroke v2 — brush primitives + path helpers.
//
// Loaded as a plain <script> after spectral.js. Exposes everything on
// window.B so both composition.html and (eventually) brush-test.html can
// share a single source of truth for brush behaviour.
//
// All brushes are pure functions of (ctx, ...params). No globals beyond
// what we explicitly expose. No matrix transforms — brushes paint at the
// pixel coordinates you pass in.

(function() {
  'use strict';

  const rand   = (a, b) => a + Math.random() * (b - a);
  const randI  = (a, b) => Math.floor(rand(a, b + 1));
  const choice = arr   => arr[Math.floor(Math.random() * arr.length)];

  // ── Path helpers ─────────────────────────────────────────────────────────

  // Catmull-Rom spline sample. pts: [{x,y},...], t in [0,1] → {x,y}
  function catmullRom(pts, t) {
    if (pts.length < 2) return { ...pts[0] };
    if (pts.length === 2) {
      return {
        x: pts[0].x + (pts[1].x - pts[0].x) * t,
        y: pts[0].y + (pts[1].y - pts[0].y) * t,
      };
    }
    const n = pts.length - 1;
    const seg = Math.min(n - 1, Math.floor(t * n));
    const localT = t * n - seg;
    const p0 = pts[Math.max(0, seg - 1)];
    const p1 = pts[seg];
    const p2 = pts[seg + 1];
    const p3 = pts[Math.min(pts.length - 1, seg + 2)];
    const t2 = localT * localT;
    const t3 = t2 * localT;
    const x = 0.5 * ((2 * p1.x) +
      (-p0.x + p2.x) * localT +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    const y = 0.5 * ((2 * p1.y) +
      (-p0.y + p2.y) * localT +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    return { x, y };
  }

  function pathLength(pts, samples = 60) {
    let len = 0, prev = catmullRom(pts, 0);
    for (let i = 1; i <= samples; i++) {
      const p = catmullRom(pts, i / samples);
      len += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    return len;
  }

  function tangent(pts, t) {
    const eps = 0.003;
    const a = catmullRom(pts, Math.max(0, t - eps));
    const b = catmullRom(pts, Math.min(1, t + eps));
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  function bellPressure(t, min = 0.7, max = 1.0) {
    return min + (max - min) * Math.sin(t * Math.PI);
  }

  // ── Colour helpers ───────────────────────────────────────────────────────

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  function rgbToHex(r, g, b) {
    const c = v => Math.round(v).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  }

  // Spectral.js v3 wrapper. Throws if spectral global is missing.
  function mixHex(a, b, t) {
    if (typeof spectral === 'undefined') throw new Error('spectral.js not loaded');
    const c1 = new spectral.Color(a);
    const c2 = new spectral.Color(b);
    const result = spectral.mix([c1, 1 - t], [c2, t]);
    return result.toString();
  }

  // Sample multi-stop gradient (spectrally interpolated between adjacent stops).
  function sampleGradient(stops, t) {
    t = Math.max(0, Math.min(1, t));
    if (stops.length === 1) return stops[0];
    const scaled = t * (stops.length - 1);
    const i0 = Math.floor(scaled);
    const i1 = Math.min(stops.length - 1, i0 + 1);
    const localT = scaled - i0;
    if (i0 === i1) return stops[i0];
    return mixHex(stops[i0], stops[i1], localT);
  }

  function samplePixelHex(ctx, x, y) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    x = Math.max(0, Math.min(w - 1, Math.round(x)));
    y = Math.max(0, Math.min(h - 1, Math.round(y)));
    const d = ctx.getImageData(x, y, 1, 1).data;
    return rgbToHex(d[0], d[1], d[2]);
  }

  function blendedColor(ctx, x, y, color, blend, ratio = 0.55) {
    if (!blend) return color;
    try {
      const bg = samplePixelHex(ctx, x, y);
      return mixHex(bg, color, ratio);
    } catch (e) {
      return color;
    }
  }

  // ── 8 single-stroke brushes ──────────────────────────────────────────────

  function hairLine(ctx, path, { color, weight = 1, opacity = 0.85, blend = false }) {
    const len = pathLength(path);
    const steps = Math.max(8, Math.floor(len * 0.6));
    ctx.lineCap = 'round';
    let prev = catmullRom(path, 0);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const p = catmullRom(path, t);
      const w = weight * bellPressure(t, 0.85, 1.0);
      const col = blendedColor(ctx, p.x, p.y, color, blend, 0.5);
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.globalAlpha = opacity * (0.85 + 0.15 * Math.random());
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      prev = p;
    }
    ctx.globalAlpha = 1;
  }

  function fatLozenge(ctx, path, { color, weight = 6, opacity = 0.75, blend = true, jitterAngle = 4 }) {
    const len = pathLength(path);
    const spacing = weight * 0.25;
    const steps = Math.max(4, Math.floor(len / spacing));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = catmullRom(path, t);
      const ang = tangent(path, t) + rand(-jitterAngle, jitterAngle) * Math.PI / 180;
      const pressure = bellPressure(t, 0.55, 1.0);
      const w = weight * pressure;
      const col = blendedColor(ctx, p.x, p.y, color, blend, 0.5);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.fillStyle = col;
      ctx.globalAlpha = opacity;
      const half = w / 2;
      const len2 = w * 0.7;
      ctx.beginPath();
      ctx.ellipse(0, 0, len2, half * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function chalkDrag(ctx, path, { color, weight = 3, opacity = 0.55, blend = true, density = 1 }) {
    const len = pathLength(path);
    const spacing = weight * 0.5;
    const steps = Math.max(8, Math.floor(len / spacing * density));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (Math.random() < 0.15) continue;
      const p = catmullRom(path, t);
      const ang = tangent(path, t);
      const w = weight * rand(0.7, 1.1);
      const col = blendedColor(ctx, p.x, p.y, color, blend, 0.45);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.fillStyle = col;
      ctx.globalAlpha = opacity * rand(0.7, 1.1);
      const cluster = 3 + randI(0, 2);
      for (let j = 0; j < cluster; j++) {
        const ox = rand(-w * 1.2, w * 1.2);
        const oy = rand(-w * 0.4, w * 0.4);
        const dx = rand(w * 0.5, w * 0.9);
        const dy = rand(w * 0.2, w * 0.4);
        ctx.beginPath();
        ctx.ellipse(ox, oy, dx, dy, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function chalkScribble(ctx, path, { color, weight = 2.5, opacity = 0.65, blend = true, breakProb = 0.35 }) {
    const len = pathLength(path);
    const spacing = weight * 0.6;
    const steps = Math.max(6, Math.floor(len / spacing));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (Math.random() < breakProb) continue;
      const p = catmullRom(path, t);
      const ang = tangent(path, t) + rand(-15, 15) * Math.PI / 180;
      const w = weight * rand(0.6, 1.2);
      const col = blendedColor(ctx, p.x, p.y, color, blend, 0.5);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.fillStyle = col;
      ctx.globalAlpha = opacity * rand(0.7, 1.0);
      for (let j = 0; j < 2; j++) {
        const ox = rand(-w * 0.6, w * 0.6);
        const oy = rand(-w * 0.3, w * 0.3);
        ctx.beginPath();
        ctx.ellipse(ox, oy, w * 0.7, w * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function sprayField(ctx, cx, cy, { color, radius = 50, density = 80, opacity = 0.45, falloff = 1.0 }) {
    ctx.fillStyle = color;
    for (let i = 0; i < density; i++) {
      const r = radius * Math.pow(Math.random(), falloff);
      const a = Math.random() * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const sz = rand(0.4, 1.6);
      ctx.globalAlpha = opacity * rand(0.5, 1.0);
      ctx.beginPath();
      ctx.arc(x, y, sz, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function watercolorWash(ctx, shape, { color, opacity = 0.35, bleed = 0.4 }) {
    const passes = 3 + randI(0, 2);
    for (let i = 0; i < passes; i++) {
      const passAlpha = opacity * (i === 0 ? 1.0 : (0.25 + 0.15 * Math.random()));
      const ox = i === 0 ? 0 : rand(-shape.w * bleed * 0.25, shape.w * bleed * 0.25);
      const oy = i === 0 ? 0 : rand(-shape.h * bleed * 0.25, shape.h * bleed * 0.25);
      const sw = shape.w * (i === 0 ? 1 : rand(0.7, 1.1));
      const sh = shape.h * (i === 0 ? 1 : rand(0.7, 1.1));
      ctx.fillStyle = color;
      ctx.globalAlpha = passAlpha;
      if (shape.type === 'rect') {
        ctx.fillRect(shape.cx - sw / 2 + ox, shape.cy - sh / 2 + oy, sw, sh);
      } else {
        ctx.beginPath();
        ctx.ellipse(shape.cx + ox, shape.cy + oy, sw / 2, sh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const edgeDots = 28 + randI(0, 12);
    ctx.fillStyle = color;
    for (let i = 0; i < edgeDots; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = bleed * Math.max(shape.w, shape.h) * 0.5;
      const x = shape.cx + Math.cos(a) * (shape.w / 2 + rand(-r * 0.2, r * 0.4));
      const y = shape.cy + Math.sin(a) * (shape.h / 2 + rand(-r * 0.2, r * 0.4));
      ctx.globalAlpha = opacity * rand(0.15, 0.45);
      ctx.beginPath();
      ctx.arc(x, y, rand(0.6, 1.8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function registrationCross(ctx, x, y, { color = '#2a2a2a', size = 6, weight = 1, rotation = 0, opacity = 0.85 }) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.strokeStyle = color;
    ctx.lineWidth = weight;
    ctx.lineCap = 'round';
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.moveTo(-size, 0); ctx.lineTo(size, 0);
    ctx.moveTo(0, -size); ctx.lineTo(0, size);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function gesturalSweep(ctx, path, { color, weight = 5, opacity = 0.65, blend = true }) {
    const len = pathLength(path);
    const spacing = weight * 0.2;
    const steps = Math.max(12, Math.floor(len / spacing));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = catmullRom(path, t);
      const ang = tangent(path, t);
      const pressure = 0.15 + 0.85 * Math.pow(Math.sin(t * Math.PI), 1.6);
      const w = weight * pressure;
      const col = blendedColor(ctx, p.x, p.y, color, blend, 0.4);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.fillStyle = col;
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.9, w * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ── Composite patterns ───────────────────────────────────────────────────

  // Radial bundle — N spokes from a centre point. Each spoke a short path
  // drawn with a brush picked from brushMix. Length varies; small jitter
  // in angle for organic feel.
  function radialBundle(ctx, { cx, cy, spokeCount = 12, lengthRange = [30, 80], brushMix, palette, options = {} }) {
    for (let i = 0; i < spokeCount; i++) {
      const baseA = (i / spokeCount) * Math.PI * 2 + rand(-0.06, 0.06);
      const len = rand(lengthRange[0], lengthRange[1]);
      const innerR = len * 0.08;
      const path = [
        { x: cx + Math.cos(baseA) * innerR,         y: cy + Math.sin(baseA) * innerR },
        { x: cx + Math.cos(baseA) * len * 0.5,       y: cy + Math.sin(baseA) * len * 0.5 },
        { x: cx + Math.cos(baseA) * len * 0.85,      y: cy + Math.sin(baseA) * len * 0.85 },
        { x: cx + Math.cos(baseA) * len,             y: cy + Math.sin(baseA) * len },
      ];
      const brushName = choice(brushMix);
      const col = choice(palette);
      const opts = {
        color: col,
        weight: rand(options.weightMin || 2, options.weightMax || 5),
        opacity: rand(0.55, 0.85),
        blend: true,
      };
      callBrush(ctx, brushName, path, opts);
    }
  }

  // Stipple comb — walk path, at each step draw a short perpendicular stroke
  function stippleComb(ctx, path, { brushType = 'fatLozenge', spacing = 8, perpLength = 12, color, weight = 3, opacity = 0.7 }) {
    const len = pathLength(path);
    const steps = Math.max(4, Math.floor(len / spacing));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = catmullRom(path, t);
      const tan = tangent(path, t);
      const perp = tan + Math.PI / 2;
      const halfLen = perpLength * 0.5 * rand(0.85, 1.15);
      const toothPath = [
        { x: p.x - Math.cos(perp) * halfLen, y: p.y - Math.sin(perp) * halfLen },
        { x: p.x + Math.cos(perp) * halfLen, y: p.y + Math.sin(perp) * halfLen },
      ];
      callBrush(ctx, brushType, toothPath, { color, weight, opacity, blend: true });
    }
  }

  // Dashed perimeter — outline a shape with hair-line dashes
  function dashedPerimeter(ctx, shape, { color = '#3a3a3a', dashLen = 6, gapLen = 4, weight = 0.8, opacity = 0.7 }) {
    // Build perimeter points based on shape type
    let perimeterPath;
    if (shape.type === 'rect') {
      const x0 = shape.cx - shape.w / 2, x1 = shape.cx + shape.w / 2;
      const y0 = shape.cy - shape.h / 2, y1 = shape.cy + shape.h / 2;
      perimeterPath = [
        { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 + 0.001 },
      ];
    } else {
      // ellipse: sample around circumference
      const segs = 48;
      perimeterPath = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        perimeterPath.push({
          x: shape.cx + Math.cos(a) * shape.w / 2,
          y: shape.cy + Math.sin(a) * shape.h / 2,
        });
      }
    }
    // Walk perimeter with alternating dash/gap
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = weight;
    ctx.lineCap = 'round';
    ctx.globalAlpha = opacity;
    for (let i = 0; i < perimeterPath.length - 1; i++) {
      const a = perimeterPath[i];
      const b = perimeterPath[i + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      const total = dashLen + gapLen;
      let drawn = 0;
      while (drawn < segLen) {
        const dashEnd = Math.min(drawn + dashLen, segLen);
        const tStart = drawn / segLen;
        const tEnd = dashEnd / segLen;
        ctx.beginPath();
        ctx.moveTo(a.x + (b.x - a.x) * tStart, a.y + (b.y - a.y) * tStart);
        ctx.lineTo(a.x + (b.x - a.x) * tEnd,   a.y + (b.y - a.y) * tEnd);
        ctx.stroke();
        drawn += total;
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Dispatch — call a named brush by string. Internal helper.
  function callBrush(ctx, name, path, opts) {
    switch (name) {
      case 'hairLine':       return hairLine(ctx, path, opts);
      case 'fatLozenge':     return fatLozenge(ctx, path, opts);
      case 'chalkDrag':      return chalkDrag(ctx, path, opts);
      case 'chalkScribble':  return chalkScribble(ctx, path, opts);
      case 'gesturalSweep':  return gesturalSweep(ctx, path, opts);
      default: throw new Error('unknown stroke brush: ' + name);
    }
  }

  // ── Expose on window.B ───────────────────────────────────────────────────

  window.B = {
    // helpers
    rand, randI, choice,
    catmullRom, pathLength, tangent, bellPressure,
    hexToRgb, rgbToHex, mixHex, sampleGradient, samplePixelHex, blendedColor,
    // 8 single-stroke brushes
    hairLine, fatLozenge, chalkDrag, chalkScribble, sprayField,
    watercolorWash, registrationCross, gesturalSweep,
    // composite patterns
    radialBundle, stippleComb, dashedPerimeter,
    callBrush,
  };
})();
