// Palette + ground for the owned pigment pipeline (M3).
// 7-entry palette indexed by mask.R (id = floor(R*7)); lighter-blue-leaning per the
// m2 finding that lighter blues KM-mix cleaner. Cream ground per the Enfantines plates.
export const CREAM = [239, 231, 216];
export const PALETTE = ['#e63946', '#3a88fe', '#fffc41', '#ff8647', '#2a9d8f', '#74a7fe', '#f1faee'];
export const NPAL = PALETTE.length; // 7

export function hexRGB(h) {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
