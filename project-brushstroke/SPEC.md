# Project Brushstroke — SPEC

*A shared vocabulary and architecture reference. Lives at
`project-brushstroke/SPEC.md`. Reference it at the start of every Claude Code
/ agent session so we all use the same words for the same things.*

Part of GenArt2025. Target context: audio-reactive generative performance set
to slow ambient tracks (~30–40 BPM). Aesthetic lineage: Alejandro Campos Uribe's
*Enfantines*, built on **p5.brush** — form via stamped marks, pigment via its native subtractive blend.

---

## Status & open loops  (read at every session start)

- Branch: `project-brushstroke` · Frontier: **M3 (Composition)**
- Docs current through: **2026-06-24** — **§4·3b composition staging BUILT** (committed;
  Mark's by-eye verdict: pleased). Multi-plate plate-cache compositor + composition host
  graduated from the spike into `project-brushstroke/render/`; plate stack **Ground → Wash
  → Tuft hero**; full live control surface; in-mark grain (mask.G) made **finer + scale-
  locked** to the element; the accent stipple layer was removed (not in SPEC, unrequested).
  Commits `2dc1bbc` → `0038a3a`. See §4·3b.
  Prior 06-23: dense/perf spike CLOSED (all three verdicts); retina perf measured on
  Apple-M2 GPU, M4 modulation bound to **single-layer**.
  Prior 06-20: SVG spine-import spike closed: importer proven 1:1 (§4·3d, PATTERNS
  *SVG spine import*); Bend response param added (§3.1, default `tame`); p5.brush
  runtime-resize corruption logged. 06-19: mask A/B spike closed (recipe scheme B);
  dry-brush KM (§4·3a); composition-spike verdict (§4·3b).
- **Mask-channel convention: recipe scheme (B) adopted 2026-06-19, folded into
  PATTERNS. Tuft rewrite unblocked.**
- **Dense/perf spike CLOSED 2026-06-23** (`dense-perf-spike.html`, throwaway record in
  `dense-perf-spike-VERDICT.md`). Architecture confirmed faithful: p5 host → own
  canvas2D recipe-B mask → raw-WebGL2 KM via FBO plate-cache. Verdicts:
  1. **LOOK ✅** — bezier-eased reveal reads correctly at `?d=2` retina, no artifacts.
  2. **PERF** (2880×1800, M2): rest = **0 KM passes / 0 ms** (cache delivers free
     resting frames); one warm KM pass ≈ **3.5–4.4 ms** sparse / **4.5–5.7 ms** dense
     (coverage-dependent); reveal = 1 pass regardless of plate count; present ~0.14 ms.
  3. **MODULATION SCOPE** — whole-stack (N passes) blows budget at retina (6pl 23.6 ms
     sparse / 41 dense; 12pl 47.8 / 88); single-layer (1 pass) flat ~4–6 ms. **→ M4
     must scope per-frame modulation to a SINGLE (dirty/top) layer.** The plate-cache's
     dirty-only recomposite *is* the M4 reactivity architecture; whole-stack survives
     only as an occasional one-off re-settle. Budget: one layer, per-frame, 60fps.
  **Unblocks: multi-plate composition + wash; M4 reactivity bound (single-layer).**
- **Decisions pending doc-commit** (clear each when its amendment lands):
  - 2026-06-18 grain / weathering overlay: fine-scale + knockout — **DIRECTION**,
    needs a spike (see PATTERNS → *Brushstroke — draw-on / append-only render*).
- Seeds retained: `tuft-shader-spike.html`, `drawon-spike.html`,
  `svg-spine-spike.html` (importer reference for the upcoming feature; spine inlined
  so it runs standalone — ground PNGs removed, re-copy from
  `~/Downloads/background plates/` if the ground is wanted).

---

## 0. The one idea everything hangs on

> **A ribbon is not a brush. It is a *Generator*.**

A **Brush** makes *one* textured mark in *one* colour (this is p5.brush's whole
job). A **Generator** orchestrates *many* brush marks into a composite form. The
multicolour comb look is **many single-colour stamps placed along a path** — it
is never one brush emitting many colours. Most failed attempts come from asking
a Brush to do a Generator's job.

Three layers, kept deliberately separate so we never debug all three at once:

| Layer | Question it answers | Owned by | Status |
|---|---|---|---|
| **Form** | Where do marks go and which way do they point? | Generators (our code) | m1 — *complete* |
| **Pigment** | What happens where marks overlap in colour? | p5.brush (native subtractive blend) | milestone 2 |
| **Performance** | How does sound move parameters over time? | audio analyser → Composition | milestone 4 |

Build and tune each in isolation, then port. Never wire two unfinished layers
together. (For the *object* model — Brush / Generator / Preset / Composition —
see §1.5; the three layers above are about *what we build when*, the four tiers
are about *how the app is structured*.)

---

## 1. Core taxonomy (the nouns)

Read top-to-bottom; each term builds on the one above.

- **Ground** — the background field: a flat colour, a Wash, or Field Marks.
- **Generator** — a system that places many Brush marks into one composite form.
  (The Ribbon is one type; see §3 for the family.)
- **Spine** — the guiding path of a Generator. A spline. Optionally rendered as
  a **Drawn Spine**: a solid stroke along the path with its own weight control
  (default ~5–8pt black), independent of the active Brush. See §1.5 decision 3.
- **Control Point** — one of the handful of anchors the Spine curves through.
  Few points = lazy open curve; many = busier, more folded path.
- **Station** — a point placed at a fixed interval (Spacing) *along* the Spine.
  One mark is stamped per Station. Stations are measured by **arc length**, so
  they stay evenly spaced even where the Spine curves hard.
- **Tangent** — the Spine's direction at a Station (which way the path is going).
- **Normal** — perpendicular to the Tangent. Teeth are drawn *along the Normal*.
- **Tooth** *(a.k.a. Stamp)* — the single textured Brush mark drawn at a Station.
  In a Ribbon it's a short bar laid across the Normal.
- **Comb** — the *emergent* look of many Teeth packed along a Spine. You never
  draw a "comb"; it appears when Spacing is small enough.
- **Width Envelope** — how Tooth length changes along the Spine (e.g. tapering
  to points at both ends). Turns a flat strip into something that swells and
  thins like a real loaded brushstroke.

### Brush-layer nouns (p5.brush's domain)
- **Brush** — the texture/material of a mark: `marker`, `charcoal`, `pen`, etc.
  One colour per stroke. Swappable without touching Generator logic.
- **Brush Weight** — thickness of a single Tooth.
- **Palette** — the ordered set of pigment colours a Generator draws from.

### Pigment-layer nouns (milestone 2)
- **Pigment Blend** — realistic subtractive mixing where Teeth overlap
  (blue + yellow → green). **m2:** produced by p5.brush's native subtractive
  blend (wet band only — marker/spray; p5.brush 2.1.9-beta). **m3 (adopted
  2026-06-12):** produced by an owned Spectral.js Kubelka-Munk shader reading a
  mask buffer — see the resolution below. *Not* RGB alpha layering.
- **Mask Buffer (parked)** — was the off-screen per-colour layer an owned blend
  stage would read from. Not needed for m2 (p5.brush blends natively). Retained
  as a term only for the parked owned-shader path.
  > **Resolved (2026-06-02):** p5.blender was ruled out (incompatible with our
  > p5 2.x + p5.brush 2.x stack — init API removed + reaches into p5 1.x private
  > renderer internals; spike `pigment-spike.html`). An owned Spectral.js blend
  > stage was then explored — `pigment-spike-2.html` proved CPU subtractive
  > mixing, and `pigment-m2.html` attempted the realtime fragment-shader port —
  > but it is **parked (2026-06-02)**: p5.brush 2.1.9-beta blends subtractively
  > on its own, which is sufficient for m2 and for many-generator Composition,
  > whereas the owned per-colour capture scales badly against p5.brush's
  > deferred compositor. The owned shader may revisit only if m4 (audio-driven
  > blend) needs blend-ratio control or shader-level performance, and would be
  > proven on synthetic layers, never on captured brush output. Spectral.js
  > build caveat for whoever revisits: the vendored `spectral.min.js` is a newer
  > generation than spike 2 assumed (variadic `[Color, weight]` API, no
  > `RGBA255`; blue + yellow ≈ `[61,148,62]`, not spike 2's `[4,110,90]`).
  >
  > **Reopened & adopted for M3 (2026-06-12).** A standalone raw-WebGL2 spike
  > (`pigment-shader-spike2.html`) proved the vendored Spectral.js KM GLSL
  > composites overlapping coverage into believable subtractive pigment,
  > fringe-free, writing opaque output (`fragColor = vec4(col,1.0)`) — the
  > mechanism the *Enfantines* look requires. p5.brush native blend is sufficient
  > only for the **wet band** (marker/spray); it cannot produce fringe-free **dry
  > media**. The 06-02 park was a capture-timing failure (`loadPixels`), not a
  > shader flaw; its named revival condition ("prove on synthetic layers") is met.
  >
  > **Mechanism (M3):** generators write coverage/instructions into an **owned
  > mask buffer**; a **Spectral.js KM fragment shader** reads the mask and mixes
  > the incoming pigment *into* the existing canvas, **every pixel opaque (alpha
  > 1.0)** — no transparency anywhere in the pigment path, so no fringe regardless
  > of coverage. **Draw order = mix order; no per-colour layers** (this retires the
  > deferred-compositor scaling worry that justified the park). Library is **MIT
  > Spectral.js, not Mixbox**; the Spectral-MIT trigger §1 reserved for m4 is
  > pulled forward to M3. Proven end-to-end on real Tuft geometry in
  > `tuft-shader-spike.html`.

---

## 1.5 The object model — the four tiers (READ THIS)

The single most important structure in the app. Every screen, save file, and
audio mapping inherits from it. The word **"style"** is retired — it was
overloaded across two of these tiers and caused the spray-on-the-ribbon bug.

| Tier | Name | What it is | Lives where |
|---|---|---|---|
| 1 | **Brush** | Material of *one* mark: pen, rotring, marker, spray | inside a Generator |
| 2 | **Generator** | A system placing many Brush marks into one composite form (Ribbon, Burst, Bloom, Fan, Field Marks) | the engine |
| 3 | **Preset** | A tuned, *named, saved* instance of one Generator (params + palette + allowed Brush) | Brush Editor produces these |
| 4 | **Composition** | Multiple Presets staged together with audio mappings + behaviours — the finished audio-driven piece | Performance page builds these |

**The golden rule that fixes the bug:**
> A **Generator declares which Brushes it is allowed to use.** Brush choice is a
> *property of the Generator*, never a global menu applied to everything.

So the Ribbon Generator declares `allowedBrushes: [pen, marker]` — and spray is
simply never offered for it. Other Generators declare their own (a Burst might
allow spray; Field Marks might use rotring). This is why "apply spray as a style
to the multicolour ribbon" was nonsense: it tried to override a Generator's
material constraint from outside.

**The handoff that connects the two pages:**
> The **Preset is the handoff object.** Brush Editor *produces* Presets;
> the Composition page *consumes* them.

This is the tier that was missing in v1, which is why the editor and performance
felt disconnected. You tune a Generator → name and save it as a Preset → the
Composition page stages Presets together. Editor → Preset → Composition.

### Decisions locked this session
1. **Brush constraints are per-Generator** (the golden rule above). The Ribbon
   allows pen + marker only.

   *Addendum:* A Generator's `allowedBrushes` narrows that Generator's view of
   the material set; it never removes a Brush from the system. The full set of
   Brushes discovered from p5.brush always exists in the build and remains
   reachable. A Generator may declare `allowedBrushes` as an array (a
   whitelist) or omit it / set it to `null` (no constraint — full discovered
   set). Ribbon declares `['pen','marker']` per decision 1; Burst is
   unconstrained. Rationale: Brush is tier 1 (material), Generator is tier 2
   (form) — a tier-2 object may constrain its own material choices but must
   not delete a tier-1 material from the system.
2. **Stroke-weight variability applies to all Brushes, one shared control,
   range 0–15.** It is a general feature, not per-Brush. The range runs up to 15
   specifically so pen and rotring read well (they didn't show variability at
   ~10); every Brush sharing that same range is fine and simplest. *Spray:* left
   in for now under the same control — exclude it later only if it looks bad by
   eye. Don't pre-emptively special-case anything.
3. **The Spine is a solid Drawn line with its own weight, independent of the
   active Brush. No dotted/dashed option.**
   - Default: solid ~5–8pt black, with a thickness control.
   - Dropping dotted keeps this trivial to build — it's just "a stroke along the
     path with a weight slider."
   - *Possible extension (parked):* let the Drawn Spine use any Brush. Not now.
   - (v1 bug being fixed: spine inherited the active Brush, so it only showed
     under spray. It must NOT inherit the active Brush.)
4. **The portable JSON file is the source of truth for presets; localStorage is
   only a convenience cache.** A `brushstroke.preset/1` JSON file is portable,
   version-controllable, lives in the repo (`presets/`), and travels between
   machines — it is what the Composition element will consume, so it must always
   be the canonical form. The Brush Editor therefore keeps Export-to-JSON and
   Load-from-file as first-class. **In-app library (amended 2026-06-01):** the
   editor offers an in-app preset *library* with two backends, chosen at runtime:
   - **Folder mode (preferred, dev server):** the root `vite.config.mjs` exposes
     a `/__presets` endpoint (`GET` list, `PUT <name>` write, `DELETE <name>`)
     scoped to `presets/`. The lab probes it on load; when present, Save/Delete
     read and write the JSON files **directly on disk**, so saved presets persist
     across sessions, are version-controllable, and are Composition-readable with
     no manual step. Every write/delete regenerates `presets/index.json`. The
     endpoint validates the `brushstroke.preset/1` schema and refuses any name
     outside `[A-Za-z0-9_-]` / any path traversal. Writes land uncommitted in the
     working tree — the user commits when ready.
   - **Fallback (static host / `file://`):** no endpoint, so the lab reads bundled
     presets from `presets/index.json` and persists a user "saved set" in
     `localStorage` (same schema). localStorage is explicitly a cache, NOT a
     substitute for the file — anything worth keeping must be Exported to JSON to
     become portable. Never make localStorage the only home for a preset.
5. **Brush material is differentiated by a per-Brush `baseWeight` multiplier.**
   Each Brush in the `BRUSH_REGISTRY` carries `baseWeight` and `vibration`
   values; a Tooth's final weight is `userWeight × brush.baseWeight`. So at the
   same user weight setting a marker reads chunkier than a pen, a rotring finer.
   This is the concrete mechanism behind the Tier-1 "Brush = material" idea:
   material differences are real numeric properties, not just texture names.
   Current registry: pen (1.0 / 0.1), marker (2.5 / 0.2), rotring (0.8 / 0.05),
   charcoal (4.0 / 0.8), spray (8.0 / 1.0), custom (5.0 / 0.5),
   default (2.0 / 0.3) — values are (baseWeight / vibration).

   *Vibration is live for built-ins (2026-06-07, commit `9dfe5b8`).* Previously
   `vibration` only did anything on the `custom` brush: `useBrush` calls
   `brush.set(name, hex, weight)`, and `brush.set` has **no vibration channel**,
   so for pen/marker/rotring/charcoal/spray the slider wrote
   `BRUSH_REGISTRY[name].vibration` but nothing consumed it. p5.brush exposes no
   API to mutate a registered brush in place, so the fix mirrors the `custom`
   path: a frozen **`BUILTIN_DNA`** table holds each built-in's full library DNA
   (weight/sharpness/grain/opacity/spacing/pressure/type), and
   **`rebuildBuiltinBrush(name)`** re-adds the brush via `brush.add` with only
   `vibration` swapped in from `BRUSH_REGISTRY` — `brush.add` overwrites
   p5.brush's internal entry in place. Wired into the Vibration slider handler
   and `loadPreset` (custom → `rebuildCustomBrush`, built-in →
   `rebuildBuiltinBrush`). Mechanism detail + the decode caveats (explicit
   `sharpness:null`/`grain:null`, the `type:` strings, `vibration:`→`scatter:`
   aliasing) are in `PATTERNS.md` → *Brushstroke — built-in vibration*.

   *Deferred (accepted, not shipped) — startup reconciliation ("Edit 5").* On
   first load before any slider touch, a built-in still renders at p5.brush's
   **library** default vibration, not `BRUSH_REGISTRY`'s value (e.g. charcoal
   library 1.5 vs registry 0.8; spray 6 vs 1.0), so the slider position can
   disagree with the render until first touched. A startup loop calling
   `rebuildBuiltinBrush` for every built-in would reconcile this, but it's held
   pending a by-eye review of the resulting render shift (it materially changes
   the out-of-box charcoal/spray look). Trade-off to remember when revisiting:
   the modifiers are **regenerate-reverts / preset-persists** — a fresh seed
   re-runs from `DEFAULTS`, but a saved preset carries the tuned values through
   the `loadPreset` round-trip.
6. **The Bloom Generator is implemented (SPEC §3's planned Bloom).**
   Stations on a circle, radius modulated by 2D Perlin noise → organic
   petal-lobe shapes rather than a perfect radial Burst. A `swirl` parameter
   (−180°…+180°) rotates each Tooth's normal so the bloom reads windswept rather
   than purely radial. Tooth length tapers center→petal-tip via the noise→u
   mapping. Declared with `allowedBrushes: null` (unconstrained) for now.
7. **A `custom` Brush with explicit DNA is part of the brush set.**
   Registered via `brush.add('custom', {…})` with a defined pressure curve
   (~[0.2, 0.8]), vibration, opacity, spacing, and a tip function (small black
   circle). Editable live: the Material sliders (Base Weight, Vibration) rebuild
   the custom brush on change. It appears in the Brush dropdown alongside the
   built-ins.

*Note (UI bug fix worth recording so it isn't "fixed" again):*
`populateGenSelect()` preserves the current dropdown selection on re-render
rather than resetting to the default generator. Not an architectural decision,
but a behaviour the code now relies on.

---

## 2. The translation table (artist intent → exact knob)

This is the heart of the spec. When a frame feels wrong, find the *feeling* on
the left and reach for the knob on the right — instead of describing the vibe.

| When you want it to feel… | Turn this | Direction |
|---|---|---|
| Tighter, more **combed** / solid | Spacing | down |
| Looser, **gappy**, sketchier | Spacing | up |
| **Wider** / bolder ribbon | Ribbon Width | up |
| More **chaotic**, fraying | Angle Jitter | up |
| More **disciplined**, ruler-straight | Angle Jitter | down |
| **Ragged**, uneven edge | Length Jitter | up |
| Clean, flat-cut edge | Length Jitter | down |
| Marks **swell and taper** like real strokes | Width Taper | up |
| A flat strip / ribbon of even width | Width Taper | down (→0) |
| **Folded, busy** path | Control Points | up |
| **Lazy, sweeping** open curve | Control Points | down (3–4) |
| **Confetti** colour, lively | Colour Order = Random | — |
| Orderly **rainbow march** | Colour Order = Sequential | — |
| **Streaky**, blocks of one colour | Colour Order = Runs | — |
| Different **material** (waxy / inky / dry) | Brush | swap type |
| Finer / heavier line | Brush Weight | down / up |

> Tip: "chaotic" almost always means one of three different knobs (Angle Jitter,
> Spacing, or Colour Order = Random). Naming *which* is most of the battle.

---

## 3. The Generator family (observed in Enfantines)

Names so we can ask for the *other* forms precisely, not just the Ribbon.
The Ribbon is built first; the rest are variations on "Stations along a path."

- **Ribbon** — Comb of Teeth along an *open* Spine. (Built in v0.)
- **Burst** — Teeth radiating from a single centre point, like a sea-urchin or
  starburst. (Spine collapses to a point; Stations spread by angle, not arc.)
- **Bloom / Cluster** — several small Ribbons or Bursts grouped into a flower-like
  blob, then tiled across the canvas.
- **Fan / Coral** — Teeth fanning along a short arc with fingers spreading at the
  tips; the orange corals and purple sea-fans in the references.
- **Field Marks / Stitches** — tiny dashes covering the Ground, all aligned to a
  shared **Flow Field** (the faint diagonal hatch behind everything).
- **Tuft** — a *singleton* scatter (like Field Marks): one draw call places MANY
  small radial clusters across the canvas, sized + jittered + placed with plain
  `random()` so they deliberately **overlap**. The dominant Enfantines motif
  (piles of small combed bursts), and the overlap substrate the Pigment layer
  (m2) will blend. Params: `tuftcount`, `tuftradius`, `tuftspread` (0–1 fraction
  of full circle, <1 = partial fan-like arc), `tuftjitter` (per-tuft radius
  variety). Combs fully outward via `biasDefault: 1.0`; inherits Tooth bias +
  Radial offset from the shared renderer.
- **Linework** — sparse, thin, faint, slow-wandering **contour lines** scattered
  across the canvas: the quiet structural "ground" under the colour in the plates
  (the drifting contour scribbles, NOT the registration `+` marks). The ONLY
  generator that draws its spine path **directly** (one continuous brush stroke
  via the active thin brush + palette colour + alpha) rather than teeth — it does
  NOT route through `drawTeeth`, so Tooth bias / Radial offset are inert here.
  Singleton, like Field Marks. Params: `linecount`, `linesegments`, `linewander`,
  `linewidth`, `linealpha`. NB: "ground UNDER the colour" is a future
  **Composition** concern (staging generators together); Linework is built here as
  a standalone, tunable generator only — no compositing under other forms yet.
- **Wash** — soft translucent colour fields underneath (p5.brush fill / `mass`).
- **Registration Marks** — *eliminated (standing decision 2026-06-18).* The small
  `+` crosses and dotted frame border are not used anywhere — not as a generator,
  not as a default, not as an option. This **overrides** the composition-spike
  "available but off by default" note. Kept here only so the decision is not
  re-litigated.

A finished Composition usually = Ground + Wash + one or two hero Generators
(Ribbon / Bloom) + scattered Field Marks on top. (No Registration Marks — see above.)

### 3.1 Shared tooth-geometry parameters (Form layer)

Applied in the shared `drawTeeth` station-renderer, so **every** Generator
inherits them and they're brush-agnostic. All ride the standard
`buildPresetObject`/`loadPreset` round-trip (saved in `params`; older presets
without them load at their default).

> **Where they live (2026-06-07):** Tooth bias, Radial offset, the Gestural
> modifiers (Tremor / Gate / Chaos), and `strokeLen` are **all** applied in the
> shared `drawTeeth` renderer — *not* in per-generator `makeStations`. Tremor
> used to live in `makeStations` (so it only moved Ribbon stations); it was
> lifted into `drawTeeth` (commit `95f382b`) where it rides each station's own
> **normal**, making it geometry-correct on radial forms (Burst/Bloom/Fan/Tuft)
> as well as the Ribbon. **Do not push any of these back down into
> `makeStations`** — that re-breaks them for every non-Ribbon generator and
> splits one shared behaviour across two places. New per-tooth geometry knobs
> belong in `drawTeeth`.

- **Tooth bias** (`bias`, −1…1, default 0) — shifts each tooth's span along its
  normal by `bias * halfLen`, preserving total length. `0` = symmetric (straddles
  the spine); `±1` = entirely on one flank. On radial forms +normal = outward, so
  this reads as inside↔outside; on the Ribbon it reads as which flank of the path.
  Per-generator **`biasDefault`** (applied on generator *switch*, never overriding
  a loaded preset): Burst/Bloom/Fan = **1.0** (fully outward, hollow-center spray
  like the Enfantines plates); Ribbon/Field Marks = 0.
- **Radial offset** (`radialoffset`, 0…1, default 0) — a *separate* axis from
  bias. Adds a per-tooth **random** outward push (`random(0, radialoffset)*halfLen`)
  along the same normal, on top of the bias shift. Varies each tooth's START
  distance from the hub → loose organic spray rather than a uniform sunburst.
  Length is unchanged (still `2*halfLen`); only the start moves. `0` = teeth start
  at the spine (unchanged). Shown for all generators (harmless on Ribbon/Field
  Marks). Distinct from `lenj` (which varies length, not start position).
- **Bend response** (`bendResponse` ∈ `embrace` / `tame` / `oneside`, **default
  `tame`**) — how a Tooth behaves where the Spine bends tighter than the Tooth is
  long. Per-generator selectable (lives in shared `drawTeeth`, so every generator
  on any spine inherits it). Proven on imported hand-drawn spines in
  `svg-spine-spike.html` (2026-06-20); decision is Mark's, made on real marks.
  - Local radius of curvature at station *i*: `Δθ = acos(clamp(T[i-1]·T[i+1],−1,1))`,
    `r = (2·spacing)/Δθ` (∞ on straights). **Knot condition:** `toothHalfLength > r`
    — the inside ends cross the centerline and neighbours pile.
  - **`embrace`** — full half-length both sides; the pile-up/knot is allowed. With
    real grain it reads as dense *texture*, not error (the *Enfantines*/Campos look).
  - **`tame`** — cap half-length to the local radius only where the bend is tighter
    than the tooth: `hlEff = clamp(min(base, 0.85·r), 0.18·base, base)`. Removes the
    crossover, **keeps the combed-ribbon character.** The default.
  - **`oneside`** — stamp the **convex** flank only (convex dir = `sign((station[i] −
    midpoint(station[i-1],station[i+1]))·normal)·normal`; keep a manual flip
    safeguard for paths whose winding fools it). Inside never crowds, **but the
    ribbon becomes a one-sided radial fringe** — a different motif, not a "cleaner
    ribbon." Use deliberately.
  - **Convention:** ship all three as options; `embrace` stays first-class but is the
    least differentiated (at moderate curvature often ≈ `tame`) — acceptable to
    narrow to `tame`+`oneside` if fewer options are wanted.
- **Gestural modifiers** (`handTremor` / `handGate` / `handChaos`, each 0…1,
  default 0) — the three "loose human hand" axes, all applied in shared
  `drawTeeth` and inherited by **every generator except Linework** (which draws
  its spine directly and never routes through `drawTeeth`). Collective name is
  **"Gestural modifiers"**, NOT "Hand" — `hand` is a **Bend Field** value (a
  p5.brush field name), and reusing the word for an unrelated axis-group is
  exactly the kind of overload §1.5 retired "style" for. (The UI labels read
  "Hand · tremor/gate/chaos" for brevity; the *concept* is Gestural modifiers.)
  - **Tremor** (`handTremor`) — low-freq wander of each tooth's whole position
    **along its own normal** (`noise(x,y) → ±amp` on `s.nx/s.ny`); amplitude
    scales with tooth length so it reads at any size. Distinct from **Bend Field**
    (which bends the stroke *as p5.brush draws it*, not the station position) and
    from **angle jitter** (which rotates the tooth, not move it). Lifted from
    `makeStations` into `drawTeeth` (`95f382b`) so it's geometry-correct on radial
    forms, not Ribbon-only.
  - **Gate** (`handGate`) — spatially-coherent **starve**: a position-noise field
    (`noise(s.x,s.y)`) skips whole stations below the threshold, leaving coherent
    bare stretches and dense clumps. *Not* per-tooth random dropout (that would be
    salt-and-pepper); the noise rides position so the gaps cluster like a hand
    lifting off the page.
  - **Chaos** (`handChaos`) — blends each tooth's length from the orderly **width
    envelope** toward **per-tooth noise length** (`envelope → noise` lerp by
    `handChaos`), with occasional long outliers. Varies length, not position or
    start — distinct from `lenj` (uniform random shrink) and Radial offset.
- **Bend Field** (`field` = a vector field name; levers `fieldAmount` 0…1 and
  `strokeLen` 0.5…3) — a p5.brush native **vector flow field** that bends each
  stroke *as it is drawn*, producing the gestural *Enfantines* wiggle. This is
  the confirmed wiggle mechanism — NOT position jitter and NOT per-tooth sine
  waves, which were both tried and rejected. The field is selected per generator
  via the Field dropdown; `'none'` is the clean off-switch. Most options
  (`curved`, `waves`, `seabed`, `zigzag`, …) are p5.brush built-ins; `'tunable'`
  is our own registered field whose angle magnitude is scaled live by
  **Distortion · amount** (`fieldAmount`). `fieldAmount` therefore applies to the
  `'tunable'` selection ONLY — it is inert for the built-in fields. **Distortion ·
  stroke length** (`strokeLen`) multiplies tooth/stroke length so there is more
  path for the field to bend (a short stamp shows little bend; a longer stroke
  shows more). Per-generator `fieldDefault` is applied on generator *switch*
  (never overriding a loaded preset).
  > **Naming (2026-06-07):** "Bend Field" is deliberately distinct from **Flow
  > Field** (§3, Field Marks alignment hatch) and from **Pigment Blend** (§1).
  > Bend = stroke distortion during draw; Flow = mark *alignment* across the
  > ground; Blend = subtractive colour mixing. Three different mechanisms, three
  > non-overlapping names.

---

## 4. Roadmap

1. **Form (m1 — complete).** `brush-lab.html`. The Generator family —
   Ribbon, Burst, Bloom, Fan, Field Marks, Tuft, Linework — plus the shared
   `drawTeeth` renderer, Tooth bias, Radial offset, Gestural modifiers
   (Tremor/Gate/Chaos), Bend Field + Distortion, and preset save/load. Each
   generator tuned in isolation in the lab harness. *(The earlier version of
   this list named "add Burst/Bloom/Fan" as a future m3 — those generators
   shipped here in m1; the line was stale and is corrected.)*
2. **Pigment (m2 — complete, 2026-06-11).** p5.brush blends overlapping Teeth
   subtractively on its own; m2 confirmed by eye that this reads right across the
   generator family — Tuft, Bloom, Burst, with Tuft the densest-overlap
   substrate. Two-colour overlaps read as believable subtractive mixes
   (blue + yellow → green); triple+ overlaps deepen rather than collapse when the
   palette keeps most members mid-to-light value. Findings (full detail in
   PATTERNS, "Brushstroke — Brush bands"):
   - Blending is a **brush-band property**, not a tuning failure — marker and
     spray blend; dry brushes do not, by material nature.
   - Lighter blues mix to cleaner greens; dark members (navy, dark red) are valid
     as placed depth in sparse contexts but collapse dense pile-ups — a placement
     decision, not a palette ban (per the Enfantines reference plates).
   - Warm browns from red/orange overlaps are expected and acceptable.

   The "translucent dry-media" look in the reference plates is a **composition
   effect** — light spray/stipple texture passes over opaque dry strokes — owned
   by m3, not a missing opacity lever. Owned Spectral.js shader parked at m2
   close; **reopened for M3** — see §1 and item 3 (p5.blender remains ruled out).
   Evidence: presets/ (m2 set).
3. **Composition (m3).** Four strands; (a) is proven and is the milestone's bulk,
   (b) is **BUILT and judged by eye (2026-06-24)**, (c) is the confirmed direction,
   (d) is the spine-import path proven 2026-06-20.

   **(a) Owned pigment pipeline — PROVEN.** Every Generator stops emitting colour
   via p5.brush and instead writes stamps into a shared **mask buffer**; one
   Spectral.js KM shader composites the whole mask (generator-agnostic — the shader
   only ever sees the mask, never a generator). Proven end-to-end on real Tuft
   geometry (`tuft-shader-spike.html`). Sequence: **convert Tuft first** —
   generator→mask→shader — then convert the rest by the same pattern. Mechanism
   detail in §1 and PATTERNS → *Owned pigment pipeline (M3)*.

   **Dry band proven (2026-06-19, `drybrush-km-spike.html`).** Dry-media brushes
   (charcoal/2H/pastel) blend fringe-free through the KM path — the white fringe on
   the charcoal Bloom B in composition-spike was the *naive* p5.brush alpha path, not
   a KM result. The owned grain (jittered discrete stamps + probabilistic skip)
   reproduces the brush-lab Vibration texture closely enough by eye, with **knockout
   OFF** + fewer stamps, sigma ~8–10px, radius-min ~1.1, higher skip + lower coverage.
   Knockout is a per-look lever (off = open spacey grain; on = harder carved edges),
   not always-on. Grain reads best at real (small) mark scale — tune in the rewrite,
   not on a magnified test strip. **Note for the rewrite:** p5.brush's own Vibration
   is unavailable in the owned path (it lives in p5.brush's renderer; bridging it
   needs the `loadPixels` capture that originally parked the shader — see §1). To get
   a pixel-faithful match, **port p5.brush's scatter math into the mask-stamping**
   (copy the formula, never capture pixels). Wet brushes (marker/spray) blend
   fringe-free natively, so a hybrid (native wet + owned-KM dry) remains a possible
   fork if exact native Vibration on wet marks is wanted.

   **(b) Composition staging.** Model a piece as an ordered array of Presets drawn in
   draw-order (= depth): layered-plate richness (stipple under bold strokes, multiple
   passes, Ground + Wash under hero Generators + Field Marks + Linework). The "ground
   under the colour" §3 defers from the individual generators is owned here.
   **Findings (`composition-spike`, transcribed 2026-06-19):**
   - **Q1 render-loop fit — CLEAN.** Preset "plates" draw in sequence into one canvas;
     no flush/await needed for a *static* composite, no field leak between plates, no
     console errors. (The M2 "mid-state" risk is a per-frame rapid-redraw problem —
     owned by the draw-on / append-only strategy, not static staging.)
   - **Q3 performance — naive full-stack redraw is expensive + high-variance:** ~1–1.6 s
     for a 4-plate static composite (436→642→1435 ms across 1→3 plates; dense
     bloom/charcoal plates dominate; same stack varies ±600 ms from stochastic
     re-rasterization). Untenable per-frame → corroborates append-only for the reveal.
   - **Q2 (Mark) — draw-order staging works structurally;** the dry-brush fringe seen
     there was a naive-path artifact deferred to the KM pipeline, NOT a staging defect.
     Density / open space is a composition-authoring concern (mark count, size,
     placement); any per-plate wash/dim lever must be **coverage / mix-amount, not
     alpha** (alpha transparency is what reintroduces fringe). Linework pen-default
     rejected as too thin — use a heavier / pencil / dry brush.
   - **Q4 (audio cohabitation)** not exercised — needs a real user gesture; deferred to M4.

   **BUILT — composition staging renderer (2026-06-24, committed; Mark's by-eye verdict:
   pleased).** The proven multi-plate compositor + FBO plate-cache from `dense-perf-spike.html`
   is graduated into the committed renderer (`project-brushstroke/render/`, ES modules; entry
   `composition.html`). A real composition renders end-to-end through the cached multi-plate KM:
   - **Plate stack, bottom→top: Ground → Wash → Tuft hero.** Ground is a swappable quiet
     base (cream + seeded noise/contrast, image-ready via runtime file-load — DESIGN #8);
     Wash is a few big soft **low-coverage** radial fields in a muted ground-tuned pigment
     (dim = coverage falloff, **never alpha** — the §4·3b rule above); Tuft is the
     owned-pigment hero (a). Ground = `cacheTex[0]`; each mark plate is one KM pass over the
     cache below; **dirty-only recompose** (rest = 0 passes, reveal/edit = the dirty plates
     only — the dense/perf-spike economics, now in committed code).
   - **Live control surface (Mark's by-eye levers):** element scale to frame (#7), ground
     noise/contrast + image swap (#8), palette preset + per-swatch tune, grain amount +
     grain size, wash strength + colour. Each lever rebuilds only the plate(s) it touches
     and recomposites from there up.
   - **In-mark grain — finer + scale-locked (2026-06-24).** The coarse white speckle inside
     marks is the `mask.G` procedural dither (porosity holes showing the ground), not `mask.B`
     knockout (confirmed: grain amount = 0 makes marks solid). It was a fixed *screen-space*
     cell (`floor(vTex·uScale)`) that read blocky and didn't track mark size. Now a
     **pixel-space cell** (`floor(gl_FragCoord/uGrainCell)`) with `uGrainCell = grainSize ·
     element-scale`, so grain shrinks with the mark; areal porosity holds across scales
     (hole fraction `uSkip` is scale-independent). Finer default; exposed as the grain-size
     lever. Detail in PATTERNS → *Brushstroke — composition staging renderer*.
   - **Accent layer — REMOVED.** A spray/stipple top pass was added during the build but was
     never in SPEC and not requested; pulled out (commit `6718948`). The see-through dry-media
     texture stays a future composition concern (the queued fine-scale grain/weathering
     overlay — pending below), distinct from the in-mark grain.
   - **Deferred (not this build):** audio/M4 hooks, rich composition save/load schema
     (`brushstroke.composition`), other generator conversions (Bloom/Burst/Fan… fold in by
     the same emit-marks → mask seam), the global grain/weathering overlay spike,
     modularization / app integration (standalone for this build).

   **(c) Aesthetic direction — CONFIRMED 2026-06-18.** Restraint and negative space
   are the default; **density is the audio-reactive lever** — a calm/slow ambient
   track yields a sparse, open final frame, a faster/denser track a denser,
   overlapping one. The piece is a timed **reveal** toward an authored final
   composition (draw-on along bezier paths, holding at rest). Reconcile with
   DESIGN.md #1 (emergence) and #2 (motion is the medium): the final frame is
   *generatively produced*, not hand-placed, and the work is the motion toward it —
   "authoring the destination" is the composition's seed, not a contradiction of
   emergence.

   **(d) Spine import — PROVEN (2026-06-20, `svg-spine-spike.html`).** A hand-drawn
   Affinity SVG `<path>` flattens to a polyline and registers **1:1 over its ground
   plate**, feeding the existing `placeStations` unchanged. Recipe + gotchas in
   PATTERNS → *Brushstroke — SVG spine import*. Generator-agnostic by construction:
   stations/tangents/normals live in the shared renderer, so Tuft/Bloom/Fan ride the
   same imported spines for free; Ribbon was tested first only as the harshest
   customer. The **Bend response** param (§3.1) was settled on these spines — ship
   all three, default `tame`. **Cleared to graduate to a small isolated feature**
   (the proven draw-on then rides it). Still owed: grain check at pixelDensity 2 in
   a real browser (Mark's eye).
   - **Renderer constraint surfaced here:** p5.brush **corrupts under runtime
     `resizeCanvas`** — reallocating the WEBGL framebuffer leaves its internal stroke
     buffers reading misaligned GPU memory → block/checkerboard tearing that persists
     until page reload (NOT overdraw-related; heavy settings render clean absent a
     resize). The real app resizes (fullscreen, window) and animates the reveal, so
     the **final renderer must not be p5.brush** — corroborates §4·3a (owned mask
     buffer + raw-WebGL2 KM; own the framebuffer and drive resize yourself). If
     multiple ground plates are ever staged in one piece, author them at the same
     pixel size + aspect so no canvas resize is needed.
4. **Performance (m4).** Map audio bands to parameters over time. Only after the
   static forms look right standing still.

Each milestone is its own branch / file. "Build in isolation, then port" is the
rule that keeps us out of the days-long tangles.

> **Diagnostic spikes may cut across milestones; milestone *work* may not.**
> A throwaway vertical slice through Form→Pigment→Composition→Performance is
> sanctioned *as a spike* (see §5) to de-risk architectural unknowns — render-loop
> fit, plates-as-layers, p5.brush performance under many generators at audio
> frame rates — before committing a milestone to them. Its product is a written
> finding, not committed code. This does not relax "build in isolation, then
> port" for actual milestone work.

---

## 5. How we work with agents (collaboration protocol)

To prevent the memory-loss / silent-drift / unrequested-change problems:

- **Ground every session in this file.** Point the agent here first.
- **Propose before editing.** Describe the change and show the diff; wait for
  explicit sign-off before writing it.
- **One change at a time.** No bundling unrelated edits.
- **Spike vs. feature — never mix them.** A *spike* answers a question and is
  discarded; its only product is a written finding. A *feature* is built in
  isolation and committed. A spike lives in its own untracked file with a dated
  verdict block (e.g. `pigment-m2.html`'s PAUSED verdict), is never committed as
  a feature, and is never built upon — findings flow back into this SPEC, the
  code does not flow into the app.
- **A spike may cut across milestones; milestone work may not.** This is the one
  sanctioned way to look ahead: a quarantined throwaway slice through several
  layers, to learn, not to ship. It does *not* relax "build in isolation, then
  port" — that rule governs committed work; the spike quarantine is what keeps
  cross-layer exploration from becoming the layer-tangling it looks like.
- **Spike performance numbers are indicative, not a verdict.** A quick slice
  lacks the optimizations real milestone work would have. Read "it chugs at N
  generators" as "investigate," not "the stack can't do it."
- **No unrequested changes.** Don't "improve" things that weren't asked about.
- **Keep the adapter quarantined.** All p5.brush calls live behind a
  few named helper functions, so a library-API fix is a one-line change and the
  Generator logic never moves.
- **Iterate from real output.** When something looks wrong, describe the actual
  rendered frame (or paste the console error). Don't tune blind.

---

## 6. Capture / Output (viewing & recording)

Two distinct goals, routinely conflated; kept separate here.

### Fullscreen (viewing)
- brush-lab and any published piece support TRUE OS-level display fullscreen via
  the Fullscreen API (`el.requestFullscreen()`) — not a maximized window. This is
  both an authoring need (viewing while tuning) and a viewer-facing feature
  (published pieces let the audience go fullscreen).
- Target element = the canvas's WRAPPER (owns canvas + control panel), not the
  canvas itself, so chrome/panel hide cleanly. Panel auto-hides on fullscreen
  (existing `setPanelForFullscreen` pattern).
- Must fire from a user gesture (same constraint as AudioContext).
- Canvas MUST resize to fill the display on `fullscreenchange` AND `resize`
  (render at innerWidth/innerHeight × devicePixelRatio). The "fullscreen but
  small centered canvas with black margins" symptom is a missing resize, not a
  browser limit. brush-lab has `windowResized → resizeCanvas`; confirm it also
  fires on `fullscreenchange`.
- Idle cursor hide: cursor hidden after ~3s of no movement, reappears on move,
  for clean viewing/performing. Global by default; may be scoped to
  fullscreen-only.
- Caveat: inside a sandboxed iframe (Claude.ai artifact preview, or an embed)
  fullscreen needs `allow="fullscreen"` on the iframe. Test real fullscreen by
  opening the file directly / at its published URL, not in a sandboxed preview.

### Recording (output to disk)
Three sanctioned routes; pick by piece type.
1. **Canvas stream** — `canvas.captureStream(60)` + `MediaRecorder`, audio muxed
   via a `MediaStreamAudioDestinationNode` tapped off the Web Audio graph. Output
   at RENDER resolution, independent of on-screen size or fullscreen; one file,
   video+audio. Best for pixel-clean audio-reactive realtime. Works identically
   on 2D, p5, or Three.js (`renderer.domElement`) canvases. Safari caveat:
   `MediaRecorder` codec coverage is narrower than Chrome's — feature-detect
   `isTypeSupported` (prefer `video/mp4;codecs=avc1`, fall back to `video/webm`);
   if quality/codec disappoints, use route 2. Proven end-to-end in
   `capture-fullscreen-demo.html` (untracked reference, not a feature).
2. **Screen / window capture** — OBS or QuickTime capturing the display or
   browser window; system audio via BlackHole + an Audio MIDI Multi-Output Device
   (monitors AND routes to BlackHole). The route where true fullscreen matters,
   because it films the screen. Confirmed working setup.
3. **Frame export + assemble offline** — render frames to PNG at 2× and stitch
   (optionally via the FILM interpolation pipeline). Highest quality,
   resolution-independent, deterministic with seeds. Non-realtime only — does
   not capture live audio reactivity.

Decision rule: audio-reactive realtime → route 1 (clean single file) or route 2
(screen). Deterministic / seeded still-to-motion → route 3.

---

## 7. Glossary (quick reference)

Spine · Control Point · Station · Tangent · Normal · Tooth (Stamp) · Comb ·
Width Envelope · Generator · Ground · Wash · Field Marks · Flow Field · Bend Field ·
Gestural modifiers (Tremor / Gate / Chaos) · Brush · Brush Weight · Palette ·
Preset · Composition · Pigment Blend · Mask Buffer ·
Spike · Vertical Slice · Fullscreen · Capture Stream · Multi-Output Device.

*If a term isn't here and we find ourselves needing it, add it — the value of
this file is that one word always means one thing.*
