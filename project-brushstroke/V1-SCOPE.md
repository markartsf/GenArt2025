# Project Brushstroke — V1.0 Scope

*Ship-now native piece. Lives at `project-brushstroke/V1-SCOPE.md`. This is the
build spec for the Code agent. It runs **parallel** to the KM-compositor track and
deliberately shares none of its machinery.*

---

## What V1.0 is

A standalone audio-reactive piece: **Ribbon + Burst** generators rendering
**natively through p5.brush**, accreting toward a final frame as the track plays,
with **density driven by audio energy**. House palette, cream ground. One track:
`winterland` (2:01).

It is intentionally the *simple* path. It renders p5.brush marks straight to the
canvas — **no KM compositor, no owned mask, no plate stack**. That is the whole
reason it can move fast: the premultiplied-alpha fringe question, the plate-cache,
and the owned-pigment route belong to the compositor track and **do not touch this
piece**. There is nothing to rasterize and re-composite here.

---

## 1. Stack & delivery target

- p5.js 2.x + **p5.brush 2.1.9-beta** (the p5 build — needs a **WEBGL** canvas).
- **Built on disk**, served (`npx vite …` or `python3 -m http.server`), so it can
  fetch the local `winterland.mp3` and run at real retina. This is *not* a
  Claude.ai chat artifact — the iframe Web-Audio/CDN constraints don't apply on disk.
  It can be packaged as a single standalone HTML later if we want a portable copy.
- Audio routed/auditioned per README (BlackHole available; not required — the piece
  decodes the file directly, see §4).

## 2. Generators — Ribbon + Burst

Both already exist and are tuned natively in `brush-lab.html`. V1.0 **consumes**
them; it does not re-implement them and does not embed a lab.

- **Ribbon** — station-based comb riding a spline. `allowedBrushes: ['pen','marker']`
  (respect the per-generator constraint — SPEC §0).
- **Burst** — radial spokes from a center. Unconstrained brush set.
- Each generator's marks stamp directly via p5.brush in one palette colour per
  `brush.set()` (SPEC §0 — never one brush, many colours; multicolour = consecutive
  stations/spokes cycle the palette).
