# GenArt2025 — Technical Patterns

Reusable scaffolds, hard-won gotchas, and canonical recipes for this project. When starting a new sketch, scan this first instead of rediscovering.

---

## Environment

- **Machine:** MacBook Pro M2
- **Project root:** `iCloud Drive/GenArt2025/`
- **Dev server:** `localhost:5173` (Vite) — or `python3 -m http.server 8080` for standalone HTML
- **System audio routing:** BlackHole (for audio-reactive sketches capturing system output)
- **Primary stack:** Three.js, p5.js, WebGL/GLSL shaders
- **Secondary/exploratory:** Blender 5.0, ISF (via VDMX, not Motion)

---

## Audio-reactive: the non-negotiables

These have bitten me more than once. Treat as rules, not suggestions.

### Safari AudioContext

- AudioContext **must be created synchronously inside a user gesture** (click, touch, keydown).
  - Creating it in an async handler after an `await` breaks autoplay policy.
  - Pattern: button click → `new AudioContext()` on the first line → then await anything you need.
- Use **callback-style `decodeAudioData`**, not the promise form. Safari's promise implementation is unreliable across versions.
  ```js
  audioCtx.decodeAudioData(arrayBuffer, (buffer) => { /* success */ }, (err) => { /* fail */ });
  ```
- **No *speaker* audio though the FFT/recording work? (Safari)** Two causes, both seen in Project Brushstroke (`7b8803f`). The tell: context is `running`, the analyser reads energy, a MediaRecorder capture has the sound — but the speakers are silent.
  1. **Autoplay output stays muted** even on a "running" context until a gesture actually *plays* a sound. Kick it in the click: play a 1-sample silent buffer to `destination`.
     ```js
     const b = ctx.createBuffer(1, 1, ctx.sampleRate); const s = ctx.createBufferSource();
     s.buffer = b; s.connect(ctx.destination); s.start(0);
     ```
  2. **A `MediaStreamAudioDestinationNode` connected alongside `ctx.destination` silences the speakers on Safari.** If you tap audio for recording/WebRTC, connect that tap **only while capturing** and `disconnect()` it after — keep normal playback a clean speaker-only graph.

### File serving

- `file://` URLs **block Web Audio API**. Always serve over HTTP.
- Quick local server: `python3 -m http.server 8080` from the sketch directory.
- Vite dev server (`localhost:5173`) works fine.

### Canonical UI pattern

Every audio-reactive sketch gets two buttons, top-right corner:
- **Enable Audio** (triggers AudioContext creation + mic/file request)
- **Fullscreen** (`document.documentElement.requestFullscreen()`)

Keep them unobtrusive but visible. Hide on fullscreen if desired.

### FFT → visual mapping (canonical defaults)

```
bass   → low frequencies (roughly bins 0–10)    → scale, expansion, mass
mids   → mid frequencies (bins 10–100)          → distortion, warp, turbulence
highs  → high frequencies (bins 100+)           → rotation, flicker, detail
```

Always smooth with `lerp(prev, current, 0.1–0.2)` — raw FFT values are jittery and will make visuals feel twitchy rather than alive.

---

## Three.js scaffolds

### GPU particle system (learned from Plexus Supernova, 60k particles)

- Use `BufferGeometry` + custom `ShaderMaterial`, never `Points` with per-instance JS updates.
- Pass audio values as uniforms (`uBass`, `uMids`, `uHighs`, `uTime`).
- Do motion in the vertex shader — CPU-side position updates cap out around 10k particles on M2.
- Additive blending (`THREE.AdditiveBlending`) + dark background is the reliable "glowing" look.

### Morphing parametric surfaces (Klein / Boy / Enneper / Gyroid blend)

- Compute all target surfaces in the vertex shader, `mix()` between them via a uniform.
- Use a single high-res `ParametricGeometry` or a `PlaneGeometry` with UV-driven displacement.
- Slow blends (10+ seconds between forms) read better than fast ones — the math is already doing a lot.

### Camera / controls

- `OrbitControls` for exploration, disable for performance pieces.
- For fullscreen installation mode: slow auto-rotation at ~0.1 rad/sec feels meditative.

---

## p5.js scaffolds

### Tunnel / circle-packing hybrid (from the February sketch)

- Mouse position drives composition drift via `lerp` — never snap directly to mouse coords, it looks nervous.
- Mouse X → rotation, Mouse Y → bezier distortion, distance-from-center → field scale.
- Audio layer on top: bass → expansion, mids → distortion, highs → rotation speed.

### Seeded randomness

- Always `randomSeed()` at the top of `setup()` with a known seed during development.
- Expose the seed as a URL parameter for reproducibility: `?seed=12345`.
- When you find a good variant, **save the seed** in a comment or sidecar file.

### Seeded exploration harness

Reusable dev wrapper for stepping through seed space while tuning a sketch.
Lives at `templates/seed-harness.html` — copy it, drop your algorithm into the
VARIABLE block. It is a *development* tool, not a shipping chrome: the finished
piece is the fullscreen canvas (see Composition → "the frame is the piece").

