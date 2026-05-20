# Project Brushstroke — SPEC

*A shared vocabulary and architecture reference. Keep this in the repo root.
Reference it at the start of every Claude Code / agent session so we all use
the same words for the same things.*

Part of GenArt2025. Target context: audio-reactive generative performance set
to slow ambient tracks (~30–40 BPM). Aesthetic lineage: Alejandro Campos Uribe's
*Enfantines*, built on **p5.brush** (form) + **p5.blender** (pigment).

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
| **Form** | Where do marks go and which way do they point? | our generator code | v0 lab — *active* |
| **Pigment** | What happens where marks overlap in colour? | p5.blender / Spectral.js | milestone 2 |
| **Performance** | How does sound move the parameters over time? | audio analyser | milestone 3 |

Build and tune each in isolation, then port. Never wire two unfinished layers
together.

---

## 1. Core taxonomy (the nouns)

Read top-to-bottom; each term builds on the one above.

- **Sketch** — a finished piece. Composes one or more Generators over a Ground.
- **Ground** — the background field: a flat colour, a Wash, or Field Marks.
- **Generator** — a system that places many Brush marks into one composite form.
  (The Ribbon is one type; see §3 for the family.)
- **Spine** — the invisible guiding path of a Generator. A spline. *Not drawn*
  unless debugging (the "Draw spine" toggle).
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
  (blue + yellow → green), via p5.blender. *Not* RGB alpha layering.
- **Mask Buffer** — the off-screen shape the blend shader paints into. (See
  Alejandro's notes; we adopt his approach rather than reinvent it.)

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
- **Wash** — soft translucent colour fields underneath (p5.brush fill / `mass`).
- **Registration Marks** — the small `+` crosses and dotted frame border;
  compositional scaffolding, drawn last.

A finished Sketch usually = Ground + Wash + one or two hero Generators
(Ribbon / Bloom) + scattered Field Marks + Registration Marks on top.

---

## 4. Roadmap

1. **Form (v0 — active).** `brush-lab.html`. Get the Ribbon's Comb reading right
   in isolation. No audio, no pigment blending. Tune via the translation table.
2. **Pigment (m2).** Add p5.blender so overlapping Teeth mix subtractively.
   Build in a *separate* test file first; port once stable.
3. **More Generators (m3).** Add Burst, Bloom, Fan as their own modules, each
   tuned in isolation in the lab harness.
4. **Performance (m4).** Map audio bands to parameters over time. Only after the
   static forms look right standing still.

Each milestone is its own branch / file. "Build in isolation, then port" is the
rule that keeps us out of the days-long tangles.

---

## 5. How we work with agents (collaboration protocol)

To prevent the memory-loss / silent-drift / unrequested-change problems:

- **Ground every session in this file.** Point the agent here first.
- **Propose before editing.** Describe the change and show the diff; wait for
  explicit sign-off before writing it.
- **One change at a time.** No bundling unrelated edits.
- **No unrequested changes.** Don't "improve" things that weren't asked about.
- **Keep the adapter quarantined.** All p5.brush/p5.blender calls live behind a
  few named helper functions, so a library-API fix is a one-line change and the
  Generator logic never moves.
- **Iterate from real output.** When something looks wrong, describe the actual
  rendered frame (or paste the console error). Don't tune blind.

---

## 6. Glossary (quick reference)

Spine · Control Point · Station · Tangent · Normal · Tooth (Stamp) · Comb ·
Width Envelope · Generator · Sketch · Ground · Wash · Field Marks · Flow Field ·
Brush · Brush Weight · Palette · Pigment Blend · Mask Buffer · Registration Marks.

*If a term isn't here and we find ourselves needing it, add it — the value of
this file is that one word always means one thing.*
