// particle-life.js
// Audio-reactive Particle Life simulation.
// Different colored particle types attract/repel each other via an attraction
// matrix, producing emergent life-like structures (clusters, rings, chains).
// Adapted from a Particle Life .pl preset with 14 types.
//
// Audio mapping:
//   Bass  → force multiplier (louder bass = stronger interactions)
//   Mid   → interaction radius rmax (mid widens particle awareness)
//   High  → friction (high freq = more viscous, tighter clusters)
//   RMS   → brightness + glow intensity
//   Beat  → partial matrix perturbation + flash
//   Spectral centroid → global hue rotation

const TWO_PI = Math.PI * 2;
const N_TYPES = 6;
const N_PARTICLES = 3000;

// Asymmetric matrix — creates orbiting, chasing, and clustering behaviors.
// Positive = attract, negative = repel. Asymmetry (A→B != B→A) creates motion.
const BASE_MATRIX = [
  [ 0.10,  0.40, -0.20,  0.30, -0.15,  0.25],
  [-0.30,  0.10,  0.35, -0.20,  0.40, -0.10],
  [ 0.25, -0.35,  0.10,  0.30, -0.25,  0.35],
  [-0.15,  0.30, -0.20,  0.10,  0.35, -0.30],
  [ 0.35, -0.15,  0.40, -0.25,  0.10,  0.20],
  [-0.20,  0.40, -0.10,  0.35, -0.20,  0.10],
];

// Type hues
const TYPE_HUES = Array.from({ length: N_TYPES }, (_, i) => (i / N_TYPES) * 360);

// --- Spatial grid ---
class Grid {
  constructor(w, h, cell) {
    this.cell = cell;
    this.cols = Math.ceil(w / cell);
    this.rows = Math.ceil(h / cell);
    this.buckets = new Array(this.cols * this.rows);
  }
  clear() { this.buckets.fill(null); }
  resize(w, h, cell) {
    this.cell = cell;
    this.cols = Math.ceil(w / cell);
    this.rows = Math.ceil(h / cell);
    this.buckets = new Array(this.cols * this.rows);
  }
  insert(p) {
    const c = Math.floor(p.x / this.cell);
    const r = Math.floor(p.y / this.cell);
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return;
    const idx = r * this.cols + c;
    if (!this.buckets[idx]) this.buckets[idx] = [];
    this.buckets[idx].push(p);
  }
  query(x, y, cb) {
    const c0 = Math.floor(x / this.cell);
    const r0 = Math.floor(y / this.cell);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;
        const bucket = this.buckets[r * this.cols + c];
        if (bucket) for (const p of bucket) cb(p);
      }
    }
  }
}

export class ParticleLife {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Simulation params
    this.baseRmax = 100;     // interaction radius in px
    this.beta = 0.15;        // repulsion zone fraction — small enough to cluster
    this.baseForce = 5;
    this.baseFriction = 0.08;
    this.dt = 0.015;
    this.substeps = 3;
    this.centerGravity = 0.0003; // gentle pull toward center keeps particles in view

    // Audio smoothing
    this.sBass = 0; this.sMid = 0; this.sHigh = 0; this.sRMS = 0;
    this.prevRMS = 0;
    this.beatFlash = 0;
    this.beatCooldown = 0;
    this.hueShift = 0;

    // Live matrix
    this.matrix = BASE_MATRIX.map(row => [...row]);