- Builds on Seeded randomness above: `randomSeed(seed)` + `noiseSeed(seed)` at
  the top of a single `initSystem()` the harness calls.
- Reproducibility contract: same seed → same *initial state*. Motion may still
  evolve over time (motion is the medium); only stochastic structure is pinned.
  One stray `Math.random()` breaks it — keep all randomness in seeded
  `random()`/`noise()`.
- Controls (monospace, top-left, `h` to hide, auto-hidden in fullscreen): seed
  readout · prev/next/random · jump-to-seed · regen · reset-params · freeze ·
  save PNG. Seed reflects to the URL (`?seed=`), same convention as above.
- `freeze` is the still-grab: pause, then PNG. Aligns with "let things rest."
- Chrome is deliberately recessive — near-black, monospace, unbranded
  (live-coding/demoscene lineage, *not* the gallery viewer; see Scoped out).

### Brushstroke — Bend Field (the Enfantines wiggle)

The gestural stroke wiggle in Project Brushstroke comes from p5.brush's native
**vector flow field** bending each stroke as it's drawn — confirmed against
Campos Uribe's `setup.js`. It is NOT position jitter and NOT per-tooth sine (both
tried, both wrong — see Failed approaches).

- Select per generator via the Field control; `'none'` is the clean off-switch.
- Built-in fields (`curved`, `waves`, `seabed`, `zigzag`, …) take no amount knob.
- `'tunable'` is a custom-registered field (`brush.addField('tunable', fn,
  {angleMode:'degrees'})`) whose angle = `noise(...) * 180 * fieldAmount`,
  re-baked via `brush.refreshField(0)` when amount changes. **Distortion · amount
  applies to `'tunable'` only.**
- `strokeLen` multiplies tooth/stroke length so there's more path to bend — short
  stamps barely show it, longer strokes show it clearly.
- Field activation is wrapped in try/catch → `noField()`: an invalid field name
  fails *silently*. If a generator's default wiggle looks dead, verify the field
  name is actually registered in the installed p5.brush build before assuming a
  param bug.

### Brushstroke — two kinds of figure scale (they multiply)

Size in Brushstroke comes from two independent multipliers. Keep them separate;
do not try to unify them.

- **Intrinsic — the preset's `scaleMul`** (brush lab, added 2026-08-29). The
  figure's own natural size at its tuned proportions: "how big is a worm."
  Lives in `brushstroke.preset/1`.
- **Extrinsic — the armature's `scaleMul`** (composition/armature data). A
  per-placement multiplier over an already-tuned figure, so one preset serves as
  both a small counterweight and a large hero without re-tuning.

**Effective size = preset `scaleMul` × armature `scaleMul`.**

Implementation notes that keep the intrinsic scale honest:

- It is applied by scoping a multiplication over the size-bearing params
  (`width`, `spacing`, `weight`, `tuftradius`, `spineweight`, `contourWeight`,
  `linewidth`) for the whole draw pass, not by transforming the canvas.
- **Counts stay fixed for free.** Every count in the generator code is a *ratio*
  of those params (`TWO_PI*R0/spacing`, `arcLength/spacing`), so scaling
  numerator and denominator together leaves counts untouched. A new generator
  keeps this property as long as it derives counts as ratios and never from an
  absolute pixel constant.
- **Absolute pixel constants are the trap.** Anything in figure space that is
  written as a raw number (Sun's 2px ray standoff, the contour's 1.2px offset and
  its wobble amplitude) must be multiplied by `scaleMul` or the figure is not the
  same drawing at another size. Placement padding is *not* figure space and
  should not scale.
- **Verify by geometry, not by eye.** Patch the `stamp()` adapter to record every
  tooth's endpoints, render at 1× and 2×, and check that each point's offset from
  the mark centroid scales by exactly 2. Centroid-relative, so it isolates shape
  from placement, and it catches unscaled constants that look fine in a render.

**Grain does NOT stay fixed, and cannot in this draw path.** In brush lab the
grain is p5.brush's own stamp texture, whose size is a function of stroke weight
— there is no separate grain-cell knob (`uGrainCell` belongs to the M3 KM
compositor in `render/`, a different pipeline). So scaling stroke weight
necessarily scales the grain: a 2× figure has 2× coarser charcoal texture.
Holding grain constant would mean not scaling stroke weight, which makes a large
figure look thin-lined. **The two cannot both hold under p5.brush**; if
medium-constant grain becomes a requirement, it needs the owned pigment path,
where grain is a shader uniform independent of mark size.

### Brushstroke — colour order shifts the jitter RNG stream

In brush lab, `random` colour order draws a value per tooth (`pickColor` →
`random(pal.length)`); `sequential`, `runs` and `single` are pure index maths and
draw nothing. Tooth jitter (angle, length, radial offset) is pulled from the same
seeded stream, so **changing colour order at a fixed seed also changes every
subsequent tooth's jitter** — the marks move, not just their colours.

- Pre-existing behaviour, not a bug: the stream is shared by design and the seed
  still reproduces exactly, for a given colour order.
- **Matters during seed curation.** A seed chosen under one colour order is not
  the same composition under another. Lock the colour order *before* hunting
  seeds, and record it alongside the seed — a preset already stores both.
