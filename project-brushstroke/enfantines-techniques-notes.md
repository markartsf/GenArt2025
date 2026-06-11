# Techniques extracted from Campos-Uribe, *Enfantines II* (fxhash)

Reference notes for GenArt2025 / brush-lab. Source: the published sketch's
`setup.js`, `bundle.js`, `mixbox.js`, `loading.js`. These files are kept as
**study material only** — they're written for a seed-driven, music-timed,
single-render generative token, so the value is in the techniques, not in
copy-pasting the code.

---

## 1. Mixbox — real pigment mixing (the headline)

`mixbox.js` is Secret Weapons' Mixbox: color mixing based on the Kubelka–Munk
model of how physical pigments behave. Ordinary screen color averages, so
blue + yellow = muddy grey. Mixbox makes blue + yellow = green, like paint.

- **API is trivial:** `mixbox.lerp(colorA, colorB, t)` — RGB in, RGB out.
- **Direct fit for brush-lab:** this *is* the "paint mixing when colors overlap"
  feature. The plain-JS `lerp` needs none of the shader machinery below — it can
  drop straight into the 2D canvas so overlapping strokes blend like pigment.
- **Multi-color mixing** (for >2 pigments) uses the latent form:
  `rgbToLatent` → weighted sum → `latentToRgb`.

### Licensing (important)
- Public Mixbox is **CC BY-NC 4.0 — non-commercial use only**. Posting sketches,
  videos, and screenshots to a personal art site (no sales) reads as
  non-commercial. *Not legal advice; the NC term licenses the code, with output
  status less explicit.*
- Commercial use (selling the app, or minting/selling the output) needs a paid
  license from **mixbox@scrtwpns.com**. Secret Weapons' stated position: you
  don't need it until you're ready to launch a product.
- **Note:** the `mixbox.js` inside the Enfantines bundle is a **commercial-
  licensed** build (its header says so) — the artist paid because the piece was
  minted/sold. Do **not** reuse that specific file. Use the public CC BY-NC
  build from `https://scrtwpns.com/mixbox.js` (or download it for offline use).

---

## 2. Mask-buffer-as-control-signal + shader compositing (advanced, future)

How Campos-Uribe applies Mixbox at scale: not in JS per-pixel, but via a GLSL
shader reading an offscreen "mask" buffer where **the RGBA channels are
instructions, not visible color**:

- **Green** = lay pigment here
- **Red** = darken this edge
- **Blue** = add texture / intensity
- **Alpha** = how strongly

The shader (`paintColor()` in `bundle.js`, three variants: marker / simple /
color) reads the mask and runs `mixbox_lerp(existingCanvasColor, newColor, t)`,
where `t` comes from the mask channels plus noise. That's how watercolor bleeds,
layers, and darkens convincingly at the edges.

- **Powerful but it's a real architecture shift** — WebGL compositing on top of
  a 2D painting model. File this as a deliberate brush-lab v2 / future-project
  decision, not a mid-stream insertion, unless watercolor fidelity becomes a
  milestone of its own.

---

## 3. `grow()` — organic watercolor edges (portable, no shader needed)

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

## 4. `LineStyle` — a clean multi-brush model (reference for presets)

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
| Mixbox `lerp` for overlap mixing | Low | **Now**, if overlap-mixing is in scope |
| `grow()` organic edges | Low–medium | Whenever the watercolor brush is touched |
| `LineStyle` preset structure | Low | As a documentation model for presets |
| Mask-buffer + GLSL pipeline | High | v2 / future "real-media" painter |

## Files
- Keep: `mixbox.js` *(public CC BY-NC build — not the bundle's commercial copy)*
- Study only: `setup.js`, `bundle.js`, `loading.js`
- Skip from project knowledge: the p5 libraries and the minified bundle bulk
