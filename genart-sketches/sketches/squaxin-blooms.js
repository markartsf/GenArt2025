// Squaxin Park, Olympia WA — Japanese maple & magnolia blooms
// Palette: cream/butter magnolia tepals, scarlet/crimson maple leaves

export class SquaxinBlooms {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.blooms = [];
    this.mapleLeaves = [];
    this.fallingPetals = [];
    this.beatFlash = 0;
    this.beatCooldown = 0;
    this.rmsWin = new Array(10).fill(0);
    this.rmsWinIdx = 0;
    this.time = 0;
    this.reset();
  }

  get dpr() { return window.devicePixelRatio || 1; }
  get w() { return this.canvas.width / this.dpr; }
  get h() { return this.canvas.height / this.dpr; }

  reset() {
    this.blooms = [];
    this.mapleLeaves = [];
    this.fallingPetals = [];
    this.beatFlash = 0;
    this.beatCooldown = 0;
    this.time = 0;
    this._buildScene();
  }

  _buildScene() {
    const w = this.w, h = this.h;

    // ── Magnolia bloom field ──────────────────────────────────────────────
    // Scattered across the canvas — denser in the upper-right, some everywhere.
    // z-depth controls size (closer = larger) and draw order.
    const bloomCount = 65;
    for (let i = 0; i < bloomCount; i++) {
      // Bias toward upper-right to mirror the photo composition
      const clusterRight = Math.random() < 0.65;
      const x = clusterRight
        ? w * 0.38 + Math.random() * w * 0.62
        : Math.random() * w;
      const y = clusterRight
        ? Math.random() * h * 0.80
        : Math.random() * h * 0.95;

      const z = Math.random();                       // 0 = far, 1 = close
      const baseSize = 10 + z * 22 + Math.random() * 8;

      this.blooms.push({
        x, y, baseSize,
        numPetals: 6 + Math.floor(Math.random() * 3),
        rot: Math.random() * Math.PI * 2,
        tilt: (Math.random() - 0.25) * 0.45,
        hue: 44 + Math.random() * 16,
        sat: 55 + Math.random() * 30,
        lit: 72 + Math.random() * 18,
        phase: Math.random() * Math.PI * 2,
        z,
        alpha: 0.45 + z * 0.55,  // distant blooms more transparent
      });
    }
    // Sort back-to-front
    this.blooms.sort((a, b) => a.z - b.z);

    // ── Japanese maple canopy ─────────────────────────────────────────────
    // Elliptical cloud weighted lower-left; some leaves spill toward center.
    const cx = w * 0.22, cy = h * 0.60;
    const rx = w * 0.24, ry = h * 0.40;

    for (let i = 0; i < 260; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      const x = cx + Math.cos(ang) * rx * r;
      const y = cy + Math.sin(ang) * ry * r;

      const rawHue = Math.random() * 28 - 8;
      const hue = ((rawHue % 360) + 360) % 360;

      this.mapleLeaves.push({
        x, y,
        size: 7 + Math.random() * 15,
        rot: Math.random() * Math.PI * 2,
        lobes: 5 + Math.floor(Math.random() * 3),
        hue,
        sat: 88 + Math.random() * 12,
        lit: 30 + Math.random() * 24,
        alpha: 0.65 + Math.random() * 0.35,
        swayPhase: Math.random() * Math.PI * 2,
        swayFreq: 0.007 + Math.random() * 0.007,
        swayAmp: 0.03 + Math.random() * 0.06,
        z: Math.random(),
      });
    }
    this.mapleLeaves.sort((a, b) => a.z - b.z);
  }

  _drawMagnoliaBloom(bloom, openness, glow) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(bloom.x, bloom.y);
    ctx.rotate(bloom.rot);
    ctx.globalAlpha = bloom.alpha;

    const n = bloom.numPetals;
    const size = bloom.baseSize * (1 + openness * 0.22);

    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.rotate((i / n) * Math.PI * 2 + bloom.tilt);

      const L = size;
      const W = size * 0.46;

      if (glow > 0.05) {
        ctx.shadowBlur = glow * 14;
        ctx.shadowColor = `hsla(${bloom.hue + 5}, 70%, 90%, 0.6)`;
      }

      // Amber-brown base → butter cream belly → pale translucent tip
      const grad = ctx.createLinearGradient(0, 0, 0, -L);
      grad.addColorStop(0.00, `hsla(${bloom.hue - 14}, ${bloom.sat + 5}%, ${bloom.lit - 22}%, 0.92)`);
      grad.addColorStop(0.30, `hsla(${bloom.hue - 4}, ${bloom.sat}%, ${bloom.lit}%, 0.93)`);
      grad.addColorStop(0.70, `hsla(${bloom.hue + 6}, ${bloom.sat - 15}%, ${bloom.lit + 12}%, 0.88)`);
      grad.addColorStop(1.00, `hsla(${bloom.hue + 12}, ${bloom.sat - 32}%, ${bloom.lit + 18}%, 0.5)`);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-W * 0.35, -L * 0.12, -W, -L * 0.38, -W * 0.85, -L * 0.68);
      ctx.bezierCurveTo(-W * 0.55, -L * 0.88, -W * 0.18, -L * 1.02, 0, -L * 1.05);
      ctx.bezierCurveTo( W * 0.18, -L * 1.02,  W * 0.55, -L * 0.88,  W * 0.85, -L * 0.68);
      ctx.bezierCurveTo( W, -L * 0.38,  W * 0.35, -L * 0.12, 0, 0);

      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${bloom.hue - 20}, 45%, 36%)`;
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // scale: uniform scale applied after translate (audio-driven)
  // jx/jy: positional jitter (bass + beat driven)
  _drawMapleLeaf(leaf, totalRot, scale, jx, jy) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(leaf.x + jx, leaf.y + jy);
    ctx.rotate(totalRot);
    if (scale !== 1) ctx.scale(scale, scale);

    const n = leaf.lobes;
    const outer = leaf.size;
    const inner = leaf.size * 0.17;

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const outerAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const prevInner  = outerAngle - Math.PI / n;
      const nextInner  = outerAngle + Math.PI / n;

      const ix1 = Math.cos(prevInner) * inner, iy1 = Math.sin(prevInner) * inner;
      const ox  = Math.cos(outerAngle) * outer, oy  = Math.sin(outerAngle) * outer;
      const ix2 = Math.cos(nextInner) * inner,  iy2 = Math.sin(nextInner) * inner;

      const cpOff = Math.PI / (n * 1.85);
      const cp1x = Math.cos(outerAngle - cpOff) * outer * 0.72;
      const cp1y = Math.sin(outerAngle - cpOff) * outer * 0.72;
      const cp2x = Math.cos(outerAngle + cpOff) * outer * 0.72;
      const cp2y = Math.sin(outerAngle + cpOff) * outer * 0.72;

      if (i === 0) ctx.moveTo(ix1, iy1);
      ctx.quadraticCurveTo(cp1x, cp1y, ox, oy);
      ctx.quadraticCurveTo(cp2x, cp2y, ix2, iy2);
    }
    ctx.closePath();

    ctx.fillStyle = `hsla(${leaf.hue}, ${leaf.sat}%, ${leaf.lit}%, ${leaf.alpha})`;
    ctx.fill();

    if (leaf.size > 13) {
      ctx.strokeStyle = `hsla(${leaf.hue - 8}, ${leaf.sat - 22}%, ${leaf.lit - 12}%, 0.28)`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, outer * 0.12);
      ctx.lineTo(0, -outer * 0.82);
      ctx.stroke();
    }

    ctx.restore();
  }

  _spawnPetals(count) {
    const w = this.w, h = this.h;
    for (let i = 0; i < count; i++) {
      this.fallingPetals.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.8,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 0.4 + Math.random() * 0.9,
        rot: Math.random() * Math.PI * 2,
        rV: (Math.random() - 0.5) * 0.05,
        size: 4 + Math.random() * 8,
        hue: 44 + Math.random() * 16,
        sat: 58 + Math.random() * 26,
        lit: 72 + Math.random() * 16,
        life: 1.0,
      });
    }
    if (this.fallingPetals.length > 100) {
      this.fallingPetals.splice(0, this.fallingPetals.length - 100);
    }
  }

  _updateFallingPetals() {
    const ctx = this.ctx;
    const h = this.h;
    this.fallingPetals = this.fallingPetals.filter(p => p.life > 0.02 && p.y < h + 30);

    for (const p of this.fallingPetals) {
      p.x += p.vx + Math.sin(p.rot * 1.8) * 0.28;
      p.y += p.vy;
      p.rot += p.rV;
      p.vx *= 0.993;
      p.life -= 0.007;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.life * 0.85;
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-s * 0.35, -s * 0.28, -s * 0.44, -s * 0.65, 0, -s);
      ctx.bezierCurveTo( s * 0.44, -s * 0.65,  s * 0.35, -s * 0.28, 0, 0);
      ctx.fillStyle = `hsl(${p.hue}, ${p.sat}%, ${p.lit}%)`;
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  draw(audioFeatures) {
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    const { bass, mid, high, rms } = audioFeatures;

    this.time++;

    // Beat detection via local RMS average
    this.rmsWin[this.rmsWinIdx % 10] = rms;
    this.rmsWinIdx++;
    const avgRMS = this.rmsWin.reduce((a, b) => a + b, 0) / 10;
    if (rms - avgRMS > 0.015 && this.beatCooldown === 0) {
      this.beatFlash = 1.0;
      this.beatCooldown = 15;
      this._spawnPetals(3 + Math.floor(bass * 35));
    }
    if (this.beatCooldown > 0) this.beatCooldown--;
    this.beatFlash *= 0.87;

    const sBass = Math.min(1, bass * 7);
    const sMid  = Math.min(1, mid * 9);
    const sHigh = Math.min(1, high * 18);

    // Full clear on first frame so previous sketch doesn't bleed through
    if (this.time === 1) {
      ctx.fillStyle = 'rgb(5, 8, 16)';
      ctx.fillRect(0, 0, w, h);
    }

    // Trailing background
    ctx.fillStyle = 'rgba(5, 8, 16, 0.13)';
    ctx.fillRect(0, 0, w, h);

    // Subtle sky glow (upper right)
    const skyG = ctx.createRadialGradient(w * 0.78, h * 0.06, 0, w * 0.78, h * 0.06, w * 0.55);
    skyG.addColorStop(0, 'rgba(22, 52, 108, 0.05)');
    skyG.addColorStop(1, 'rgba(5, 8, 16, 0)');
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, w, h);

    // Faint chartreuse foliage haze
    const foliageG = ctx.createRadialGradient(w * 0.58, h * 0.12, 0, w * 0.58, h * 0.12, w * 0.42);
    foliageG.addColorStop(0, 'rgba(88, 128, 12, 0.03)');
    foliageG.addColorStop(1, 'rgba(5, 8, 16, 0)');
    ctx.fillStyle = foliageG;
    ctx.fillRect(0, 0, w, h);

    // 1. Magnolia bloom field (background layer, behind maple)
    const openness = sMid * 0.8 + this.beatFlash * 0.3;
    const glow     = sHigh * 0.7 + this.beatFlash * 0.45 + 0.06;
    const breathe  = Math.sin(this.time * 0.014) * 0.04;

    ctx.shadowBlur = 0;
    for (const bloom of this.blooms) {
      const swayX = Math.sin(this.time * 0.009 + bloom.phase) * 1.2;
      this._drawMagnoliaBloom(
        { ...bloom, baseSize: bloom.baseSize * (1 + sMid * 0.14 + breathe), x: bloom.x + swayX },
        openness, glow
      );
    }

    // 2. Maple leaves — bass drives scale + jitter, beat drives scatter
    //    Each leaf visibly grows and shakes with the music.
    const leafScale = 1 + sBass * 0.38 + this.beatFlash * 0.22;

    for (const leaf of this.mapleLeaves) {
      const windSway = Math.sin(this.time * leaf.swayFreq + leaf.swayPhase) * leaf.swayAmp;
      // Bass jitter: each leaf has a unique phase so they don't all move in lockstep
      const jx = sBass * Math.sin(leaf.swayPhase * 2.1 + this.time * 0.03) * 10
               + this.beatFlash * Math.cos(leaf.swayPhase * 3.7) * 7;
      const jy = sBass * Math.cos(leaf.swayPhase * 1.7 + this.time * 0.025) * 6
               + this.beatFlash * Math.sin(leaf.swayPhase * 2.9) * 5;

      ctx.shadowBlur = 0;
      this._drawMapleLeaf(leaf, leaf.rot + windSway, leafScale, jx, jy);
    }

    // 3. Falling petals (front layer)
    this._updateFallingPetals();

    ctx.shadowBlur = 0;
  }

  dispose() {}
}