- Same trap applies to any future per-tooth option that conditionally consumes
  `random()`. If a knob must not disturb the composition, derive it from a
  separate stream (or from `noise()`, which doesn't touch the random stream)
  rather than from the shared one.

### Brushstroke — built-in vibration (override semantics)

Changing a built-in brush's vibration at runtime is non-obvious because
p5.brush gives you no setter for an already-registered brush.

- **`brush.set(name, hex, weight)` has no vibration channel.** It's the only
  call the draw path makes. So writing `BRUSH_REGISTRY[name].vibration` does
  nothing for built-ins on its own — the value is never read. (It *did* work for
  the `custom` brush only because `rebuildCustomBrush` re-registers it.)
- **`brush.add(name, {...})` overwrites in place.** Internally p5.brush stores
  brushes in a `Map` and `add` ends in `Map.set(name, …)`, so re-adding an
  existing name replaces its definition — no throw, no duplicate, no ignore.
  This is the *only* way to mutate a registered brush. Cost: it also resets that
  brush's cached colour buffers, so it rebuilds per slider tick (same price
  `rebuildCustomBrush` already pays).
- **`vibration:` is the input name; p5.brush aliases it to `scatter`** internally
  (`vibration && !scatter → scatter = vibration`). Pass `vibration:` to match
  `rebuildCustomBrush`; don't reach for `scatter:`.
- **`BUILTIN_DNA` decode caveats.** p5.brush exposes no API to read its own
  registry, so the built-in params are captured in a frozen `BUILTIN_DNA` table
  (decoded from `p5.brush.min.js@2.1.9-beta`'s init table) and
  `rebuildBuiltinBrush(name)` re-adds with `{...BUILTIN_DNA[name], vibration}`.
  Two things must survive the copy or the brush breaks:
  - `marker` ships **explicit `sharpness:null, grain:null`** — these are "skip
    those stages" signals, not omissions; dropping them changes the render.
  - `spray` and `marker` carry **`type:` strings** (`'spray'`/`'marker'`); without
    them they fall through to the default renderer and lose their geometry.
  If p5.brush is ever version-bumped, re-decode the table — the defaults may move.

### Brushstroke — Brush bands (which materials blend)

> **Superseded for M3 (2026-06-12).** The "dry brushes never blend — compose as
> layered marks" conclusion holds **only under naive compositing**. Under the owned
> Spectral.js KM shader (see *Brushstroke — Owned pigment pipeline (M3)*), dry media
> mixes subtractively and fringe-free like any other coverage, because blending no
> longer depends on the brush's own alpha. The band taxonomy below still accurately
> describes p5.brush's *native* behaviour (relevant to m2 presets and any
> native-blend path) — it is just not a constraint on the M3 pigment pipeline.

Closed at m2 (2026-06-11). For pigment purposes p5.brush materials sort into three
bands. This is a **material property** — don't try to tune a dry brush into
blending; check the band before reaching for the palette or opacity.

- **Wet / blending — `marker`, `spray`.** Overlaps mix subtractively (the m2 blend
  mechanism: blue + yellow → green). `spray` at low base weight + high vibration
  additionally throws a grainy atmospheric translucency close to the Enfantines
  texture passes — a candidate m3 atmosphere material.
- **Dry-grainy — `pastel`, `cpencil`, `HB`.** Opaque pigment but porous grain, so
  the background breathes through and crossings mingle *visually* without any
  colour math. Legitimate non-blending translucency.
- **Dry-solid — `crayon`, `charcoal`, `pen`.** Fully opaque; overlap = top mark
  wins. Compose with these as layered marks, never expect mixing.

Exemplars per band; the remaining graphite grades (`rotring`, `2B`, `2H`) are dry
and non-blending too. Only `marker` and `spray` blend.

**Vibration is the dry-brush expressiveness lever** (opacity is not exposed): the
best dry presets ride vibration ~0.65–1.55 to roughen strokes. The reference
plates' "see-through" dry media is light spray/stipple passes layered *over*
opaque strokes — an m3 composition technique, not a brush setting.

### Brushstroke — Gestural modifiers vs the other irregularities

Project Brushstroke has several "make it less rigid" knobs that look similar but
act on different stages. Keeping them straight prevents re-implementing one as
another (the trap that produced the rejected wiggle attempts).

- **Three distinct mechanisms, three stages:**
  - **Gestural Tremor** moves the *station position* along its normal (in
    `drawTeeth`, on the CPU, before the stroke is drawn).
  - **Bend Field** bends the *stroke itself* as p5.brush renders it (a vector
    flow field inside the library — see the Bend Field scaffold above). This is
    the real *Enfantines* wiggle; tremor is a coarser whole-mark wander.
  - **Angle jitter** *rotates* the tooth off its exact normal; it neither moves
    the position nor bends the stroke.
- **Never call the group "Hand".** The collective name is **Gestural modifiers**.
  `hand` is a Bend Field value (a p5.brush field name), so "Hand tremor" as a
  group label collides with the field vocabulary. UI labels abbreviate to
  "Hand · tremor/gate/chaos" but the concept is Gestural modifiers.
