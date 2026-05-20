// Scene 6 — REMEMBER: three Lorenz attractors, audio-reactive, Ember palette
// Adapted from lorenz-reactive.js — bass/mid/high each drive one attractor.
// Colors are drawn from the active Ember palette rather than fixed hues.
window.Ember = window.Ember || {};

Ember.Scene6 = (function() {
  const Z_CENTER  = 23;
  const N_BUCKETS = 8;
  const DT        = 0.009;
  const BASE_MAX_PTS = 4500;
  const STARTS = [
    [0.1,  0,    0  ],
    [0,    0.5,  0.5],
    [0.05, 0.1,  0.1],
  ];

  // Per-palette hue overrides for the three attractors
  // [bass hue, mid hue, high hue]
  const PAL_HUES = {
    ember: [22,  42, 340],
    dusk:  [340, 20, 280],
    ochre: [38,  55,  20],
    moss:  [50,  85, 140],
  };

  let canvas, ctx;
  let raf = 0, running = false;

  let attractors = [];
  let rotation = 0;
  let prevRMS = 0, beatFlash = 0, beatCooldown = 0;
  let sBass = 0, sMid = 0, sHigh = 0, sRMS = 0;
  let camZoom = 1, camTargetZoom = 1;
  let hueShift = 0;
  let baseScale = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.floor(window.innerWidth  * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseScale = Math.min(window.innerWidth, window.innerHeight) * 0.028;
  }

  function buildAttractors() {
    const hues = PAL_HUES[Ember.state.palette] || PAL_HUES.ember;
    return [
      { x: STARTS[0][0], y: STARTS[0][1], z: STARTS[0][2], points: [], hue: hues[0], sat: 90, lit: 60 },
      { x: STARTS[1][0], y: STARTS[1][1], z: STARTS[1][2], points: [], hue: hues[1], sat: 88, lit: 65 },
      { x: STARTS[2][0], y: STARTS[2][1], z: STARTS[2][2], points: [], hue: hues[2], sat: 75, lit: 68 },
    ];
  }

  function warmUp(attrs) {
    const sigma = 10, rho = 28, beta = 8 / 3;
    for (let step = 0; step < 5000; step++) {
      for (let ai = 0; ai < 3; ai++) {
        const a = attrs[ai];
        const dx = sigma * (a.y - a.x);
        const dy = a.x * (rho - a.z) - a.y;
        const dz = a.x * a.y - beta * a.z;
        a.x += dx * DT; a.y += dy * DT; a.z += dz * DT;
        a.points.push({ x: a.x, y: a.y, z: a.z });
        if (a.points.length > BASE_MAX_PTS) a.points.shift();
      }
    }
  }

  function init() {
    canvas = document.getElementById('c6');
    resize();
    Ember.onResize(resize);
  }

  function start() {
    running = true;
    attractors = buildAttractors();
    warmUp(attractors);
    rotation = 0;
    prevRMS = beatFlash = beatCooldown = 0;
    sBass = sMid = sHigh = sRMS = 0;
    camZoom = camTargetZoom = 1;
    hueShift = 0;
    loop();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function loop() {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    draw();
  }

  function draw() {
    const w = window.innerWidth, h = window.innerHeight;
    const pal = Ember.palettes[Ember.state.palette];
    const hues = PAL_HUES[Ember.state.palette] || PAL_HUES.ember;

    // Sync attractor hues when palette changes
    attractors.forEach((a, i) => { a.hue = hues[i]; });

    // Audio
    const bands = Ember.Audio.getBands();
    const rms   = Ember.Audio.getLevel();
    const α = 0.25;
    sBass += α * (bands.low  - sBass);
    sMid  += α * (bands.mid  - sMid);
    sHigh += α * (bands.high - sHigh);
    sRMS  += α * (rms        - sRMS);

    // Beat detection
    const rmsDelta = rms - prevRMS;
    if (rmsDelta > 0.06 && beatCooldown <= 0) {
      beatFlash = 1.0;
      beatCooldown = 18;
    }
    beatFlash    *= 0.86;
    beatCooldown  = Math.max(0, beatCooldown - 1);
    prevRMS       = rms;

    // Hue drift
    hueShift += (sMid + sHigh) * 0.4;

    // Background — palette bg with trail persistence
    const fadeAmt = 0.035 + sRMS * 0.09 + beatFlash * 0.06;
    const bg = pal.bg[0];
    const bgN = parseInt(bg.replace('#',''), 16);
    ctx.fillStyle = `rgba(${(bgN>>16)&255},${(bgN>>8)&255},${bgN&255},${fadeAmt})`;
    ctx.fillRect(0, 0, w, h);

    // Lorenz params
    const rho   = 28    * (1 + sBass * 4.5);
    const sigma = 10    * (1 + sMid  * 3.5);
    const beta  = (8/3) * (1 + sHigh * 2.2);

    const steps  = Math.max(1, Math.floor(2 + sRMS * 7));
    const maxPts = Math.max(1500, Math.floor(BASE_MAX_PTS * (1.1 - sRMS * 0.5)));

    rotation     += (0.0012 + sMid * 0.005 + beatFlash * 0.015) * Ember.state.tempo;
    camTargetZoom = 1 + sBass * 0.4 + beatFlash * 0.08;
    camZoom      += (camTargetZoom - camZoom) * 0.12;

    const dynScale = (baseScale + sBass * baseScale * 1.4 + sMid * baseScale * 0.8) * camZoom;

    const bandEnergy = [sBass, sMid, sHigh];

    for (let step = 0; step < steps; step++) {
      for (let ai = 0; ai < 3; ai++) {
        const a = attractors[ai];
        const e = bandEnergy[ai];
        const bSigma = sigma * (1 + e * 1.8);
        const bRho   = rho   * (1 + e * 1.2);
        const dx = bSigma * (a.y - a.x);
        const dy = a.x * (bRho - a.z) - a.y;
        const dz = a.x * a.y - beta * a.z;
        a.x += dx * DT; a.y += dy * DT; a.z += dz * DT;
        a.points.push({ x: a.x, y: a.y, z: a.z });
        if (a.points.length > maxPts) a.points.shift();
      }
    }

    // Draw
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(camZoom, camZoom);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let ai = 0; ai < 3; ai++) {
      const a   = attractors[ai];
      const pts = a.points;
      if (pts.length < N_BUCKETS * 2) continue;

      const e       = bandEnergy[ai];
      const baseHue = (a.hue + hueShift) % 360;
      const glowBlur = Math.min(22, 3 + e * 14 + beatFlash * 10);
      ctx.shadowBlur  = glowBlur;
      ctx.shadowColor = `hsla(${baseHue}, ${a.sat}%, ${Math.min(88, a.lit + 18)}%, 0.5)`;

      const bucketSize = Math.floor(pts.length / N_BUCKETS);

      for (let b = 0; b < N_BUCKETS; b++) {
        const t      = (b + 0.5) / N_BUCKETS;
        const iStart = b * bucketSize;
        const iEnd   = (b === N_BUCKETS - 1) ? pts.length - 1 : (b + 1) * bucketSize;
        if (iEnd <= iStart) continue;

        const trailHue = (baseHue + t * 24) % 360;
        const sat      = Math.min(100, a.sat + e * 12);
        const lit      = Math.min(88,  a.lit + beatFlash * 18 * t);
        const alpha    = Math.min(1,   t * (0.65 + e * 0.3 + beatFlash * 0.3 * t));
        const lw       = (0.3 + t * 2.5) * (1 + e * 3.5) * (1 + beatFlash * 1.0);

        ctx.strokeStyle = `hsla(${trailHue}, ${sat}%, ${lit}%, ${alpha})`;
        ctx.lineWidth   = lw;

        ctx.beginPath();
        const p0 = pts[iStart];
        ctx.moveTo(
          (p0.x * cos - p0.y * sin) * dynScale,
          (p0.x * sin + p0.y * cos - (p0.z - Z_CENTER)) * dynScale * 0.5
        );
        for (let i = iStart + 1; i <= iEnd; i++) {
          const p = pts[i];
          ctx.lineTo(
            (p.x * cos - p.y * sin) * dynScale,
            (p.x * sin + p.y * cos - (p.z - Z_CENTER)) * dynScale * 0.5
          );
        }
        ctx.stroke();
      }
    }

    ctx.restore();
    ctx.shadowBlur = 0;

    // Beat flash in palette warm color
    if (beatFlash > 0.15) {
      const wn = parseInt(pal.warm[0].replace('#',''), 16);
      ctx.fillStyle = `rgba(${(wn>>16)&255},${(wn>>8)&255},${wn&255},${beatFlash * 0.045})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  return { init, start, stop };
})();
