// Fall Color Palette
export const FallColors = {
  // Background
  background: '#1a0a0a', // Deep dark red/black

  // Main palette colors
  neutralYellow: { h: 50, s: 45, l: 65 },
  cadmiumYellow: { h: 48, s: 95, l: 55 },
  naphtholRed: { h: 355, s: 85, l: 45 },
  cadmiumOrange: { h: 25, s: 90, l: 55 },
  neutralOrange: { h: 30, s: 60, l: 55 },
  brown: { h: 25, s: 45, l: 35 },
  burgundy: { h: 345, s: 65, l: 30 },

  // Array for easy iteration - EXPANDED RICH PALETTE
  palette: [
    { h: 50, s: 45, l: 65, name: 'neutralYellow' },
    { h: 48, s: 95, l: 55, name: 'cadmiumYellow' },
    { h: 40, s: 75, l: 58, name: 'neutralYellowishOrange' },
    { h: 355, s: 85, l: 45, name: 'naphtholRed' },
    { h: 0, s: 75, l: 35, name: 'darkRed' },
    { h: 345, s: 65, l: 30, name: 'burgundy' },
    { h: 15, s: 60, l: 40, name: 'burntSienna' },
    { h: 25, s: 90, l: 55, name: 'cadmiumOrange' },
    { h: 30, s: 60, l: 55, name: 'neutralOrange' },
    { h: 25, s: 45, l: 35, name: 'brown' },
    { h: 280, s: 65, l: 35, name: 'deepPurple' },
    { h: 300, s: 55, l: 40, name: 'plum' }
  ],

  // Get a color from the palette by index
  getColor(index, alpha = 1) {
    const color = this.palette[index % this.palette.length];
    return `hsla(${color.h}, ${color.s}%, ${color.l}%, ${alpha})`;
  },

  // Get a color with audio modulation
  getAudioColor(index, audioFeatures, alpha = 1) {
    const color = this.palette[index % this.palette.length];
    // Modulate lightness and saturation based on audio
    const lightness = Math.min(85, color.l + audioFeatures.rms * 40);
    const saturation = Math.min(100, color.s + audioFeatures.high * 30);
    return `hsla(${color.h}, ${saturation}%, ${lightness}%, ${alpha})`;
  },

  // Get color based on audio spectral features
  getSpectralColor(spectralValue, audioFeatures, alpha = 1) {
    // Map spectral value (0-1) to palette index
    const index = Math.floor(spectralValue * this.palette.length);
    const color = this.palette[index % this.palette.length];

    // Enhance with audio features
    const lightness = Math.min(85, color.l + audioFeatures.bass * 35);
    const saturation = Math.min(100, color.s + audioFeatures.mid * 25);

    return `hsla(${color.h}, ${saturation}%, ${lightness}%, ${alpha})`;
  },

  // Get warm glow color
  getGlowColor(index, intensity = 1) {
    const color = this.palette[index % this.palette.length];
    const lightness = Math.min(90, color.l + intensity * 50);
    return `hsl(${color.h}, ${color.s}%, ${lightness}%)`;
  }
};

// Camera system for dramatic movement
export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.rotation = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.targetZoom = 1;
    this.targetRotation = 0;
    this.smoothing = 0.05;
  }

  update(audioFeatures) {
    // Audio-driven camera movement
    // Bass drives zoom pulsing
    this.targetZoom = 1 + audioFeatures.bass * 0.3;

    // Mid frequencies drive gentle panning
    this.targetX = Math.sin(Date.now() * 0.0002) * audioFeatures.mid * 50;
    this.targetY = Math.cos(Date.now() * 0.0003) * audioFeatures.mid * 50;

    // Spectral centroid drives rotation
    this.targetRotation += (audioFeatures.spectralCentroid / 5000) * 0.001;

    // High frequencies add jitter
    if (audioFeatures.high > 0.3) {
      this.targetX += (Math.random() - 0.5) * audioFeatures.high * 20;
      this.targetY += (Math.random() - 0.5) * audioFeatures.high * 20;
    }

    // Smooth interpolation
    this.x += (this.targetX - this.x) * this.smoothing;
    this.y += (this.targetY - this.y) * this.smoothing;
    this.zoom += (this.targetZoom - this.zoom) * this.smoothing;
    this.rotation += (this.targetRotation - this.rotation) * this.smoothing;
  }

  apply(ctx, width, height) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.rotate(this.rotation);
    ctx.translate(-width / 2 + this.x, -height / 2 + this.y);
  }

  restore(ctx) {
    ctx.restore();
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.rotation = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.targetZoom = 1;
    this.targetRotation = 0;
  }
}