- **Tremor lift (`95f382b`).** Tremor originally lived in `makeStations`, which
  only builds Ribbon stations, so it was silently Ribbon-only. It now lives in
  shared `drawTeeth` and rides each station's own normal, making it correct on
  radial generators (Burst/Bloom/Fan/Tuft) too. Rule of thumb: per-tooth
  geometry that should apply to every generator goes in `drawTeeth`, never in a
  per-generator station builder.
- **Gate uses position-noise, not per-tooth random.** `handGate` thresholds a
  `noise(s.x, s.y)` field so skipped stations cluster into coherent bare
  stretches (a hand lifting off), rather than independent random dropout, which
  would read as salt-and-pepper speckle.

### Brushstroke — Owned pigment pipeline (M3)

Adopted 2026-06-12 (SPEC §1, §4). Generators write coverage into an owned **mask
buffer**; a vendored Spectral.js Kubelka-Munk fragment shader composites the mask
into the canvas, **opaque output** (no transparency in the pigment path → no
fringe). Proven end-to-end on real Tuft geometry in `tuft-shader-spike.html`.

- **Mask-channel convention — recipe scheme (B), adopted 2026-06-19** (mask A/B
  spike, side-by-side on real Tuft geometry). The mask RGBA channels are a paint
  *recipe*, not a literal colour — the KM shader BRANCHES on the codes:
  - `mask.R` = pigment id        → shader looks up colour in `uPal[id]` (id = `floor(R*7)`; 7-entry palette)
  - `mask.G` = grain amount       → shader applies PROCEDURAL dither/porosity
  - `mask.B` = knockout strength  → shader does a hard carved replace (no mix)
  - `mask.A` = amount             → coverage / KM concentration

  Grain + knockout are NOT baked — they are instructions the shader honours,
  live-tunable by uniform without re-stamping. Wash-under-hero comes from ordered
  KM passes (wash → hero). Chosen over scheme A (literal `rgb` + `alpha` coverage)
  because paint behaviours carried as uniforms/codes make audio modulation cheap —
  a uniform change + re-composite, not a CPU mask rebuild.
  - **Rewrite guardrails:** animate via uniforms where possible; rebuild only the
    mask layer that changed; cache static layers as textures.
  - **Per-frame budget for global modulation = full-screen KM × plate depth —
    measure at real retina res before committing dense reactivity.**
- **Grain = jittered discrete stamps with probabilistic skip**, not a noise texture
  over strokes. Each point stamps several small circles at Gaussian-jittered
  offsets, randomised radius, omitting some at random (`tuft-shader-spike.html`:
  `if(rnd(0,q)<0.4) continue`). Grain is the *distribution of discrete stamps*, not
  a post effect.
- **Knockout edges, not gradient falloff.** Carve mask edges with
  `erase()`/`noErase()` (2D: `globalCompositeOperation='destination-out'`);
  coverage is present-or-gone with a stippled porous boundary. The spikes' green/red
  edge speckle came from synthetic *gradient* edges feeding the KM mix a near-zero
  coverage ratio that oversaturates. Confirmed via the `[K]` knockout toggle in
  `tuft-shader-spike.html`.
- **Environment findings:**
  - Vendored Spectral GLSL needs **WebGL2 / GLSL ES 3.00** — will not compile under
    WebGL1.
  - Lifting GLSL out of `p5_blend.js`'s `glsl()` wrapper can leak a stray
    `` return ` `` line and drop the closing `#endif` — verify the extracted source
    mechanically.
  - Run **`glslangValidator`** (apt: `glslang-tools`) before browser testing.
  - **p5 2.x custom-shader APIs fail silently — use raw WebGL2** for the owned
    shader.

### Brushstroke — draw-on reveal / append-only render (M3)

