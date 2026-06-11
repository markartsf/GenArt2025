# Techniques extracted from Campos-Uribe, *Enfantines II* (fxhash)

Reference notes for GenArt2025 / brush-lab. Source: the published sketch's
`setup.js`, `bundle.js`, `mixbox.js`, `loading.js`. These files are kept as
**study material only** — they're written for a seed-driven, music-timed,
single-render generative token, so the value is in the techniques, not in
copy-pasting the code.

---

## 1. Pigment mixing — deferred to SPEC §1

The Enfantines bundle does its "blue + yellow → green" mixing with Mixbox
(Secret Weapons' Kubelka–Munk model), and applies it at scale through a GLSL
shader reading an offscreen mask buffer where the RGBA channels are
instructions, not visible colour. That's the headline technique of the piece.

**We don't adopt that approach, and this note makes no library recommendation.**
The pigment-layer decision is owned by `SPEC.md` §1 (Pigment-layer nouns), which
is settled: realistic subtractive mixing is produced by **p5.brush's native
subtractive blend** (overlapping marks mix as pigment automatically, p5.brush
2.1.9-beta) — *not* an external Mixbox/Spectral.js/p5.blender dependency, and
*not* an owned shader stage (that path, including the mask-buffer compositor, is
**parked**). See SPEC §1 for the full rationale and the spike history.

If you came here looking for the pigment call, stop and read SPEC §1 — don't
re-derive it from the bundle.

---

## 2. `grow()` — organic watercolor edges (portable, no shader needed)

The irregular, living edges of his watercolor blobs come from a recursive
polygon routine (`Tip.grow()`):

1. Start with a coarse polygon.
2. For each edge, insert a midpoint and push it outward by a Gaussian-jittered
   amount.
3. Stack several "grown" copies at different opacities.

This is **pure 2D geometry** — portable to brush-lab as-is, and it answers the
"more organic brush shapes" item for the watercolor brush. (Same family of trick
Tyler Hobbs documents for watercolor.)

---

## 3. `LineStyle` — a clean multi-brush model (reference for presets)

His dry-media engine: pen, rotring, 2B / HB / 2H pencil, charcoal, marker, spray.
Mechanically it's just **stipple circles stamped along a path** with a
**bell-curve "pressure" falloff** so strokes taper at the ends. Each brush is a
tidy parameter set: `weight, vibration, definition, quality, opacity, step`.

- Even without porting the code, it's a good template for **how to structure and
  document brush presets** in brush-lab — one row per brush, same six knobs.

---

## What to reuse, and when

| Technique | Effort | For brush-lab |
|---|---|---|
| Pigment mixing | — | **Decided in SPEC §1** (p5.brush native blend) — not this note's call |
| `grow()` organic edges | Low–medium | Whenever the watercolor brush is touched |
| `LineStyle` preset structure | Low | As a documentation model for presets |

## Files
- Study only: `setup.js`, `bundle.js`, `loading.js`, `mixbox.js`
- Skip from project knowledge: the p5 libraries and the minified bundle bulk
