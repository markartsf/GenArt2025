// Scene 3 — BREATH: meeting arcing lines, audio-reactive
// Bezier arcs sweep across the canvas from varied origins, converging toward
// a drifting focal zone. Audio drives curvature, width, spawn rate, glow.
// Canvas 2D.
window.Ember = window.Ember || {};

Ember.Scene3 = (function() {
  let canvas, ctx;
  let raf = 0, t0 = 0, running = false;
  let arcs = [];

  const MAX_ARCS = 30;

  function resize() { ctx = Ember.sizeCanvas(canvas, '2d'); }

  function init() {
    canvas = document.getElementById('c3');
    resize();
    Ember.onResize(resize);
  }

  function spawnArc(w, h, t, colorIdx) {
    // Arcs originate from edges and curve toward a slow-drifting focal zone
    const focalX = w * (0.38 + Math.sin(t * 0.11) * 0.18);
    const focalY = h * (0.38 + Math.cos(t * 0.07) * 0.16);

    const edge = Math.floor(Math.random() * 4); // 0=left, 1=right, 2=bottom, 3=top
    let x0, y0;
    if      (edge === 0) { x0 = -20;    y0 = Math.random() * h; }
    else if (edge === 1) { x0 = w + 20; y0 = Math.random() * h; }
    else if (edge === 2) { x0 = Math.random() * w; y0 = h + 20; }
    else                 { x0 = Math.random() * w; y0 = -20; }

    // Destination: spread around the focal zone
    const spread = Math.min(w, h) * 0.22;
    const x1 = focalX + (Math.random() - 0.5) * spread * 1.4;
    const y1 = focalY + (Math.random() - 0.5) * spread * 1.4;

    // Control point pulls arc toward or away from focal zone
    const cpPull = 0.4 + Math.random() * 0.5;
    const cpX = x0 + (focalX - x0) * cpPull + (Math.random() - 0.5) * w * 0.18;
    const cpY = y0 + (focalY - y0) * cpPull + (Math.random() - 0.5) * h * 0.18;

    return {
      x0, y0, x1, y1, cpX, cpY,
      progress: 0,
      speed: 0.004 + Math.random() * 0.007,
      width: 0.4 + Math.random() * 3.5,
      colorIdx: colorIdx !== undefined ? colorIdx : Math.floor(Math.random() * 3),
      life: 0,
      maxLife: 160 + Math.random() * 280,
    };
  }

  function start() {
    running = true;
    t0 = performance.now();
    arcs = [];
    // Prime background
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

  // Sample a quadratic bezier at parameter u ∈ [0,1]
  function bezier(x0, cpX, x1, u) {
    const mu = 1 - u;
    return mu * mu * x0 + 2 * mu * u * cpX + u * u * x1;
  }

  function draw() {
    const w = window.innerWidth, h = window.innerHeight;
    const t = (performance.now() - t0) / 1000 * Ember.state.tempo;
    const pal   = Ember.palettes[Ember.state.palette];
    const bands = Ember.Audio.getBands();
    const lvl   = Ember.Audio.getLevel();

    // Slow background fade — trails persist and accumulate
    const bgN = parseInt(pal.bg[0].replace('#', ''), 16);
    ctx.fillStyle = `rgba(${(bgN>>16)&255},${(bgN>>8)&255},${bgN&255},0.05)`;
    ctx.fillRect(0, 0, w, h);

    // Spawn arcs — more when audio is loud
    const target = Math.floor(8 + lvl * 20 + bands.mid * 14);
    const capped = Math.min(target, MAX_ARCS);
    while (arcs.length < capped) {
      arcs.push(spawnArc(w, h, t));
    }

    // Arc palette: warm[0], warm[1], paper — cycling across arcs
    const arcColors = [pal.warm[0], pal.warm[1], pal.paper];

    ctx.globalCompositeOperation = 'lighter';

    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];
      arc.life++;
      const lifeT = arc.life / arc.maxLife;
      const fade  = Math.sin(lifeT * Math.PI);

      const audioMod = 1 + bands.mid * 2.5 + bands.high * 1.5;
      arc.progress = Math.min(1, arc.progress + arc.speed * audioMod * Ember.state.tempo);

      if (arc.life > arc.maxLife) { arcs.splice(i, 1); continue; }

      const col   = arcColors[arc.colorIdx % arcColors.length];
      const lw    = arc.width * (1 + bands.low * 2.5) * (1 + lvl * 0.8);
      const alpha = fade * (0.45 + lvl * 0.35);
      const glow  = 3 + bands.mid * 14 + lvl * 10;

      // Draw arc from 0 → progress as polyline samples along bezier
      ctx.beginPath();
      const STEPS = 48;
      for (let s = 0; s <= STEPS; s++) {
        const u = (s / STEPS) * arc.progress;
        const x = bezier(arc.x0, arc.cpX, arc.x1, u);
        const y = bezier(arc.y0, arc.cpY, arc.y1, u);
        s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }

      ctx.shadowBlur  = glow;
      ctx.shadowColor = hexAlpha(col, 0.55);
      ctx.strokeStyle = hexAlpha(col, Math.min(1, alpha));
      ctx.lineWidth   = lw;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;

    // Soft focal glow where arcs converge
    const focalX = w * (0.38 + Math.sin(t * 0.11) * 0.18);
    const focalY = h * (0.38 + Math.cos(t * 0.07) * 0.16);
    const fg = ctx.createRadialGradient(focalX, focalY, 0, focalX, focalY, 120 + lvl * 60);
    fg.addColorStop(0,   hexAlpha(pal.warm[1], 0.18 + lvl * 0.15));
    fg.addColorStop(0.5, hexAlpha(pal.warm[0], 0.06));
    fg.addColorStop(1,   hexAlpha(pal.bg[0], 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  return { init, start, stop };
})();