- **Flicker root cause + fix.** p5.brush holds strokes in its private framebuffer
  and composites them onto the canvas at end-of-frame; a per-frame `background()`
  clear races that composite, so some frames show the cleared canvas a beat early →
  alternating-frame "low-res" blink. **Performance is NOT the cause** (8 strokes
  held ~7 ms / 59 fps). Three approaches ranked: **A** presentation tweaks
  (`preserveDrawingBuffer` / antialias / pixelDensity) — insufficient (naive still
  showed 6/6 distinct static frames under `preserveDrawingBuffer:true`, so the
  instability is the redraw, not the present path); **B** offscreen WEBGL buffer +
  single blit; **C append-only persistent layer — ADOPTED.** C: paint the Ground
  once, `preserveDrawingBuffer:true`, never clear, append only each stroke's
  newly-revealed tip span. Kills the flicker (settled pixels are physically never
  touched again — byte-stable), ~30–50× cheaper, and *is* the M3 reveal-animation
  engine (additive draw-on = progressive reveal of the authored final frame).
  Provenance: `drawon-spike.html` (2026-06-18).
  - `setAttributes()` must be called **once in `setup()`, after `createCanvas`**; a
    runtime call freezes the loop in instance mode — drive attribute changes by
    page reload, not a live call.
  - **Append needs PER-MARK deterministic seeding (V1 native, `accumulation-spike.html`
    2026-06-27).** Confirmed C holds for the V1 ship-piece's native **global-mode** +
    `pixelDensity` setup (prior spike was KM/instance). The catch: a mark drawn *one-at-a-
    time* during the reveal only reproduces its full-static-pass appearance if its RNG is
    reseeded per mark — `randomSeed(seed + i)` (and `noiseSeed`) before drawing mark `i`,
    **not** one `randomSeed(seed)` for the whole pass. With it, append rebuilds the static
    frame 1:1; without it, incremental order changes each mark. Measured: append idle
    ~60 fps / no flicker; re-stamp-all (`background()`+redraw 0..K each frame) ~10 fps at
    K=15 **and** flickers → rejected. Reveal loop = preserveDrawingBuffer, ground once,
    never clear, per-mark seed, draw only `[lastDrawn, revealCount)` each frame; audio
    energy drives how fast `revealCount` grows.
  - **Measuring append cost: `frameRate()`, not in-`draw()` `readPixels`.** p5.brush defers
    its composite to end-of-frame, so a `readPixels` inside `draw()` captures only CPU
    submission and under-reads the real per-frame cost — trust the frame rate.
  - **Owed → SETTLED 2026-06-23** by the dense/perf spike (`dense-perf-spike.html`).
    The pigment path there is the **owned** engine (p5 host → own canvas2D recipe-B
    mask → raw-WebGL2 KM, FBO plate-cache), not p5.brush, but the draw-on/append
    economics are the same and now measured at retina on an Apple-M2 GPU
    (**2880×1800**, real Chrome):
    - **rest = 0 KM passes = 0 ms.** The plate-cache never re-touches settled plates;
      resting frames are physically free. Append's "cost scales with dirty plates, not
      total accumulated" is confirmed, not assumed.
    - **one warm KM pass ≈ 3.5–4.4 ms** (sparse, the quiet-grounds regime) to
      **4.5–5.7 ms** (dense). Cost is **coverage-dependent** — the KM fragment shader
      early-outs on near-zero coverage, so denser stamping costs more per pass.
    - **reveal = exactly 1 pass regardless of plate count** → dense draw-on at retina
      is cheap. Present (`drawImage` WebGL→P2D) ~0.14 ms, negligible.
    - **Measuring WebGL frame cost: a trailing `gl.readPixels(1×1)` is mandatory** to
      force GPU execution into the timer — without it `performance.now()`/`drawImage`
      capture only CPU command submission and every cell falsely reads ~0.1 ms (this
      is *why* the earlier draw-on spike's 0.1 ms numbers were meaningless). Batch
      repeats per sample to beat Chrome's ~0.1 ms timer clamp; take the **median**.
  - **M4 reactivity budget (the modulation-scope rule).** Modulating palette/grain
    globally forces a recomposite. **Whole-stack (N passes) is NOT affordable at
    retina** — 6 plates ≈ 23.6 ms sparse / 41 ms dense, 12 plates ≈ 47.8 / 88 ms,
    blowing 60 fps by 6 plates and 30 fps by ~8. **Single-layer (1 pass) is flat
    ~4–6 ms** regardless of plate count. **→ M4 must scope per-frame modulation to one
    (dirty/top) layer**; the plate-cache's dirty-only recomposite *is* the reactivity
    architecture. Whole-stack survives only as an occasional one-off re-settle. To move
    several layers at once: drop to 30 fps + ≤6 plates, or round-robin one dirty plate
    per frame so per-frame cost stays at 1 pass.
- **Grain / weathering overlay — DIRECTION, not yet spiked.** A global
  paper-grain/weathering pass should be **fine-scale** (the first pass rendered too
  large) and **participate in knockout** (carve into the generator marks below
  where chosen), not sit as a flat large overlay. Distinct from the per-mark grain
  in the pigment pipeline above. **Flag as a future spike; do not treat as a settled
  mechanism.**
- **Install / load notes (from the draw-on spike).**
  - Correct dist path is **`dist/p5.brush.js`** (UMD). The npm package has **no
    `p5.brush.min.js`** — jsdelivr only 200s that path by auto-minifying on the
    fly, so it breaks against a real local install / stricter host. Fix any spike
    files still referencing `.min.js` (e.g. `composition-spike.html:47`).
  - Pin p5 to **`^2.2`** (resolves 2.3.x, has `registerAddon`; matches
    `p5.brush@2.1.9-beta`'s peer dep). Use **instance mode** (`new p5(sketch)` +
    `brush.instance(p)`) — global-mode auto-detection does not fire reliably when
    the file is served behind a bundler.

### Brushstroke — SVG spine import (M3)

Proven in `svg-spine-spike.html` (2026-06-20): a hand-drawn **Affinity** SVG `<path>`
becomes a registered Generator **Spine**, landing 1:1 over its ground plate. Spike
closed; importer cleared to graduate to an isolated feature. Recipe:

- **Affinity only.** Its export is clean: separate `<path>` objects, cubic-bezier
  `d`, named ids, proper `viewBox`. Pixelmator's SVG export is broken — don't use it.
  One path = one Spine; keep paths as separate objects.
- **Registration is 1:1 by construction.** The spine SVG `viewBox` is pixel-identical
  to its ground PNG (plate 1: 3437×2402; plate 2: 4595×3213). Normalize each path
  point by viewBox, then scale to canvas — `canvasX = (pathX/viewBoxW)*canvasW` —
  and the spine sits exactly over the ground. No alignment guessing. Confirmed by a
  debug polyline overlay tracing the painted spine.
- **Flatten, don't refit.** Use the browser's native
  **`SVGPathElement.getPointAtLength()`** to sample each path uniformly by arc length
  (build an off-DOM `<path>`, `getTotalLength()`, sample ~1 pt/viewBox-unit — for
  these plates ~6000 pts, far past 48–64/segment). Feed the polyline **straight into
  the existing `placeStations(poly, spacing)`** — no other change to station math. Do
  NOT reduce to control points and re-fit Catmull-Rom: that throws away the drawn
  precision. Only stamped marks render, so faceting can't leak as long as sampling
  beats station spacing. Normals are stable across smooth paths incl. self-crossings
  (stations are independent); a true cusp/corner anchor is still untested.
- **Generator-agnostic.** Stations/tangents/normals live in the shared `drawTeeth`
  renderer, so Tuft/Bloom/Fan ride imported spines for free. The **Bend response**
  param (SPEC §3.1) governs tight-bend behaviour; default `tame`.
- **Inline the path data; do NOT `fetch()` it under a bundler.** A Vite dev server's
  history-API fallback returns the app's `index.html` (HTTP **200**) for any
  unrecognized path, so `fetch('spine.svg')` silently gets HTML → DOMParser finds no
  `<path>` → blank spine, no error. Either inline the SVG as a constant (spike did
  this) or ship spines as bundled assets (`import`, not runtime fetch) / serve from a
  non-fallback static route (`python3 -m http.server` is immune — it 404s honestly).
- **NEVER `resizeCanvas` a p5.brush WEBGL canvas at runtime.** It reallocates the
  framebuffer out from under p5.brush's internal stroke buffers → they read
  misaligned GPU memory → block/checkerboard tearing that persists until page reload.
  NOT overdraw-related (heavy width/weight render clean absent a resize). Triggered in
  the spike by a plate switch that resized the canvas; fixed by sizing once at setup
  and never resizing (window-resize → reload to refit). **Implication:** the M3 final
  renderer must own its framebuffer (raw-WebGL2 KM, SPEC §4·3a), not lean on p5.brush
  — the real app resizes (fullscreen) and animates the reveal. Stage multiple ground
  plates at identical pixel size + aspect so no resize is ever needed.

### Brushstroke — composition staging renderer (M3 §4·3b)

The committed composition renderer lives at `project-brushstroke/render/` (ES modules,
served over HTTP — `npx vite project-brushstroke/render --port 8091`, or
`python3 -m http.server` from that dir). Built 2026-06-24 by graduating the proven
`dense-perf-spike.html` machinery into a feature; **judge it at retina in a real browser**
(the host forces `pixelDensity(1)` only inside Claude Preview).

- **Modules / seam.** `kmCompositor` (raw-WebGL2 KM plate-cache), `compositionHost`
  (p5/P2D host: stack + append-only reveal + control levers), `groundProducer`,
  `washGenerator`, `tuftGenerator`, `recipeMask` (`stampMark` dispatches by mark
  *kind*: `capsule`/`disc`/`dot`/`wash`), `palette`, `rng`, `spectral.glsl`. Adding a
  generator = emit flat recipe-coded marks `{kind,x,y,…,id,grain,ko,amount,key}`; the
  stamper + compositor are generator-agnostic. Entry `composition.html`.
- **Plate stack = ground + ordered mark plates.** `cacheTex[0]` is the **ground itself**
  (a real plate — uploaded image / cream+noise, blitted in, NOT a flat uniform), so it's
  swappable + tunable. Mark plates 1..N each KM-pass over `cacheTex[i-1]`. **Dirty-only
  recompose** from the lowest changed plate up (rest = 0 passes; reveal/edit = the dirty
  plates only). A control lever rebuilds only the plate(s) it touches.
- **Wash = coverage falloff, never alpha.** A `wash` mark is a radial gradient on the
  *coverage* (mask.A) with the recipe codes (R/G/B) held constant; muted ground-tuned
  pigment so the low-coverage tail fades to ground without the saturated-pigment KM
  speckle. This honours the §4·3b "dim = coverage, not alpha" rule.
- **In-mark grain is `mask.G` procedural dither, and must be pixel-cell + scale-locked.**
  The coarse white speckle *inside* marks is the G-channel porosity (holes punch
  `cov→0`, showing the ground), **not** `mask.B` knockout — confirm by setting grain
  amount 0 (marks go solid). The cell MUST be hashed in **pixel space**
  (`floor(gl_FragCoord.xy / uGrainCell)`), with `uGrainCell = grainSize · elementScale`,
  so the grain shrinks with the mark. Hashing in 0–1 texture space (`vTex·uScale`) gives
  a fixed screen-space cell that reads blocky and ignores mark size — the bug fixed here.
  Areal porosity is held across scales because the hole fraction (`uSkip`) is
  scale-independent; only the cell *size* tracks the element.
- **The accent / spray-stipple top pass is NOT part of this.** It was built then removed
  (not in SPEC, unrequested). The reference plates' see-through dry-media texture is the
  separate, still-deferred global grain/weathering overlay (below) — distinct from both
  in-mark grain and any per-element stipple.
- **Layering verdict (2026-06-25, by-eye at retina): stacking plates reads as translucency.**
  A wash plate + multiple Tuft fields (each own scale/seed/palette-offset) through the cached
  KM compositor give the breathed-on, see-through quality — **compositional translucency,
  never per-mark alpha.** Technique-level and seed-independent. It **muddies when dense**; open
  space carries the read, so favour it (companion to 30–40 bpm ambient). Grain size ≤ 1.5
  standing; grain amount stays open (drives the faded look). The per-plate generator opts that
  stage a stack (`tuftGenerator` scaleMul/idOffset/count/seed/dx-dy, `washGenerator` seed/dx-dy)
  are kept as groundwork for the deferred `brushstroke.composition` save model; the throwaway
  multi-plate stub itself was retired (commit `0d82eaf`).

---

## Recording & export

- **Safari `captureStream` + `MediaRecorder` stalls mid-recording** (confirmed 2026-07-07,
  Project Brushstroke V1): the **video** freezes at a variable point (~10–25s) while audio and
  the render loop continue. Seed/track/art-load independent — it's the browser, not the code (a
  diagnostics overlay showed Chrome's frame pump running unbroken, 13,175 frames, one clean
  `dataavailable`, no errors; Safari froze). **Record in-browser (SPEC route 1) in Chrome.**
  Safari is fine for viewing/curation/fullscreen, just not capture. No browser guard in code —
  deploys to Netlify, not gating on browser.
