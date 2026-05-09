// lorenz-reactive.js
// Three simultaneous Lorenz attractors, one per frequency band.
// Direct audio → parameter mapping with no BPM smoothing layer.
// Bass  → rho   (chaos / butterfly spread)
// Mid   → sigma (coupling rate / trace speed)
// High  → beta  (decay / loop tightness)
// Beat detection via RMS spikes drives glow bursts and zoom pulses.
//
// PERFORMANCE: trail is split into N_BUCKETS colour segments per attractor
// so we do N_BUCKETS × 3 = 24 draw calls per frame instead of maxPts × 3.

const Z_CENTER  = 23;    // Lorenz z-mean — subtracting this centres the butterfly
const N_BUCKETS = 8;     // colour/alpha buckets per trail
const STARTS = [
  [0.1,  0,    0  ],    // bass attractor seed
  [0,    0.5,  0.5],    // mid attractor seed
  [0.05, 0.1,  0.1],    // high attractor seed
];

export class LorenzReactive {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Three attractors — bass (orange-red), mid (gold), high (violet)
    this.attractors = [
      { x: STARTS[0][0], y: STARTS[0][1], z: STARTS[0][2], points: [], hue: 15,  sat: 95, lit: 55 },
      { x: STARTS[1][0], y: STARTS[1][1], z: STARTS[1][2], points: [], hue: 48,  sat: 95, lit: 60 },
      { x: STARTS[2][0], y: STARTS[2][1], z: STARTS[2][2], points: [], hue: 275, sat: 80, lit: 65 },
    ];

    this.dt        = 0.008;
    this.baseScale = 20;
    this.rotation  = 0;
    this.baseMaxPts = 5000;

    // Beat detection
    this.prevRMS      = 0;
    this.beatFlash    = 0;
    this.beatCooldown = 0;

    // Smoothed audio (α = 0.25)
    this.sBass = 0;
    this.sMid  = 0;
    this.sHigh = 0;
    this.sRMS  = 0;

    // Camera zoom only — no orbital offset
    this.camZoom       = 1;
    this.camTargetZoom = 1;

    // Hue drift
    this.hueShift = 0;

