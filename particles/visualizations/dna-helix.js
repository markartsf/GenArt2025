// DNA Helix — Double helix with base-pair connections
// Bass → stretch, Mid → rotation, High → unwind, Beat → snap

let unwind;   // smoothed 0-1 driven by audio

export function init(count) {
  unwind = 0;
  return {};
}

export function frame(state, time, audio) {
  const high = audio ? audio.high : 0.03;
  const beat = audio ? audio.beat : 0;

  // Unwind driven by high frequencies, beat snaps it open
  const target = high * 0.6 + beat * 0.4;
  unwind += 0.08 * (target - unwind);
}

export function particleFn(i, count, target, color, time, THREE, addControl, setInfo, annotate, audio, state) {
  if (i === 0) setInfo('DNA Helix', 'Bass \u2192 stretch \u00b7 Mid \u2192 rotation \u00b7 High \u2192 unwind \u00b7 Beat \u2192 snap');

  const helixLen = addControl('length', 'Length', 50, 300, 160);
  const radius   = addControl('radius', 'Radius', 8, 60, 22);
  const twists   = addControl('twists', 'Twists', 3, 15, 8);

  const bass = audio ? audio.bass : 0.12;
  const mid  = audio ? audio.mid  : 0.08;
  const rms  = audio ? audio.rms  : 0.06;
  const beat = audio ? audio.beat : 0;

  // 3 roles: strand A (0), strand B (1), base pair (2)
  const role = i % 3;
  const idx  = (i / 3) | 0;
  const t    = idx / (count / 3);    // 0-1 along helix

  // Twist angle: unwind reduces the twist
  const twist = t * Math.PI * 2 * twists * (1 - unwind * 0.85)
              + time * (0.4 + mid * 1.5);

  // Y position along the helix axis
  const len = helixLen + bass * 60;
  const y   = (t - 0.5) * len;

  // Radius modulation
  const r = radius + Math.sin(t * 20 + time * 0.5) * 2 + rms * 8;

  // Strand A position
  const ax = Math.cos(twist) * r;
  const az = Math.sin(twist) * r;

  // Strand B position (180 degrees offset)
  const bx = Math.cos(twist + Math.PI) * r;
  const bz = Math.sin(twist + Math.PI) * r;

  if (role === 0) {
    // Strand A
    target.set(ax, y, az);
    color.setHSL(0.55, 0.85, 0.06 + rms * 0.16 + beat * 0.18);
  } else if (role === 1) {
    // Strand B
    target.set(bx, y, bz);
    color.setHSL(0.0, 0.85, 0.06 + rms * 0.16 + beat * 0.18);
  } else {
    // Base pair: connect the two strands at a pseudo-random position
    const bp = ((idx * 7 + 3) % 10) / 10;
    const px = ax + (bx - ax) * bp;
    const pz = az + (bz - az) * bp;
    target.set(px, y, pz);

    // Base pairs colored by type (AT vs GC, simplified)
    const pairHue = ((idx * 13) % 4) < 2 ? 0.12 : 0.30;
    color.setHSL(pairHue, 0.65, 0.04 + rms * 0.12 + beat * 0.14);
  }
}