- Mark scale stays **small relative to frame** (DESIGN #7) — many fine marks, ground
  leading. This is a ship target, not the blown-up spike framing.

Bloom / Fan / Field Marks / Linework are **V1.x**, added later as presets (see §10).
**Tuft is out** until its native-raster rewrite lands on the compositor track.

## 3. Palette — house set (proven, m2)

The default baked into `brush-lab` and both bundled presets. Do not introduce a
palette menu; one palette, per-swatch tuning only.

```
marks   #e63946  #1d3557  #e9c46a  #2a9d8f  #c97fa8  #7d4f2a  #f1faee
ground  #efe7d8
```

Mostly mid-to-light members that mix cleanly under p5.brush's native subtractive
blend; navy + brown are the darker placed-depth notes (sparse use — they collapse
in dense pile-ups, per m2). Ground stays quiet (DESIGN #8). Flowering Trees is a
deliberate V1.x mood variant only — not the V1.0 default, and unverified for pigment.

## 4. Audio & reactivity — `winterland` (2:01)

- **Energy arc** (measured, corrected track 2026-07-01): quiet-ish open (~0.1–0.15
  normalized RMS) → sustained mid-energy activity (avg active ≈ 0.31, busier
  throughout than a single build/peak/fade shape) → highest activity late, around
  ~84s → settles into the close. No single dramatic peak — density should track the
  FFT energy continuously rather than assuming a fixed build/peak/fade timeline.
- **Density is the primary — and for V1.0, the only required — audio lever**
  (DESIGN: audio drives *form*, not just brightness). Map audio energy → mark
  **accretion rate**: quiet ⇒ sparse, energy ⇒ more marks laid per unit time. The
  build fills the frame; the plateau is densest; the closing fade lays no new marks
  while the frame holds (append-only — see §5). Density tracks the build, never
  un-draws on the fade.
- **AudioContext discipline is non-negotiable** — follow PATTERNS → *Safari
  AudioContext rules*: create the `AudioContext` **synchronously inside the user
  gesture, before any `await`**; then `file.arrayBuffer()` → `decodeAudioData()` →
  `AudioBufferSourceNode`, with an `AnalyserNode` for the FFT. Gesture-gate playback
  (a click to start). Don't restate the rule in code comments — point to PATTERNS.
  - **SAFARI GOTCHA (confirmed 2026-07-02, `7b8803f`):** two things silenced *speaker*
    output while the FFT + recording tap still got signal (context "running", capture works,
    speakers dead). (1) Autoplay: a running context can keep audible output muted until a
    gesture actually plays a sound — kick it with a 1-sample silent buffer to `destination` in
    the click. (2) A `MediaStreamAudioDestinationNode` connected alongside `destination`
    **mutes the speakers on Safari** — connect the recording tap ONLY while recording,
    disconnect on stop; plain playback stays a clean speaker-only graph.
- **Responsiveness beyond density** (2026-07-02, Mark's direction — audio should read
  as reactive, not just "fills faster/slower"). All append-only / dry-media safe;
  audio mode becomes emergent (not seed-reproducible), manual/static stay seed-only:
  - **Energy → mark boldness/size — BUILT.** The stroke laid at each instant scales
    weight + tooth-length with the current smoothed FFT energy (loud ⇒ bold/large,
    quiet ⇒ faint/small), captured once at the stroke's birth. `audio → boldness`
    slider (0 = off). Directly fulfils DESIGN's *audio drives form*.
  - **Transient flurries — BUILT.** Spectral-flux onset detection (positive frame-to-
    frame FFT change, adaptive baseline + refractory) → on a note attack, release a
    cluster of strokes at once (bump the reveal clock), which snap in bold via the
    boldness lever; `transient flurry` slider = strokes/hit (0 = off). Note: this ambient
    track has few sharp transients, so flurries punctuate rather than dominate.
  - **Colour ↔ sound (synaesthesia) — V1.1/1.2 direction** (Mark's core app idea:
    colour responding to energy/transients/spectral content). Deliberately deferred
    past V1.0; the hardest and most conceptually central lever.
  - Richer *moving* reactivity (a live layer that shimmers with the sound) stays
    **M4 / compositor-track** work — dense-perf spike bound per-frame modulation to a
    single dirty layer; V1 keeps "marks only ever arrive," never re-touched.
- **Audio upload — BASIC BUILT** (2026-07-02, `6f5ef30`). "Load track…" plays the reveal
  against any local file (overrides the baked `winterland.mp3`); everything downstream is
  track-agnostic. Deliberately basic: **no per-track calibration yet** — the rate/boldness/
  flurry mappings are tuned to winterland, so a very different track may need the sliders
  hand-tuned. **V1.1: per-track auto-normalization** (analyze peak/avg energy on load →
  scale the mappings so any track "just works"), bundled with the packaging/standalone pass.

## 5. Reveal model — emergent accretion (NOT authored-endpoint)

V1.0 uses **append-only / draw-on**: marks accrete over the track and **hold**; the
canvas is never cleared mid-piece. The final frame is whatever **seed + track**
produce — emergent, reproducible, saved when good (DESIGN: *emergence over
composition*; *save seeds when a variant is good*).

This is a deliberate scope cut: the **authored-final-frame reveal** (compose the
endpoint first, choreograph entrances toward it) belongs to the compositor / compose
host, not here. V1.0 trades authored control for speed and emergence.

- One seed drives the whole piece; expose seed + reseed (the `seed×7+1` convention)
  and a save-seed affordance.
- `pixelDensity(2)` and canvas size are set **once at setup**.
- **Reveal order = ENTRANCE order** (DECIDED 2026-07-02, Mark + planning agent; built
  `<pending>`). Marks reveal in generation-index order — **no authored/directed sequence**
  (ground→midground→hero region-by-region rejected: reads as "slideshow assembling," cuts
  against emergence). Regulars are shuffled → incidental interleave of regions/types.
  Heroes are *placed* first (additive-hero property) but **interleaved into the reveal**
  (`revealOrder()` inserts each hero at a deterministic 35–80% point) so the focal mark
  emerges amid the fog, not announced first during the quiet opening. Marks seed by a
  stable `id` (placement index), never by reveal position → look is fixed whenever a mark
  enters, and the static frame is unaffected by the interleave.

## 6. Hard constraints (from PATTERNS / SPEC — do not rediscover)

- **`pixelDensity(2)` once at top of setup; never toggle at runtime.**
- **Never `resizeCanvas` a p5.brush WEBGL canvas at runtime** — it corrupts
  p5.brush's internal framebuffer (block/checkerboard tearing until reload). Size
  once at setup; window-resize ⇒ reload to refit.
- Bend Field is the only sanctioned wiggle mechanism (native p5.brush vector flow
  field) — **not** position jitter or per-tooth sine (both ruled out, PATTERNS).
- p5.blender / owned KM / mask buffer are **not part of this piece** — native blend only.

## 7. Out of scope (V1.0)

KM compositor · owned mask · plate-cache · premult-alpha fringe work · Tuft ·
authored compose host · `brushstroke.composition` save/load schema · embedded brush
lab · weathering overlay · M4 audio→single-layer modulation. None of these gate V1.0.

## 8. One open implementation question (resolve early — possible 30-min spike)

**How to accumulate marks across frames on a WEBGL p5.brush canvas.** The main p5
WEBGL framebuffer clears each frame, but the reveal is append-only. Two candidate
paths for the Code agent to settle before building the reveal loop:
  - (a) stamp into a **persistent p5.brush-drawn buffer** and present it each frame, or
  - (b) **re-stamp all marks-so-far** each frame (simplest, but watch cost as the
    count climbs toward the dense plateau — the static-stack timing in SPEC §4·3b
    is a caution, though that was the KM path, not native).
Pick by a quick spike; written finding only, not committed as a feature.

## 8b. Packaging & delivery — BUILT (2026-07-02)

- **Self-contained:** p5 (2.3.0) + p5.brush (2.1.9-beta) vendored to `v1/lib/`; no CDN
  at runtime, no build step. `winterland.mp3` local.
- **Canvas fits the display:** sized to the screen at load (`sizeFrameToDisplay`, reload
  to re-fit — runtime resize forbidden); `SCALE` keeps marks proportional so density holds.
  Presentation mode (P) hides the panel + fills; Fullscreen (F). Both local + hosted.
- **Play ▶ doubles as ■ Stop** while a track plays (also stops on track end / Reseed).
- **Video capture (R):** `MediaRecorder` records a playthrough — prefers **MP4 (H.264/AAC)**
  so it plays natively on macOS, falls back to webm only if the browser can't mux mp4; file
  named by real container. Offscreen record canvas matches the display aspect at ~1080p
  height (full-frame, no letterbox), muxed with the track's audio; auto-downloads at track
  end. Chrome-best; graceful message where unsupported.
- **Netlify:** repo-root `netlify.toml` publishes `project-brushstroke/v1` (static, no
  build); deploy via drag-drop / CLI / git-connect — see `v1/v1.0-README.md`. HTTPS satisfies
  the Web-Audio-needs-HTTP constraint. Mark runs the actual deploy (needs his account).
- **Deferred to V1.1:** per-track audio auto-normalization (so any uploaded track "just
  works" without hand-tuning the rate/boldness/flurry sliders).

## 9. V1.x roadmap

- **V1.1 / V1.2:** fold in the remaining non-Tuft generators (Bloom, Fan, Field
  Marks, Linework) one increment at a time, each as a tuned preset on the house palette.
- **Mood variant:** Flowering Trees palette pass, once pigment-checked by eye.
- **Tuft:** joins only after its native-raster rewrite ships on the compositor track.
