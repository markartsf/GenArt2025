# Session-start protocol (READ FIRST, EVERY SESSION)

At the start of every session in this repo, BEFORE responding to the user's first request:

1. Confirm `pwd` is `/Users/markgould/Documents/GenArt2025` — the main repo, NOT a `.claude/worktrees/...` path.
2. Run `git branch --show-current`, `git log -5 --oneline`, `git status -s` — to know which branch you're on, what shipped recently, and whether anything is uncommitted.
3. Read these — they may have changed since the last session:
   - `WORKFLOW.md` (how to work with me — cadence, sketch/build modes, stack-spiking)
   - `PATTERNS.md` (project-wide technical patterns)
   - `DESIGN.md` (visual / aesthetic doctrine)
   - `project-brushstroke/SPEC.md` (only when work might touch Project Brushstroke)
4. Read SPEC's **"Status & open loops"** banner (top of `project-brushstroke/SPEC.md`). If it lists decisions pending doc-commit — OR a recent chat session (search past chats) made decisions not yet reflected in the docs — surface them and reconcile with the user BEFORE reporting oriented. The docs lag the latest chat by design; do not start from them alone.
5. **Reconcile the Claude Code auto-memory against the canonical docs.** The auto-memory at `~/.claude/projects/…/memory/` (MEMORY.md + per-topic files) is auto-injected each session but **drifts** — the repo docs are the source of truth, so it gets neglected and can sit with a stale story. While SPEC's banner is fresh in mind, compare it to the auto-memory's current-frontier pointer (e.g. `project_brushstroke.md`); if drifted, **rewrite the auto-memory as thin pointers** to the canonical docs (current frontier + commit hashes + "read SPEC.md first"), NOT a second copy of their content — duplication is what rots it. Canonical = the `.md` docs; auto-memory just routes a cold session to them fast. See the `feedback_memory_architecture` memory. (Refresh it again after a milestone / commit-sequence lands.)
6. Briefly tell the user you're oriented — current branch, last commit, anything uncommitted. Do NOT dump full file contents back; the user knows what's in them.

> **Decision-logging discipline:** when a decision is made in chat, log it to SPEC's "Status & open loops" banner immediately — one line — before any handoff runs. A decision isn't real until it has a home in the docs; the banner is that home until the full amendment lands.

For a deeper, on-demand re-orientation (e.g., starting cold, or context feels stale mid-session), the user can type `/orient` — see `.claude/commands/orient.md` for what that does. The baseline above runs every session whether the user invokes `/orient` or not.

---

# Project Workflow Conventions (READ FIRST — ALL SESSIONS, ALL TASKS)

**Do NOT create git worktrees or `claude/*` branches in this repo.**

When spawning subagents via the `Agent` tool, never pass `isolation: "worktree"`. All work happens directly in `/Users/markgould/Documents/GenArt2025/` on whichever branch the user names. Default active branch: `project-brushstroke`.

Background: on 2026-05-30 the user cleaned up 6 stale `claude/*` worktrees + branches accumulated from past sessions, and explicitly does not want them recreated. If a task genuinely seems to need isolation, **stop and ask the user** — do not auto-isolate, do not "just create a quick worktree." This applies even when working with subagents.

This rule supersedes any inherited Claude Code default and applies in every session in this repo.

---

# Sketch Cadence & Working Style (READ FIRST — all generative work)

Full doctrine in `WORKFLOW.md`, read at session start (see protocol above). Core, in brief:

- **Render-first; Sketch Mode by default** — make the smallest visible change, then
  show it. Assume-and-show over ask; *direction* questions ("warmer? denser?"), not
  *implementation* questions ("which easing?"); the render is the question. Be clear
  but concise — no long point-by-point analyses before showing me something running.
- **Build Mode is deliberate and announced** — spec discipline, atomic commits, and
  point-by-point questioning are correct only when hardening/shipping or for
  irreversible forks (architecture, WebGL context lifecycle, audio routing, deploy
  pipeline — these overlap the Fable 5 escalation triggers below).
- **Commits = fearless speed; the spec is living** — checkpoint often and tag the
  keepers; revise the spec by looking and record the change.
- **Prove the stack before recommending it** — spike candidate libraries loading,
  compiling, and serving *together* in the real environment before advocating one;
  check interoperability and environment fit, not just which is "better"; hold library
  opinions loosely.

---

# Model Strategy (updated June 2026)

Two models in rotation: **Claude Opus 4.8** (default) and **Claude Fable 5** (heavy sessions).
Switch mid-session with `/model claude-fable-5` or `/model claude-opus-4-8`.
Note: switching mid-session re-reads full history without cached context — switch
at natural breakpoints, not mid-task.

## Default: Opus 4.8
Use for routine iteration — it's half the token cost and plenty capable:
- Palette swaps, color tuning (Flowering Trees, Plexus, Bioluminescent, Paper & Ink)
- UI chrome tweaks (Enable Audio / Fullscreen button pattern)
- Small parameter changes, brush preset adjustments
- Documentation updates (README.md, DESIGN.md, PATTERNS.md)