- OBS for screen recording; route audio through BlackHole + QuickTime if OBS audio gets weird.
- For high-quality frame captures: render at 2x resolution, downsample in post.
- FILM on Replicate for smooth interpolation between keyframe exports.

---

## Tool selection (quick reference)

| Need                                  | Tool                          |
| ------------------------------------- | ----------------------------- |
| 3D generative, audio-reactive         | Three.js                      |
| 2D generative, quick sketches         | p5.js                         |
| Shader-only, live performance         | ISF in VDMX                   |
| Geometry exploration, baking          | Blender 5.0                   |
| Frame interpolation                   | FILM (Replicate)              |
| Companion UI / control panels         | React + Vite                  |

---

## Scoped out

### Failed approaches (don't re-investigate)

- **BlenderMCP specifically** — API incompatibilities with Blender 5.0 for audio-reactive work. Note: this is a bridge failing, not Blender failing. The `bpy` scripting path is open (see Under Evaluation).
- **p5.blender with p5 2.x / p5.brush 2.x** — does not initialize. Removed `registerMethod` extension API + pervasive p5 1.x private-renderer field access (rewritten in p5 2.x); not shimmable. Note: this is the library failing against modern p5, not the subtractive-mixing idea failing. Sanctioned path for m2 is p5.brush's own native subtractive blend (it mixes overlapping colours as pigment automatically in 2.1.9-beta — confirmed in `pigment-m2.html`). An owned Spectral.js blend stage was explored and parked; revisit only if audio-driven blend control (m4) demands it.
- **ISF audio-reactive hosting in Apple Motion** — Motion has no native audio reactivity for ISF shaders. Use VDMX as the ISF host. (Motion itself remains useful for other purposes — see "Capable but out of scope.")
- **Curly quotation marks in canvas text rendering** — unresolved. Workaround: pre-render as SVG or use straight quotes.
- **CPU-side particle updates above ~10k** — always use GPU/shaders.
- **Position jitter / per-tooth sine waves for stroke wiggle** — neither produces
  gestural Enfantines character. The correct mechanism is p5.brush's native
  vector flow field bending strokes during draw (the Bend Field). See p5.js
  scaffolds.