    this.particles = [];
    this.grid = null;
    this.reset();
  }

  reset() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.particles = [];
    const cx = w / 2, cy = h / 2;
    const spread = Math.min(w, h) * 0.3;
    for (let i = 0; i < N_PARTICLES; i++) {
      const angle = Math.random() * TWO_PI;
      const r = Math.sqrt(Math.random()) * spread;
      this.particles.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        type: Math.floor(Math.random() * N_TYPES),
      });
    }
    this.grid = new Grid(w, h, this.baseRmax);
    this.matrix = BASE_MATRIX.map(row => [...row]);
    this.sBass = 0; this.sMid = 0; this.sHigh = 0; this.sRMS = 0;
    this.prevRMS = 0;
    this.beatFlash = 0;
    this.beatCooldown = 0;
    this.hueShift = 0;
  }

  draw(af) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2, cy = h / 2;

    // --- Audio smoothing ---
    const alpha = 0.18;
    this.sBass = this.sBass + alpha * ((af.bass || 0) - this.sBass);
    this.sMid  = this.sMid  + alpha * ((af.mid  || 0) - this.sMid);
    this.sHigh = this.sHigh + alpha * ((af.high || 0) - this.sHigh);
    this.sRMS  = this.sRMS  + alpha * ((af.rms  || 0) - this.sRMS);

    // --- Beat detection ---
    const rmsDelta = (af.rms || 0) - this.prevRMS;
    this.prevRMS = af.rms || 0;
    if (this.beatCooldown > 0) this.beatCooldown--;
    if (rmsDelta > 0.05 && this.beatCooldown === 0) {
      this.beatFlash = 1;
      this.beatCooldown = 14;
      this._perturbMatrix();
    }
    this.beatFlash *= 0.87;

    this.hueShift += (af.spectralCentroid || 0) * 0.0015;

    // --- Audio-modulated params ---
    const bass = this.sBass;
    const mid = this.sMid;
    const high = this.sHigh;
    const rms = this.sRMS;

    const dynRmax = this.baseRmax * (1 + mid * 0.8);
    const dynForce = this.baseForce * (1 + bass * 4);
    const dynFriction = this.baseFriction * (1 + high * 2);
    const frictionMult = 1 - dynFriction;
    const dynGravity = this.centerGravity * (1 + bass * 2);

    // Resize grid if needed
    const gridCell = Math.max(50, Math.ceil(dynRmax));
    if (Math.abs(this.grid.cell - gridCell) > 10) {
      this.grid.resize(w, h, gridCell);
    }

    // --- Physics substeps ---
    const sqRmax = dynRmax * dynRmax;
    const beta = this.beta;
    const margin = 30;

    for (let step = 0; step < this.substeps; step++) {
      this.grid.clear();
      for (const p of this.particles) this.grid.insert(p);

      for (const p of this.particles) {
        let fx = 0, fy = 0;

        // Particle-particle interactions
        this.grid.query(p.x, p.y, (other) => {
          if (other === p) return;
          const dx = other.x - p.x;
          const dy = other.y - p.y;
          const sqD = dx * dx + dy * dy;
          if (sqD >= sqRmax || sqD < 0.5) return;

          const d = Math.sqrt(sqD);
          const nd = d / dynRmax;

          let f;
          if (nd < beta) {
            f = nd / beta - 1;
          } else {
            const attraction = this.matrix[p.type][other.type];
            f = attraction * (1 - Math.abs(2 * nd - 1 - beta) / (1 - beta));
          }

          f *= dynForce / d;
          fx += dx * f;
          fy += dy * f;
        });

        // Gentle center gravity — keeps the whole system in view
        fx += (cx - p.x) * dynGravity;
        fy += (cy - p.y) * dynGravity;

        // Soft wall repulsion
        if (p.x < margin) fx += (margin - p.x) * 0.05;
        else if (p.x > w - margin) fx += (w - margin - p.x) * 0.05;
        if (p.y < margin) fy += (margin - p.y) * 0.05;
        else if (p.y > h - margin) fy += (h - margin - p.y) * 0.05;

        p.vx = (p.vx + fx * this.dt) * frictionMult;
        p.vy = (p.vy + fy * this.dt) * frictionMult;
        p.x += p.vx;
        p.y += p.vy;

        // Hard clamp
        p.x = Math.max(2, Math.min(w - 2, p.x));
        p.y = Math.max(2, Math.min(h - 2, p.y));
      }
    }

    // --- Draw ---
    // Mostly clear background, slight trail on beats for motion blur
    const fadeAlpha = 0.65 + this.beatFlash * 0.3;
    ctx.fillStyle = `rgba(8, 6, 14, ${fadeAlpha})`;
    ctx.fillRect(0, 0, w, h);

    const brightness = 0.5 + rms * 0.5 + this.beatFlash * 0.3;
    const baseRadius = 2.2 + bass * 1.5;

    // Batch by type — single path per type for performance
    for (let t = 0; t < N_TYPES; t++) {
      const hue = (TYPE_HUES[t] + this.hueShift) % 360;
      const sat = 75 + high * 20;
      const lit = 45 + brightness * 25;
      const a = 0.75 + brightness * 0.25;

      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${a})`;
      ctx.beginPath();
      for (const p of this.particles) {
        if (p.type !== t) continue;
        ctx.moveTo(p.x + baseRadius, p.y);
        ctx.arc(p.x, p.y, baseRadius, 0, TWO_PI);
      }
      ctx.fill();
    }

    // Beat flash glow
    if (this.beatFlash > 0.05) {
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
      grd.addColorStop(0, `hsla(${(this.hueShift + 180) % 360}, 70%, 50%, ${this.beatFlash * 0.06})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    }
  }

  _perturbMatrix() {
    // On beat: slightly randomize a few matrix entries for evolving behavior
    for (let k = 0; k < 3; k++) {
      const i = Math.floor(Math.random() * N_TYPES);
      const j = Math.floor(Math.random() * N_TYPES);
      if (i === j) continue; // keep self-interaction stable
      this.matrix[i][j] += (Math.random() - 0.5) * 0.15;
      this.matrix[i][j] = Math.max(-1, Math.min(1, this.matrix[i][j]));
    }
  }

  dispose() {
    this.particles = [];
    this.grid = null;
  }
}
