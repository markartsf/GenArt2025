// boids-flock.js
// Audio-reactive flocking simulation inspired by cubeDhuang/boids.
// Craig Reynolds' boids algorithm (alignment, cohesion, separation)
// with spatial subdivision for O(n) neighbor lookups.
//
// Audio mapping:
//   Bass  → separation force + boid size (low = tight flock, high = scatter)
//   Mid   → alignment force + speed (mid drives unison movement)
//   High  → cohesion force + trail opacity (high freq = tighter clusters)
//   RMS   → number of active boids + overall brightness
//   Beat  → explosion burst from center, hue shift
//   Spectral centroid → hue drift

const TWO_PI = Math.PI * 2;

// --- Lightweight Vec2 ---
class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  static random(scale = 1) {
    const a = Math.random() * TWO_PI;
    return new Vec2(Math.cos(a) * scale, Math.sin(a) * scale);
  }
  clone() { return new Vec2(this.x, this.y); }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(s) { this.x *= s; this.y *= s; return this; }
  div(s) { this.x /= s; this.y /= s; return this; }
  sclAdd(v, s) { this.x += v.x * s; this.y += v.y * s; return this; }
  zero() { this.x = 0; this.y = 0; return this; }
  sqrMag() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.hypot(this.x, this.y); }
  angle() { return Math.atan2(this.y, this.x); }
  sqrDist(v) { const dx = this.x - v.x, dy = this.y - v.y; return dx * dx + dy * dy; }
  setMag(s) {
    const m = this.sqrMag();
    if (m > 0) { const f = s / Math.sqrt(m); this.x *= f; this.y *= f; }
    return this;
  }
  limit(max) {
    if (this.sqrMag() > max * max) this.setMag(max);
    return this;
  }
  min(s) {
    if (this.sqrMag() < s * s) this.setMag(s);
    return this;
  }
  rotate(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const rx = this.x * c - this.y * s;
    this.y = this.x * s + this.y * c;
    this.x = rx;
    return this;
  }
}

// --- Single Boid ---
class Boid {
  constructor(x, y) {
    this.pos = new Vec2(x, y);
    this.vel = Vec2.random(2 + Math.random() * 2);
    this.acc = new Vec2();
    this.trail = []; // position history for light trails
  }
}

// --- Spatial grid for fast neighbor lookups ---
class SpatialGrid {
  constructor(w, h, cellSize) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(w / cellSize);
    this.rows = Math.ceil(h / cellSize);
    this.buckets = new Array(this.cols * this.rows);
  }

  clear() { this.buckets.fill(null); }

  resize(w, h, cellSize) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(w / cellSize);
    this.rows = Math.ceil(h / cellSize);
    this.buckets = new Array(this.cols * this.rows);
  }

  insert(boid) {
    const col = Math.floor(boid.pos.x / this.cellSize);
    const row = Math.floor(boid.pos.y / this.cellSize);
    const idx = row * this.cols + col;
    if (idx >= 0 && idx < this.buckets.length) {
      if (!this.buckets[idx]) this.buckets[idx] = [];
      this.buckets[idx].push(boid);
    }
  }

  neighbors(boid, radius) {
    const results = [];
    const sqR = radius * radius;
    const col = Math.floor(boid.pos.x / this.cellSize);
    const row = Math.floor(boid.pos.y / this.cellSize);

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr, c = col + dc;
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;
        const bucket = this.buckets[r * this.cols + c];
        if (!bucket) continue;
        for (const other of bucket) {
          if (other === boid) continue;
          const d = boid.pos.sqrDist(other.pos);
          if (d < sqR) results.push({ boid: other, sqDist: d });
        }
      }
    }
    return results;
  }
}

// --- Exported Sketch ---
export class BoidsFlock {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Flock params (will be modulated by audio)
    this.baseCount = 300;
    this.vision = 60;
    this.maxSpeed = 4;
    this.maxForce = 0.2;
    this.alignW = 1.1;
    this.cohesionW = 1.0;
    this.separationW = 1.2;
    this.trailLen = 8;

    // Audio smoothing
    this.sBass = 0; this.sMid = 0; this.sHigh = 0; this.sRMS = 0;
    this.prevRMS = 0;
    this.beatFlash = 0;
    this.beatCooldown = 0;
    this.hueShift = 0;

    this.boids = [];
    this.grid = null;

