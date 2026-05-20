// Scene 1 — EMBER: a single spark, 2D canvas particle system
window.Ember = window.Ember || {};

Ember.Scene1 = (function() {
  let canvas, ctx;
  let particles = [];
  let raf = 0;
  let t0 = 0;
  let running = false;
  let noise;

  function resize() {
    ctx = Ember.sizeCanvas(canvas, '2d');
  }

  function spawn(w, h) {
    const r = Ember.rng(Ember.state.seed + 1 + Math.random()*1000|0);
    return {
      x: w/2 + (r()-0.5)*30,
      y: h/2 + (r()-0.5)*20 + 10,
      vx: (r()-0.5)*0.4,
      vy: -0.3 - r()*0.8,
      life: 0,
      max: 180 + r()*320,
      size: 0.8 + r()*2.4,
      hue: r(),
      seed: r()*1000
    };
  }

  function start() {
    running = true;
    particles = [];
    noise = Ember.makeNoise(Ember.state.seed + 11);
    t0 = performance.now();
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

  function hexAlpha(hex, a) {
    const h = hex.replace('#','');
    const n = parseInt(h, 16);
    const r = (n>>16)&255, g = (n>>8)&255, b = n&255;
    return `rgba(${r},${g},${b},${a})`;
  }

  function draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const t = (performance.now() - t0) / 1000 * Ember.state.tempo;
    const pal = Ember.palettes[Ember.state.palette];

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = hexAlpha(pal.bg[0], 0.14);
    ctx.fillRect(0, 0, w, h);

    const cx = w/2, cy = h/2;
    const coreR = 70 + Math.sin(t*1.3)*8 + Ember.Audio.getLevel()*40;

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR*3.5);
    g.addColorStop(0,    hexAlpha(pal.warm[1], 0.9));
    g.addColorStop(0.25, hexAlpha(pal.warm[0], 0.5));
    g.addColorStop(0.6,  hexAlpha(pal.warm[2], 0.18));
    g.addColorStop(1,    hexAlpha(pal.bg[0],  0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    g2.addColorStop(0, hexAlpha('#fff3dc', 0.95));
    g2.addColorStop(0.4, hexAlpha(pal.warm[1], 0.6));
    g2.addColorStop(1, hexAlpha(pal.warm[2], 0));
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI*2);
    ctx.fill();

    const audioBoost = 1 + Ember.Audio.getLevel()*3;
    const spawnRate = Math.floor(3 * audioBoost);
    for (let i = 0; i < spawnRate; i++) {
      if (particles.length < 900) particles.push(spawn(w, h));
    }

    ctx.globalCompositeOperation = 'lighter';
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life++;
      const nx = noise(p.x*0.004, p.y*0.004 + t*0.12);
      const ny = noise(p.x*0.004 + 99, p.y*0.004 + t*0.12);
      p.vx += (nx - 0.5) * 0.08;
      p.vy += (ny - 0.5) * 0.05 - 0.008;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;

      const lifeT = p.life / p.max;
      if (lifeT >= 1) { particles.splice(i, 1); continue; }

      const alpha = Math.sin(lifeT * Math.PI) * 0.85;
      const color = p.hue < 0.6 ? pal.warm[1] : pal.warm[0];

      const gp = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size*4);
      gp.addColorStop(0, hexAlpha(color, alpha));
      gp.addColorStop(1, hexAlpha(color, 0));
      ctx.fillStyle = gp;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size*4, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = hexAlpha('#fff5d9', alpha*0.9);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size*0.6, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const phase = (t*0.25 + k*0.33) % 1;
      const r = coreR + phase * 260;
      const a = (1 - phase) * 0.25;
      ctx.strokeStyle = hexAlpha(pal.warm[0], a);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.stroke();
    }
  }

  function init() {
    canvas = document.getElementById('c1');
    resize();
    Ember.onResize(resize);
  }

  return { init, start, stop };
})();
