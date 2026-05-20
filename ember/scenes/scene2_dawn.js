// Scene 2 — DAWN: audio-reactive layered terrain lines
// Multiple undulating horizon lines, each layer driven by a different frequency band.
// Canvas 2D — replaces previous GLSL shader.
window.Ember = window.Ember || {};

Ember.Scene2 = (function() {
  let canvas, ctx;
  let noise;
  let raf = 0, t0 = 0, running = false;

  const N_LAYERS = 8;

  function resize() { ctx = Ember.sizeCanvas(canvas, '2d'); }

  function init() {
    canvas = document.getElementById('c2');
    resize();
    Ember.onResize(resize);
  }

  function start() {
    running = true;
    t0 = performance.now();
    noise = Ember.makeNoise(Ember.state.seed + 7);
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
    const pal = Ember.palettes[Ember.state.palette];
    const bands = Ember.Audio.getBands();
    const lvl  = Ember.Audio.getLevel();

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0,    pal.bg[0]);
    sky.addColorStop(0.35, pal.bg[1]);
    sky.addColorStop(0.65, pal.warm[2]);
    sky.addColorStop(1.0,  pal.warm[0]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Sun glow
    const sunX = w * 0.5 + Math.sin(t * 0.08) * w * 0.04;
    const sunY = h * 0.44;
    const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * 0.38);
    sg.addColorStop(0,   hexAlpha(pal.warm[1], 0.65 + lvl * 0.3));
    sg.addColorStop(0.3, hexAlpha(pal.warm[0], 0.22 + lvl * 0.1));
    sg.addColorStop(1,   hexAlpha(pal.bg[0],   0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    // Per-layer audio reactivity — bass drives foreground, high drives distant ridges
    const audioPerLayer = [
      bands.high * 0.35,
      bands.high * 0.5  + lvl * 0.1,
      bands.mid  * 0.45 + bands.high * 0.25,
      bands.mid  * 0.6,
      bands.mid  * 0.55 + bands.low * 0.2,
      bands.low  * 0.55 + bands.mid * 0.2,
      bands.low  * 0.75,
      bands.low  * 0.9  + lvl * 0.25,
    ];

    const step = 5;

    for (let L = 0; L < N_LAYERS; L++) {
      const depth  = L / (N_LAYERS - 1);           // 0 = distant, 1 = foreground
      const audio  = audioPerLayer[L];
      const yBase  = h * (0.40 + depth * 0.50);
      const amp    = (28 + depth * 130) * (1 + audio * 3.0);
      const freq   = 0.0028 - depth * 0.0004;
      const speed  = 0.055 * (0.4 + depth * 0.8);

      // Layer colour: distant = cool/dim, foreground = warm/bright
      const palette = [
        pal.cool[1], pal.warm[2], pal.warm[2],
        pal.warm[0], pal.warm[0], pal.warm[1],
        pal.warm[1], pal.bg[2],
      ];
      const col   = palette[L];
      const alpha = 0.45 + depth * 0.45 + audio * 0.25;
      const lw    = 0.7  + depth * 2.2  + audio * 3.5;
      const glow  = 2    + audio * 18   + lvl * 6;

      // Build terrain polyline
      ctx.beginPath();
      let firstPt = true;
      for (let x = -10; x <= w + 10; x += step) {
        const n1 = noise(x * freq         + L * 8.3,  t * speed         + L * 3.7);
        const n2 = noise(x * freq * 2.1   + L * 5.1,  t * speed * 1.5   + L * 2.1) * 0.5;
        const n3 = noise(x * freq * 4.5   + L * 2.8,  t * speed * 2.3   + L * 4.4) * 0.25;
        const y  = yBase - (n1 + n2 + n3) * amp;
        if (firstPt) { ctx.moveTo(x, y); firstPt = false; }
        else ctx.lineTo(x, y);
      }

      // Glowing stroke — the terrain line
      ctx.shadowBlur  = glow;
      ctx.shadowColor = hexAlpha(col, 0.7);
      ctx.strokeStyle = hexAlpha(col, Math.min(1, alpha));
      ctx.lineWidth   = lw;
      ctx.lineCap     = 'round';
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // Dark silhouette fill below line
      ctx.lineTo(w + 10, h + 10);
      ctx.lineTo(-10,   h + 10);
      ctx.closePath();
      const fillAlpha = 0.38 + depth * 0.18;
      const fillCol   = depth < 0.35 ? pal.bg[0] : depth < 0.65 ? pal.bg[1] : pal.bg[2];
      ctx.fillStyle   = hexAlpha(fillCol, fillAlpha);
      ctx.fill();
    }

    // Horizon haze
    const haze = ctx.createLinearGradient(0, h * 0.32, 0, h * 0.62);
    haze.addColorStop(0, hexAlpha(pal.warm[1], 0));
    haze.addColorStop(0.5, hexAlpha(pal.warm[0], 0.10 + lvl * 0.08));
    haze.addColorStop(1,   hexAlpha(pal.warm[2], 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, h * 0.32, w, h * 0.3);
  }

  return { init, start, stop };
})();
