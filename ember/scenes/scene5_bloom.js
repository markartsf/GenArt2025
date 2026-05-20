// Scene 5 — BLOOM: concentric expanding rings, palette-driven, audio-reactive
// Rings bloom outward from a warm core — bass spawns bursts, high adds shimmer.
// Canvas 2D — replaces previous GLSL raymarched SDF.
window.Ember = window.Ember || {};

Ember.Scene5 = (function() {
  let canvas, ctx;
  let raf = 0, t0 = 0, running = false;
  let rings = [];
  let prevRMS = 0, beatFlash = 0, beatCooldown = 0;
  let sBass = 0, sMid = 0, sHigh = 0, sRMS = 0;

  function resize() { ctx = Ember.sizeCanvas(canvas, '2d'); }

  function init() {
    canvas = document.getElementById('c5');
    resize();
    Ember.onResize(resize);
  }

  // colorIdx 0..4 maps to palette slots
  function spawnRing(cx, cy, colorIdx, r0, delay) {
    return {
      cx, cy,
      r: r0 || 4,
      speed: 0.6 + Math.random() * 1.6,
      colorIdx: colorIdx !== undefined ? colorIdx : Math.floor(Math.random() * 5),
      life: 0,
      maxLife: 180 + Math.random() * 240,
      width: 0.6 + Math.random() * 3.8,
      delay: delay || 0,
      ellipseY: 0.85 + Math.random() * 0.3, // slight ellipse for organic feel
    };
  }

  function start() {
    running = true;
    t0 = performance.now();
    rings = [];
    prevRMS = beatFlash = beatCooldown = 0;
    sBass = sMid = sHigh = sRMS = 0;
    // Black bg
    const pal = Ember.palettes[Ember.state.palette];
    const n   = parseInt(pal.bg[0].replace('#', ''), 16);
    ctx.fillStyle = `rgb(${(n>>16)&255},${(n>>8)&255},${n&255})`;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    loop();
  }
  function stop()  { running = false; cancelAnimationFrame(raf); }
  function loop()  { if (!running) return; raf = requestAnimationFrame(loop); draw(); }

  function hexAlpha(hex, a) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }

  function draw() {
    const w = window.innerWidth, h = window.innerHeight;
    const t = (performance.now() - t0) / 1000 * Ember.state.tempo;
    const pal   = Ember.palettes[Ember.state.palette];
    const bands = Ember.Audio.getBands();
    const rms   = Ember.Audio.getLevel();
    const α = 0.18;
    sBass += α * (bands.low  - sBass);
    sMid  += α * (bands.mid  - sMid);
    sHigh += α * (bands.high - sHigh);
    sRMS  += α * (rms        - sRMS);

    // Beat detection
    const rmsDelta = rms - prevRMS;
    if (rmsDelta > 0.045 && beatCooldown <= 0) { beatFlash = 1; beatCooldown = 15; }
    beatFlash *= 0.88;
    beatCooldown = Math.max(0, beatCooldown - 1);
    prevRMS = rms;

    // Background fade — slow, so rings leave trails
    const bgN = parseInt(pal.bg[0].replace('#', ''), 16);
    ctx.fillStyle = `rgba(${(bgN>>16)&255},${(bgN>>8)&255},${bgN&255},0.07)`;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const maxR = Math.max(w, h) * 0.72;

    // Continuous ambient ring spawn
    if (Math.random() < 0.12 + sRMS * 0.25 && rings.length < 110) {
      rings.push(spawnRing(
        cx + (Math.random() - 0.5) * 20,
        cy + (Math.random() - 0.5) * 20,
        Math.floor(Math.random() * 5)
      ));
    }

    // Beat burst — ring cascade in all palette colours
    if (beatFlash > 0.75) {
      const burst = 3 + Math.floor(beatFlash * 6);
      for (let i = 0; i < burst; i++) {
        rings.push(spawnRing(cx, cy, i % 5, 5 + i * 3, i * 3));
      }
    }

    // Low-frequency swell — extra thick rings
    if (sBass > 0.18 && Math.random() < sBass * 0.4 && rings.length < 110) {
      const r = spawnRing(cx, cy, 0);
      r.width  = 3 + sBass * 6;
      r.speed  = 0.4 + sBass;
      rings.push(r);
    }

    // Palette colour map
    const ringColors = [pal.warm[0], pal.warm[1], pal.warm[2], pal.paper, pal.cool[1]];

    ctx.globalCompositeOperation = 'lighter';

    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      if (ring.delay > 0) { ring.delay--; continue; }
      ring.life++;
      const lifeT = ring.life / ring.maxLife;
      ring.r += ring.speed * (1 + sRMS * 1.8 + sBass * 0.6) * Ember.state.tempo;
      if (ring.r > maxR || ring.life > ring.maxLife) { rings.splice(i, 1); continue; }

      const fade  = Math.sin(lifeT * Math.PI);
      const col   = ringColors[ring.colorIdx % ringColors.length];
      const alpha = fade * (0.38 + sRMS * 0.28 + beatFlash * 0.18);
      const lw    = ring.width * (0.6 + lifeT * 0.8) * (1 + sHigh * 1.8);
      const glow  = 3 + sMid * 12 + beatFlash * 10;

      ctx.shadowBlur  = glow;
      ctx.shadowColor = hexAlpha(col, 0.5);
      ctx.strokeStyle = hexAlpha(col, Math.min(1, alpha));
      ctx.lineWidth   = lw;

      // Slightly elliptical for an organic feel
      ctx.save();
      ctx.scale(1, ring.ellipseY);
      ctx.beginPath();
      ctx.arc(ring.cx, ring.cy / ring.ellipseY, ring.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.shadowBlur = 0;
    }

    ctx.globalCompositeOperation = 'source-over';

    // Central bloom glow
    const coreG = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90 + sBass * 70 + beatFlash * 30);
    coreG.addColorStop(0,   hexAlpha(pal.warm[1], 0.55 + sBass * 0.4));
    coreG.addColorStop(0.35, hexAlpha(pal.warm[0], 0.18 + sRMS * 0.15));
    coreG.addColorStop(1,   hexAlpha(pal.bg[0],   0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = coreG;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    // Bright core dot — pulses with bass
    const coreR = 5 + sBass * 22 + beatFlash * 12;
    ctx.shadowBlur  = 18 + sBass * 28 + beatFlash * 20;
    ctx.shadowColor = hexAlpha(pal.paper, 0.85);
    ctx.fillStyle   = hexAlpha(pal.paper, 0.96);
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  return { init, start, stop };
})();
