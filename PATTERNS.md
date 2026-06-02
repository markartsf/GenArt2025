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

### Capable but out of scope

Tools that are genuinely capable in their own domain but intentionally not part of this project's generative core. Noted here so future sessions don't re-investigate them from scratch. Can be promoted to Under Evaluation if a specific piece calls for them.

- **Apple Motion** — post-production and finishing tool. Legitimately useful for: 2.5D compositing of rendered layers, Behaviors-driven typographic animation, particle effects as atmospheric post layer, color grading, clean export pipeline to FCP/ProRes. Not useful for: audio reactivity, generative systems, shader hosting. Revisit specifically if a piece calls for 2.5D parallax compositing, Behaviors-driven motion on typography or logos, or post-layer atmospheric effects over code-rendered footage.
- **Spline** — product-design lineage (see DESIGN.md Commitment #6). Legitimate for Metaculture materials, companion UI, control-panel interfaces, portfolio framing. Not for the art itself.

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