### Capable but out of scope

Tools that are genuinely capable in their own domain but intentionally not part of this project's generative core. Noted here so future sessions don't re-investigate them from scratch. Can be promoted to Under Evaluation if a specific piece calls for them.

- **Apple Motion** — post-production and finishing tool. Legitimately useful for: 2.5D compositing of rendered layers, Behaviors-driven typographic animation, particle effects as atmospheric post layer, color grading, clean export pipeline to FCP/ProRes. Not useful for: audio reactivity, generative systems, shader hosting. Revisit specifically if a piece calls for 2.5D parallax compositing, Behaviors-driven motion on typography or logos, or post-layer atmospheric effects over code-rendered footage.
- **Spline** — product-design lineage (see DESIGN.md Commitment #6). Legitimate for Metaculture materials, companion UI, control-panel interfaces, portfolio framing. Not for the art itself.
- **Anthropic `algorithmic-art` skill + `viewer.html` template** — generates a
  philosophy doc, then a branded p5 viewer (Poppins/Lora, cream gradient,
  blurred white sidebar, brand colours; p5 1.7.0). Product-design lineage plus a
  static "Art Blocks print" ethos (perfect still frame, craft-signalling prose)
  — both scoped out here (DESIGN.md #1, #2, #6 and "what this is not doing").
  The one portable piece, the seed-exploration UX, was lifted into
  `templates/seed-harness.html` in our own dark chrome on p5 2.x. Don't adopt
  the viewer or re-run the manifesto step — DESIGN.md *is* the vision statement.

---

## Under evaluation

Tools and approaches being researched or planned but not yet shipped against. Items graduate into the main body of this doc once a piece actually ships using them.

### Blender — `bpy` scripting path

Primary AI-to-Blender integration for this project. Write Python scripts using Blender's `bpy` API, run via text editor or `blender --background --python script.py`. Batch-oriented, not conversational — iterate by running scripts, not by live manipulation. Reliable because it doesn't depend on any bridge staying in sync with Blender releases.

### Geometry Nodes (Blender 5.0)

Procedural geometry as a first-class interest. Node graphs don't serialize cleanly to text, so AI assistance works best through `bpy` scripts that build node trees programmatically. Workable but rough. Target workflow: procedural geometry in Blender → glTF export → animation/audio-reactivity in Three.js.

### Physics simulation (Blender)

Use case: simulations the browser can't handle at scale (soft bodies, cloth, fluids, rigid body counts above WebGL's comfort zone). Pipeline stage, not a live environment. Bake simulations in Blender, export as Alembic or MDD, replay in Three.js or render directly in Blender.

### VDMX (planned purchase)

Target host for live/VJ work once ISF pieces are ready. Native audio reactivity, real-time ISF shader hosting, industry-standard for live visual performance. Will pair with existing BlackHole audio routing.

### TouchDesigner

Highest-ceiling live performance tool in this space. Steep first week, smoother after. AI assistance shape: Python scripting in DATs/extensions, GLSL in GLSL TOP, architectural guidance on operator networks, translation of Three.js/p5.js concepts into TD paradigm. Cannot do: visual node-graph assembly, live interface clicking, guaranteed-current operator reference. Workflow is *describe → AI drafts code/topology → you assemble*. If only picking one live tool, TD first.

### vvvv gamma

Same patch-programming sensibility as TD. VL (Visual Language) has less training data behind it than TD's Python, so AI assistance is thinner — useful for C# extensions and shaders, less so for pure patching. Smaller community. Recommend deferring until TD is either adopted or ruled out.

### Cables

Browser-based node editor, patch-programming sensibility. Good fit for quick web-deliverable pieces where the patch-programming aesthetic is wanted but installing TD/vvvv is overkill. Ships directly as a web page — useful for Metaculture embeds or portfolio work.

---

## Repo hygiene (learned the hard way)

### No git worktrees for this project

Claude Code can spawn subagents with `isolation: "worktree"`, which creates a temp worktree at `.claude/worktrees/<random-name>/` on a `claude/<random-name>` branch. Over time these accumulated as stale checkouts of *old* commits — and because a session shelled into one is looking at an old snapshot, it draws wrong conclusions about what exists, and uncommitted work gets stranded where the main repo can't see it. This caused real confusion and nearly lost work.

**Rule, now enforced three ways:** no worktrees, no `claude/*` branches; work directly in the main repo on the named branch.
- `CLAUDE.md` (repo root) — instruction, top of file, loaded every session.
- `MEMORY.md` (project memory) — same rule near the top.
- `.claude/settings.json` PreToolUse hook + `.claude/hooks/block-git-worktree-add.sh` — hard-blocks `git worktree add` at the tool layer. Tested: blocks `add`, allows `list`/`remove`/`prune`.

Session-start habit as backstop: confirm `pwd` is the main repo (not a worktree path) and `git branch --show-current` is the intended branch before any work.

### Separate projects get separate repos

Distinct projects do **not** live as branches/dirs inside another project's repo. When work that wasn't really Brushstroke ended up tangled in the GenArt2025 tree, the fix was extraction into standalone repos:
- `butterchurn-3d` → `~/Documents/butterchurn-3d/` (own repo)
- `curl-noise` → `~/Documents/curl-noise/` (own repo)
- Google AI Studio "Brushstroke" (GAIS) → moved entirely out of the repo; shares the name, different lineage, never merge without a deliberate decision.

### Git is the backup — no hand-maintained copy folders

A hand-maintained `Brushstroke-Master/` "backup" folder drifted from the tracked files (its SPEC.md lost the §1.5 four-tier section while the committed copy kept it). The committed file in git is always the canonical backup; a parallel folder just creates a second copy that can rot. Don't keep manual backup folders — recover any prior state from a commit (`git show <hash>:path`) or a tag.

### Verify before destroy

The discipline that prevented loss during cleanup: read/inventory before removing, and *run* an extracted project (`npm install && npm run dev`) before deleting its source. "Files appear present" and "it actually runs" are different facts — confirm the second before anything destructive.
