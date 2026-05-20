// Scene 4 — TERRAIN: arcing lines forming landscape layers, audio-reactive
// Arcs sweep from edge to edge, curving upward at mid-screen to form mountain
// silhouettes. Layered back-to-front with depth colour, each layer reacts to
// a different frequency band.
// Canvas 2D.
window.Ember = window.Ember || {};

Ember.Scene4 = (function() {
  let canvas, ctx;
  let noise;
  let raf = 0, t0 = 0, running = false;
  let arcBeams = [];

  function resize() { ctx = Ember.sizeCanvas(canvas, '2d'); }

  function init() {
    canvas = document.getElementById('c4');
    resize();
    Ember.onResize(resize);
  }

  // Spawn an arc for a given depth layer (0=far, 1=near)
  function spawnArc(w, h, depth, t) {
    const layerY = h * (0.44 + depth * 0.48);
    const jitter = h * 0.12;

    // Start and end on left/right edges at roughly layer height
    const x0 = -30;
    const x1 = w + 30;
    const y0 = layerY + (Math.random() - 0.5) * jitter;
    const y1 = layerY + (Math.random() - 0.5) * jitter;

    // Control point arcs upward — creates the mountain peak silhouette
    const peakX  = w * (0.28 + Math.random() * 0.44);
    const peakLift = h * (0.06 + depth * 0.22 + Math.random() * 0.12);
    const cpX = peakX;
    const cpY = layerY - peakLift;

    return {
      x0, y0, x1, y1, cpX, cpY,
      progress: 0,
      speed: 0.0012 + Math.random() * 0.0018,
      depth,
      life: 0,
      maxLife: 380 + Math.random() * 420,
      width: 0.8 + depth * 3.0,
    };
  }

  function start() {
    running = true;
    t0 = performance.now();
    noise = Ember.makeNoise(Ember.state.seed + 23);
    arcBeams = [];
    loop();
  }
  function stop()  { running = false; cancelAnimationFrame(raf); }
  function loop()  { if (!running) return; raf = requestAnimationFrame(loop); draw(); }

  function hexAlpha(hex, a) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }

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

    // Sky background
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0,   pal.bg[0]);
    sky.addColorStop(0.4, pal.bg[1]);
    sky.addColorStop(0.8, pal.warm[2]);
    sky.addColorStop(1.0, pal.bg[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Sun glow
    const sunX = w * 0.5, sunY = h * 0.36;
    const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * 0.32);
    sg.addColorStop(0,   hexAlpha(pal.warm[1], 0.55 + lvl * 0.3));
    sg.addColorStop(0.4, hexAlpha(pal.warm[0], 0.15 + lvl * 0.08));
    sg.addColorStop(1,   hexAlpha(pal.bg[0],   0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    // Maintain arc beams — 5 depth layers, each with 2–3 active arcs
    const N_LAYERS = 5;
    for (let L = 0; L < N_LAYERS; L++) {
      const depth = L / (N_LAYERS - 1);
      const want  = 2 + L;
      const count = arcBeams.filter(a => Math.abs(a.depth - depth) < 0.05).length;
      for (let k = count; k < want; k++) {
        arcBeams.push(spawnArc(w, h, depth, t));
      }
    }

    // Sort back-to-front
    arcBeams.sort((a, b) => a.depth - b.depth);

    // Per-layer audio: distant = high freq, foreground = bass
    const audioForDepth = d =>
      d < 0.35 ? bands.high * 0.6 + bands.mid * 0.3
    : d < 0.65 ? bands.mid  * 0.7 + bands.low * 0.2
    :             bands.low  * 0.8 + lvl * 0.2;

    // Layer palette: distant = cool/dim, foreground = warm/bright
    const depthColor = d =>
      d < 0.2  ? pal.cool[1]
    : d < 0.42 ? pal.warm[2]
    : d < 0.65 ? pal.warm[0]
    : d < 0.82 ? pal.warm[1]
    :             pal.paper;

    for (let i = arcBeams.length - 1; i >= 0; i--) {
      const arc   = arcBeams[i];
      arc.life++;
      const lifeT = arc.life / arc.maxLife;
      const audio = audioForDepth(arc.depth);
      arc.progress = Math.min(1, arc.progress + arc.speed * (1 + audio * 2.5 + bands.mid) * Ember.state.tempo);

      if (arc.life > arc.maxLife) { arcBeams.splice(i, 1); continue; }

      const fade  = Math.sin(lifeT * Math.PI);
      const col   = depthColor(arc.depth);
      const lw    = arc.width * (1 + audio * 2.2) * (0.5 + arc.depth * 0.8);
      const alpha = (0.45 + arc.depth * 0.45) * fade;
      const glow  = 2 + audio * 16 + lvl * 5;

      ctx.shadowBlur  = glow;
      ctx.shadowColor = hexAlpha(col, 0.55);
      ctx.strokeStyle = hexAlpha(col, Math.min(1, alpha));
      ctx.lineWidth   = lw;
      ctx.lineCap     = 'round';

      ctx.beginPath();
      const STEPS = 56;
      for (let s = 0; s <= STEPS; s++) {
        const u = (s / STEPS) * arc.progress;
        const x = bezier(arc.x0, arc.cpX, arc.x1, u);
        const y = bezier(arc.y0, arc.cpY, arc.y1, u);
        s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Atmospheric haze
    const haze = ctx.createLinearGradient(0, h * 0.35, 0, h * 0.68);
    haze.addColorStop(0,   hexAlpha(pal.warm[1], 0));
    haze.addColorStop(0.5, hexAlpha(pal.warm[0], 0.09 + lvl * 0.07));
    haze.addColorStop(1,   hexAlpha(pal.warm[2], 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, h * 0.35, w, h * 0.33);
  }

  return { init, start, stop };
})();