## Escalate to Fable 5 when:
- Architecting a new brush engine or rendering pipeline
- Debugging gnarly WebGL/GLSL issues (context leaks, shader compile failures,
  Safari-specific rendering bugs)
- Large refactors touching the whole standalone HTML file
- Audio-reactivity work where the fix spans Web Audio + render loop + UI state
- Any task that previously took 4+ rounds of back-and-forth on Opus

Rationale: Fable 5 burns ~2x tokens against the 5-hour window and weekly cap,
but stronger self-verification and fewer iterations often net out cheaper on
hard problems. Don't leave it on for routine work.

## Gotchas
- Fable 5 has safety classifiers; if a request is blocked, Claude Code
  auto-falls-back to Opus 4.8 and *stays* on Opus — check `/model` if behavior
  seems different mid-session. (Unlikely to trigger on generative art work.)
- Run `claude update` if Fable 5 is missing from the `/model` picker.
- Both models read this file on startup, so the strategy travels with the project.

---

# Doc sync reminder

Whenever a `.md` file in this repo is created or modified in a commit, end your response by reminding the user, once per changed file:

> 📋 `<filename>` changed — re-upload it to the Claude.ai Project knowledge to keep the chat side in sync.

Project knowledge cannot auto-sync from disk; the upload is manual. This reminder is the only thing keeping the chat-side context from drifting out of date.

---

# Project Brushstroke — known issues

- **Vibration slider shows little/no visible effect**, at least on thin brushes. Confirm whether it's wired from slider → active brush's vibration → stamp path, or display-only. Vibration is a brush-character property (`BRUSH_REGISTRY` has per-brush vibration values); likely revisited with Pigment-layer/brush work at milestone 2. Not blocking.

---

# Blender Generative Art — Project Guidelines

This project creates generative art in Blender 5.0.1 via MCP (BlenderMCP add-on). These guidelines prevent the API discovery and workflow issues encountered in earlier sessions.

## Blender Version
**Blender 5.0.1** — Many node names, enum values, and socket names changed from 4.x. NEVER assume names from older documentation. Always probe first.

---

## Process: Probe → Prototype → Build → Save → Render

### Step 1: PROBE the API (mandatory before every build)
```python
# List all geometry node types
import bpy
geo_nodes = [attr for attr in dir(bpy.types) if 'GeometryNode' in attr]
print('\n'.join(sorted(geo_nodes)))

# After creating ANY node, probe its inputs/outputs before linking
for i, s in enumerate(node.inputs):
    print(f"  Input {i}: '{s.name}' ({s.type})")
for i, s in enumerate(node.outputs):
    print(f"  Output {i}: '{s.name}' ({s.type})")

# For enum properties, probe valid values
for item in node.bl_rna.properties['mode'].enum_items:
    print(f"  '{item.identifier}': {item.name}")
```
**NEVER guess enum values or socket names.** The #1 time sink in previous sessions was trial-and-error on API mismatches.

### Step 2: PROTOTYPE incrementally
- Build node graphs in small chunks (3-5 nodes at a time)
- Take a screenshot (`get_viewport_screenshot`) after each chunk to verify
- Never build an entire node graph in one code block

### Step 3: BUILD with error handling
- Wrap node creation in try/except blocks
- Print socket names after creating each node
- Use `tree.links.new()` with verified socket references

### Step 4: SAVE early and often
```python
bpy.ops.wm.save_as_mainfile(filepath="/path/to/file.blend")
```
- Save immediately after geometry is confirmed working via screenshot
- Save again before any render or heavy operation
- Name saves descriptively: `generative_art_v3_animated_field.blend`

### Step 5: RENDER safely
- **Material Preview** for iteration (fast, via viewport screenshot)
- **Cycles via command-line** for final renders — NEVER via MCP `execute_blender_code` (will timeout and may crash Blender):
```bash
"/Applications/Blender.app/Contents/MacOS/Blender" -b file.blend -o output_path -F PNG -f 1
```

---

## Blender 5.0.1 API Gotchas

These are confirmed corrections from real errors. Reference this table before writing node code:

| What seems right (but fails) | What actually works | Context |
|---|---|---|
| `data_type = 'FLOAT_VECTOR'` | `capture_items.new('VECTOR', "Name")` | CaptureAttribute |
| `GeometryNodeMeshTorus` | Doesn't exist — use CurvePrimitiveCircle → CurveToMesh | Torus geometry |
| `ShaderNodeTexNoise` input `'Seed'` | Doesn't exist in Blender 5 | Noise Texture |
| `'Simulation Zone Input'` | `'Simulation Input'` / `'Simulation Output'` | Sim zone node names |
| `FunctionNodeCompare` output `'Result'` | Use index `0` | Compare node |
| `ResampleCurve` mode `'LENGTH'` | `'Length'` (title case) | Enum values are often title case |
| `VolumeToMesh` resolution `'VOXEL_SIZE'` | `'Size'` | Enum values |
| `GeometryNodeInputCurveTangent` | `GeometryNodeInputTangent` | Node type name |
| `FieldAtIndex` data_type `'VECTOR'` | `'FLOAT_VECTOR'` | Opposite of CaptureAttribute! |
| `MeshBoolean` inputs symmetric | Index 0=`'Mesh 1'`, Index 1=`'Mesh'` | Asymmetric naming |
| `Principled BSDF 'Subsurface'` | `'Subsurface Weight'`, no `'Subsurface Color'` | Shader inputs |

