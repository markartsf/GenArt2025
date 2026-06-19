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

- **Mask-channel convention — study-only, design our own.** In the Enfantines
  reference the mask RGBA channels are a paint *recipe*, not a colour: distinct
  channels select shader paint behaviours (the ref uses green/blue/red codes) and
  per-channel alpha carries amount. Our spikes instead use **scheme A** (mask `rgb`
  = the stroke's actual colour, `alpha` = coverage), which is enough to prove
  pigment reads. **Pick and document our own convention here before the generator
  rewrite — do not assume the shader already branches on channel codes; it does
  not.**
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
  - **Owed:** the user's by-eye check at **pixelDensity 2 in a real browser**
    (Claude Preview corrupts WebGL at density 2 / heavy overdraw — see *brush-lab
    pixelDensity gate*); plus a **real-browser dense-generator perf pass** (native
    rAF, a real Tuft/Bloom stamped incrementally at the target slow reveal) before
    committing draw-on to dense generators — the spike's ~0.1 ms numbers were
    sandbox `setInterval`-driven on 8 trivial strokes and do not prove dense
    throughput. Append's "cost scales with new marks/frame, not total accumulated"
    is what makes that pass likely to pass, but it must be measured, not assumed.
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

---

## Recording & export

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