    // Pre-warm: run simulation without storing points so chaos settles
    this._warmUp();
  }

  // Run the simulation for several hundred steps so the attractor has
  // settled onto its strange attractor before the first draw call.
  // We store points here so the butterfly is fully formed immediately.
  _warmUp() {
    const sigma = 10, rho = 28, beta = 8 / 3;
    for (let step = 0; step < 5000; step++) {
      for (let ai = 0; ai < 3; ai++) {
        const a = this.attractors[ai];
        const dx = sigma * (a.y - a.x);
        const dy = a.x * (rho - a.z) - a.y;
        const dz = a.x * a.y - beta * a.z;
        a.x += dx * this.dt;
        a.y += dy * this.dt;
        a.z += dz * this.dt;
        a.points.push({ x: a.x, y: a.y, z: a.z });
        if (a.points.length > this.baseMaxPts) a.points.shift();
      }
    }
  }

  reset() {
    this.attractors.forEach((a, i) => {
      [a.x, a.y, a.z] = STARTS[i];
      a.points = [];
    });
    this.rotation     = 0;
    this.beatFlash    = 0;
    this.beatCooldown = 0;
    this.sBass = this.sMid = this.sHigh = this.sRMS = 0;
    this.prevRMS      = 0;
    this.camZoom      = 1;
    this.camTargetZoom = 1;
    this.hueShift     = 0;
    this._warmUp();
  }

  draw(audioFeatures) {
    const dpr    = window.devicePixelRatio || 1;
    const width  = this.canvas.width  / dpr;
    const height = this.canvas.height / dpr;

    // ── Smooth audio ─────────────────────────────────────────────────────
    const α = 0.25;
    this.sBass += α * (audioFeatures.bass - this.sBass);
    this.sMid  += α * (audioFeatures.mid  - this.sMid);
    this.sHigh += α * (audioFeatures.high - this.sHigh);
    this.sRMS  += α * (audioFeatures.rms  - this.sRMS);

    // ── Beat detection via RMS spike ─────────────────────────────────────
    const rmsDelta = audioFeatures.rms - this.prevRMS;
    if (rmsDelta > 0.10 && this.beatCooldown <= 0) {
      this.beatFlash    = 1.0;
      this.beatCooldown = 18;
    }
    this.beatFlash    *= 0.86;
    this.beatCooldown  = Math.max(0, this.beatCooldown - 1);
    this.prevRMS       = audioFeatures.rms;

    // ── Hue drift from spectral centroid ─────────────────────────────────
    this.hueShift += audioFeatures.spectralCentroid * 0.003;

    // ── Background fade ───────────────────────────────────────────────────
    const fadeAmt = 0.03 + this.sRMS * 0.09 + this.beatFlash * 0.06;
    this.ctx.fillStyle = `rgba(4, 2, 8, ${fadeAmt})`;
    this.ctx.fillRect(0, 0, width, height);

    // ── Lorenz parameters driven by audio ────────────────────────────────
    const rho   = 28    * (1 + this.sBass * 5.0);
    const sigma = 10    * (1 + this.sMid  * 4.0);
    const beta  = (8/3) * (1 + this.sHigh * 2.5);

    // ── Steps per frame ───────────────────────────────────────────────────
    const steps  = Math.max(1, Math.floor(2 + this.sRMS * 7));

    // ── Trail length ──────────────────────────────────────────────────────
    const maxPts = Math.max(1500, Math.floor(this.baseMaxPts * (1.1 - this.sRMS * 0.5)));

    // ── Rotation ──────────────────────────────────────────────────────────
    this.rotation += 0.0015 + this.sMid * 0.006 + this.beatFlash * 0.018;

    // ── Camera zoom (bass pulse, no orbital drift) ────────────────────────
    this.camTargetZoom  = 1 + this.sBass * 0.45 + this.beatFlash * 0.10;
    this.camZoom       += (this.camTargetZoom - this.camZoom) * 0.12;

    // ── Dynamic scale ─────────────────────────────────────────────────────
    const dynScale = (this.baseScale + this.sBass * 30 + this.sMid * 18) * this.camZoom;

    // ── Integrate attractors ──────────────────────────────────────────────
    const bandEnergy = [this.sBass, this.sMid, this.sHigh];

    for (let step = 0; step < steps; step++) {
      for (let ai = 0; ai < 3; ai++) {
        const a = this.attractors[ai];
        const e = bandEnergy[ai];

        const bSigma = sigma * (1 + e * 2.0);
        const bRho   = rho   * (1 + e * 1.5);
        const bBeta  = beta;

        const dx = bSigma * (a.y - a.x);
        const dy = a.x * (bRho - a.z) - a.y;
        const dz = a.x * a.y - bBeta * a.z;
        a.x += dx * this.dt;
        a.y += dy * this.dt;
        a.z += dz * this.dt;

        a.points.push({ x: a.x, y: a.y, z: a.z });
        if (a.points.length > maxPts) a.points.shift();
      }
    }

    // ── Draw — batched into N_BUCKETS paths per attractor ─────────────────
    // This keeps total draw calls at N_BUCKETS × 3 = 24 regardless of trail length.
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);

    this.ctx.save();
    this.ctx.translate(width / 2, height / 2);
    this.ctx.scale(this.camZoom, this.camZoom);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    for (let ai = 0; ai < 3; ai++) {
      const a   = this.attractors[ai];
      const pts = a.points;
      if (pts.length < N_BUCKETS * 2) continue;

      const e       = bandEnergy[ai];
      const baseHue = (a.hue + this.hueShift) % 360;

      // Shadow set once per attractor — capped at 25px to avoid GPU overload
      const glowBlur = Math.min(25, 4 + e * 16 + this.beatFlash * 12);
      this.ctx.shadowBlur  = glowBlur;
      this.ctx.shadowColor = `hsla(${baseHue}, ${a.sat}%, ${Math.min(90, a.lit + 20)}%, 0.5)`;

      const bucketSize = Math.floor(pts.length / N_BUCKETS);

      for (let b = 0; b < N_BUCKETS; b++) {
        const t    = (b + 0.5) / N_BUCKETS;   // representative position in trail
        const iStart = b * bucketSize;
        const iEnd   = (b === N_BUCKETS - 1) ? pts.length - 1 : (b + 1) * bucketSize;
        if (iEnd <= iStart) continue;

        // Colour and width ramp from faint/thin (old) → bright/thick (new)
        const trailHue = (baseHue + t * 28) % 360;
        const sat      = Math.min(100, a.sat + e * 15);
        const lit      = Math.min(90,  a.lit + this.beatFlash * 20 * t);
        const alpha    = Math.min(1,   t * (0.7 + e * 0.3 + this.beatFlash * 0.3 * t));
        const lw       = (0.3 + t * 3) * (1 + e * 4) * (1 + this.beatFlash * 1.2);

        this.ctx.strokeStyle = `hsla(${trailHue}, ${sat}%, ${lit}%, ${alpha})`;
        this.ctx.lineWidth   = lw;

        // Draw entire bucket as one continuous path — one stroke() call
        this.ctx.beginPath();
        const p0 = pts[iStart];
        this.ctx.moveTo(
          (p0.x * cos - p0.y * sin) * dynScale,
          (p0.x * sin + p0.y * cos - (p0.z - Z_CENTER)) * dynScale * 0.5
        );
        for (let i = iStart + 1; i <= iEnd; i++) {
          const p = pts[i];
          this.ctx.lineTo(
            (p.x * cos - p.y * sin) * dynScale,
            (p.x * sin + p.y * cos - (p.z - Z_CENTER)) * dynScale * 0.5
          );
        }
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
    this.ctx.shadowBlur = 0;

    // ── Beat flash overlay ────────────────────────────────────────────────
    if (this.beatFlash > 0.15) {
      this.ctx.fillStyle = `rgba(255, 180, 60, ${this.beatFlash * 0.04})`;
      this.ctx.fillRect(0, 0, width, height);
    }
  }
}