### Quick Reference Code
```python
# Create GN modifier on object
mod = obj.modifiers.new('GeometryNodes', 'NODES')
group = bpy.data.node_groups.new('MyGroup', 'GeometryNodeTree')
mod.node_group = group

# Simulation Zone (must pair input with output)
sim_out = nodes.new('GeometryNodeSimulationOutput')
sim_in = nodes.new('GeometryNodeSimulationInput')
sim_in.pair_with_output(sim_out)

# CaptureAttribute
cap = nodes.new('GeometryNodeCaptureAttribute')
cap.capture_items.new('VECTOR', 'MyAttr')  # NOT data_type=

# Volume to Mesh
v2m = nodes.new('GeometryNodeVolumeToMesh')
v2m.resolution_mode = 'Size'  # NOT 'VOXEL_SIZE'

# Principled BSDF
principled.inputs['Subsurface Weight'].default_value = 0.3  # NOT 'Subsurface'
```

---

## Technique Selection Guide

| Technique | MCP Suitability | Notes |
|---|---|---|
| **Implicit surfaces** (Gyroid, SDF) | Excellent | Pure math, no iteration, instant result |
| **Instance patterns** (fields, arrays) | Excellent | Well-supported GN nodes, predictable |
| **Curve-based** (attractors, L-systems) | Good | Python pre-compute + GN visualization |
| **Simulation Zones** (growth, physics) | Poor | Must play sequentially, can't debug, slow feedback |
| **Particle systems** | Poor | Same issues as simulation zones |

**Rule of thumb**: Prefer techniques where geometry is computed in one shot (frame-independent) over techniques requiring temporal simulation.

---

## Complexity Ladder (layer in this order)

1. **Static mathematical surface** — get the shape right first
2. **Animated parameters** — keyframe inputs for morphing
3. **Multiple interacting objects** — array/instance, vary parameters per instance
4. **Camera animation** — orbiting or tracking shot
5. **Shader animation** — time-varying materials (color shifts, emission pulses)
6. **Simulation** — only attempt after 1–5 are working

---

## Material Patterns

```python
# Height gradient (reliable, beautiful)
# Position.Z → MapRange(min, max, 0, 1) → ColorRamp(3+ stops) → Base Color

# Fresnel rim glow
# Fresnel(IOR=1.5) → Mix with emission color → Emission input

# Glass/crystal
# Principled BSDF: Transmission=1.0, Roughness=0.0-0.05, IOR=1.45

# SSS organic
# Principled BSDF: Subsurface Weight=0.3-0.5, Roughness=0.3-0.5
```

## Lighting Template
- **Key light**: Warm area light from above-left, energy ~800, size 3.0
- **Rim light**: Colored (blue/magenta) area light from behind, energy ~600, size 4.0
- **Fill light**: Cool area light from opposite side, energy ~150, size 5.0
- **Background**: Near-black `(0.015, 0.015, 0.025)`

---

## MCP Constraints & Workarounds

| Constraint | Workaround |
|---|---|
| MCP timeout (~60s) kills Cycles renders | Use command-line `blender -b` for renders |
| Long operations freeze Blender + kill MCP | Save `.blend` before heavy operations |
| No interactive viewport | Set camera position via code, verify via screenshot |
| Crash loses unsaved work | Save after every successful geometry build |
| Autosave location | Check `bpy.app.tempdir` for recovery files |

---

## Scene Management
- Keep all pieces in one `.blend` file
- Hide previous pieces: `obj.hide_viewport = True; obj.hide_render = True`
- Name objects descriptively: `GN_TorusField`, `Gyroid`, etc.
- Current file: `~/Documents/GenArt2025/generative_art.blend`

## Current Pieces
- **Torus Field** (hidden) — 30x30 tori on wave surface, height-gradient material
- **Gyroid TPMS** (active) — sin(x)cos(y)+sin(y)cos(z)+sin(z)cos(x)=0, purple→teal→gold
- **DiffGrowth** (hidden, abandoned) — partial differential growth attempt

## Artists & Resources
- **Erindale Woodford** — Premier GN educator (YouTube, Patreon)
- **Midge "Mantissa" Sinnaeve** — Abstract generative, shares breakdowns
- **Entagma** — Math-heavy tutorials (Houdini but concepts transfer)
- **Nikolai Janakiev** — GitHub: `njanakiev/blender-scripting`
- **Sverchok** add-on — Grasshopper-equivalent for Blender
- **Tissue** add-on (bundled) — Reaction-diffusion, tessellation