    this.reset();
  }

  reset() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.boids = [];
    for (let i = 0; i < this.baseCount; i++) {
      this.boids.push(new Boid(Math.random() * w, Math.random() * h));
    }
    this.grid = new SpatialGrid(w, h, this.vision);
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

    // --- Audio smoothing (α = 0.2) ---
    const a = 0.2;
    this.sBass = this.sBass + a * ((af.bass || 0) - this.sBass);
    this.sMid  = this.sMid  + a * ((af.mid  || 0) - this.sMid);
    this.sHigh = this.sHigh + a * ((af.high || 0) - this.sHigh);
    this.sRMS  = this.sRMS  + a * ((af.rms  || 0) - this.sRMS);

    // --- Beat detection ---
    const rmsDelta = (af.rms || 0) - this.prevRMS;
    this.prevRMS = af.rms || 0;
    if (this.beatCooldown > 0) this.beatCooldown--;
    if (rmsDelta > 0.06 && this.beatCooldown === 0) {
      this.beatFlash = 1;
      this.beatCooldown = 12;
    }
    this.beatFlash *= 0.88;

    // Hue drift from spectral centroid
    this.hueShift += (af.spectralCentroid || 0) * 0.002;

    // --- Audio-modulated flocking params ---
    const bass = this.sBass;
    const mid = this.sMid;
    const high = this.sHigh;
    const rms = this.sRMS;

    const dynSeparation = this.separationW + bass * 4;      // bass scatters
    const dynAlignment  = this.alignW + mid * 3;             // mid unifies
    const dynCohesion   = this.cohesionW + high * 5;         // high clusters
    const dynSpeed      = this.maxSpeed * (1 + rms * 2);     // energy = speed
    const dynForce      = this.maxForce * (1 + rms * 1.5);
    const dynVision     = this.vision * (1 + bass * 0.5);    // bass widens awareness
    const dynNoise      = 0.02 + bass * 0.15;                // bass adds jitter
    const dynTrailLen   = Math.floor(this.trailLen + rms * 20); // energy = longer trails

    // --- Resize grid if needed ---
    if (this.grid.cellSize !== Math.ceil(dynVision)) {
      this.grid.resize(w, h, Math.max(30, Math.ceil(dynVision)));
    }

    // --- Populate spatial grid ---
    this.grid.clear();
    for (const b of this.boids) this.grid.insert(b);

    // --- Update boids ---
    const sqVis = dynVision * dynVision;
    for (const boid of this.boids) {
      boid.acc.zero();

      const ns = this.grid.neighbors(boid, dynVision);

      if (ns.length > 0) {
        const aln = new Vec2();
        const csn = new Vec2();
        const sep = new Vec2();

        for (const { boid: other, sqDist } of ns) {
          aln.add(other.vel);
          csn.add(other.pos);
          const d = 1 / (sqDist || 0.00001);
          sep.x += (boid.pos.x - other.pos.x) * d;
          sep.y += (boid.pos.y - other.pos.y) * d;
        }

        aln.setMag(dynSpeed).sub(boid.vel).limit(dynForce);
        csn.div(ns.length).sub(boid.pos).setMag(dynSpeed).sub(boid.vel).limit(dynForce);
        sep.setMag(dynSpeed).sub(boid.vel).limit(dynForce);

        boid.acc.sclAdd(aln, dynAlignment);
        boid.acc.sclAdd(csn, dynCohesion);
        boid.acc.sclAdd(sep, dynSeparation);
      }

      // Beat explosion — push outward from center
      if (this.beatFlash > 0.1) {
        const cx = w / 2, cy = h / 2;
        const dx = boid.pos.x - cx, dy = boid.pos.y - cy;
        const d2 = dx * dx + dy * dy || 1;
        const push = new Vec2(dx, dy).setMag(this.beatFlash * 800 / Math.sqrt(d2));
        boid.acc.add(push);
      }

      // Update velocity
      boid.vel.add(boid.acc);
      boid.vel.mult(1 - 0.005); // drag
      if (dynNoise > 0) boid.vel.rotate((Math.random() - 0.5) * dynNoise);
      boid.vel.min(1);           // min speed
      boid.vel.limit(dynSpeed);  // max speed

      // Update position (wrap)
      boid.pos.add(boid.vel);
      boid.pos.x = ((boid.pos.x % w) + w) % w;
      boid.pos.y = ((boid.pos.y % h) + h) % h;

      // Store trail
      boid.trail.push(boid.pos.clone());
      if (boid.trail.length > dynTrailLen) {
        boid.trail.splice(0, boid.trail.length - dynTrailLen);
      }
    }

    // --- Draw ---
    // Fade background
    ctx.fillStyle = `rgba(10, 10, 18, ${0.15 + this.beatFlash * 0.3})`;
    ctx.fillRect(0, 0, w, h);

    const brightness = 0.6 + rms * 0.4 + this.beatFlash * 0.3;

    for (const boid of this.boids) {
      const speed = boid.vel.mag();
      const speedNorm = Math.min(speed / (dynSpeed * 1.2), 1);
      const hue = (this.hueShift + speedNorm * 60 + bass * 30) % 360;
      const sat = 70 + high * 30;
      const lit = Math.min(40 + brightness * 30, 90);
      const angle = boid.vel.angle();

      // Draw trail
      if (boid.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(boid.trail[0].x, boid.trail[0].y);
        for (let i = 1; i < boid.trail.length; i++) {
          // Skip if wrap-around (big jump)
          const dx = boid.trail[i].x - boid.trail[i - 1].x;
          const dy = boid.trail[i].y - boid.trail[i - 1].y;
          if (dx * dx + dy * dy > 10000) {
            ctx.moveTo(boid.trail[i].x, boid.trail[i].y);
          } else {
            ctx.lineTo(boid.trail[i].x, boid.trail[i].y);
          }
        }
        const trailAlpha = (0.15 + high * 0.3) * brightness;
        ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${trailAlpha})`;
        ctx.lineWidth = 1 + bass * 2;
        ctx.stroke();
      }

      // Draw boid triangle
      const size = 3 + bass * 4 + speedNorm * 2;
      const px = boid.pos.x, py = boid.pos.y;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.7, -size * 0.5);
      ctx.lineTo(-size * 0.5, 0);
      ctx.lineTo(-size * 0.7, size * 0.5);
      ctx.closePath();
      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${0.7 + this.beatFlash * 0.3})`;
      ctx.fill();
      ctx.restore();
    }

    // Beat flash glow overlay
    if (this.beatFlash > 0.05) {
      const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
      grd.addColorStop(0, `hsla(${(this.hueShift + 200) % 360}, 80%, 60%, ${this.beatFlash * 0.08})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    }
  }

  dispose() {
    this.boids = [];
    this.grid = null;
  }
}
