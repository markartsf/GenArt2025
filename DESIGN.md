# GenArt2025 — Design Principles

Visual vocabulary and aesthetic commitments for this project. Medium prescriptive: concrete enough to guide real decisions, loose enough to evolve. When a sketch feels "off," check here first — it's usually a principle violation, not a technical bug.

---

## Core commitments

**1. Emergence over composition.**
The interesting moments come from system behavior, not arranged elements. Build rules, let them run, edit by adjusting rules rather than placing things.

**2. Motion is the medium.**
A still frame is a reference, not the work. Every piece should be legible as time-based — if a screenshot fully captures it, something's missing.

**3. Audio reactivity is structural, not decorative.**
When audio drives a sketch, it should drive the *form*, not just modulate brightness or scale. The geometry itself should respond. Ask: "would this piece exist without the audio?" If yes, the audio isn't doing enough.

**4. Intentional restraint in a maximalist medium.**
Three.js + GPU shaders tempt you toward constant maximum. The best moments usually have negative space — darkness the particles don't reach, silence between swells, geometry that occasionally resolves to stillness.

**5. Accept the machine's fingerprint.**
GPU banding, shader artifacts, aliasing at edges — these are part of the medium's honest texture. Don't over-polish them away. (But also: don't fetishize them when they're just bugs.)

**6. Patch-programming lineage, not product-design lineage.**
The project's visual sensibility descends from the live-coding, shader-patching, node-graph tradition — TouchDesigner, vvvv, Max/MSP Jitter, openFrameworks, the demoscene. This tradition values: signal and feedback as material, real-time responsiveness, mathematical/procedural beauty, comfort with complexity and noise, the aesthetic of systems that *appear* to be thinking. It is suspicious of: over-polished surfaces, preset-driven "looks," easy beauty. When evaluating a tool or a finished piece, ask which lineage it belongs to. Spline and similar web-3D design tools produce genuinely good work in their own tradition (interactive product/web design, polished marketing 3D) but that tradition isn't this one. Use them for companion UI and Metaculture materials; don't let their defaults leak into the art.

**7. Element scale — small relative to the frame.**
Generators render at a small fraction of the frame, not blown up to fill it. Following Alejandro Campos Uribe's *Enfantines* plates: many fine, delicate marks with the ground leading and negative space dominant — a single comb or burst typically occupies roughly a fifth to a quarter of the frame, not most of it. Mark scale relative to the frame is a primary, per-piece composition lever, independent of bend-response, brush, and palette. Default to small-and-many over large-and-few; let the ground breathe. (The blown-up single-spine framing in the SVG-spine spike was a geometry stress test, not a compositional target.) This is the spatial complement to #4 (restraint / negative space), and pairs with #8 — together they are the two halves of "let the marks breathe."

**8. Quiet grounds.**
Ground plates stay quiet — low noise, low contrast, soft washes — so the fine marks read against them. Following the *Enfantines* grounds (pale, soft, recessive), the ground supports the marks rather than competing with them. Heavy film grain, strong tonal blocks, or busy texture pull attention away from small, delicate elements and swallow them; avoid them. The ground recedes; the marks carry. (The plate-1 / plate-2 grounds used in the SVG-spine spike were deliberately textured stand-ins and ran too noisy for fine marks — not the target for composition grounds.) Pairs with #7: small marks need a quiet ground to read, and a quiet ground invites small marks.

---

## Palettes

Working palettes. Each has a mood and a use case. Add to this as new ones emerge.

### Flowering Trees (Washington, Spring 2026)

Pulled from red-leafed plums against yellow-green blossoming bigleaf maples. A complementary pairing that reads as tension-plus-harmony rather than clash.

```
Deep red-purple    #5B1F2A   — foliage base, recessive
Oxblood            #8B2E3F   — foliage highlight, warm shadow
Acid yellow-green  #C8D84A   — blossom, forward, high-energy
Pale chartreuse    #E8EEB8   — blossom highlight, near-white
Charcoal           #1A1614   — negative space / dark background
```

**Use for:** organic-system pieces, pieces that want seasonal/temporal resonance, anything with growth or bloom as a metaphor.

### Plexus (from the Supernova point cloud)

```
Void                #03040A
Deep blue           #1B2A6B
Cyan glow           #4ECDC4
Warm white          #F8F4E9
Ember               #FF6B3D
```

**Use for:** particle systems, network/constellation aesthetics, anything that wants cosmic scale. Additive blending friendly.

### Bioluminescent (neural network piece)

```
Abyss               #000814
Deep teal           #003049
Pulse cyan          #00F5D4
Pulse magenta       #FF006E
Phosphor green      #9EF01A
```

**Use for:** organic networks, nervous-system metaphors, pieces that want to feel alive-in-the-dark.

### Paper & Ink (reserved for companion materials)

```
Ivory               #F5F1E8
Warm black          #1C1B17
Deep red            #7A1F2B
```

**Use for:** Metaculture materials, documentation, anything print-oriented. Not for the art itself.

---

## Color rules

- **One palette per piece.** Don't mix. If you want variety, make it a series.
- **Complementary pairs beat analogous runs.** The red-against-yellow-green tension in Flowering Trees is doing more work than a safe green-to-blue gradient ever would.
- **Reserve one color as negative space** — usually the darkest. It should account for 40%+ of the visible frame most of the time.
- **Saturation earns its place.** If a color is highly saturated, it should be the element the viewer's eye follows. Don't have two fighting for that job.

---

## Motion principles

- **Ease into everything.** `lerp(current, target, 0.1)` or similar. Hard cuts are rare and deliberate.
- **Slow is almost always better.** A 10-second morph reads as intentional; a 2-second morph reads as a demo.
- **Audio-reactive != frame-accurate.** Smoothing is the point. The visual lags the audio slightly and that's correct.
- **Let things rest.** Periodically the system should approach stillness. Constant motion becomes wallpaper.

---

## Composition

- **Center is powerful, use it sparingly.** Dead-center symmetry reads as either sacred or cheap with little middle ground. Commit to one.
- **The frame is the piece.** In web contexts, design for fullscreen. Don't rely on browser chrome, margins, or surrounding page layout to frame the work.
- **Depth over flatness.** Even in 2D sketches, use blur, scale, atmospheric perspective, or layering to suggest dimensional space.

---

## What this project is *not* doing

Stating the negative space helps. GenArt2025 is not:

- Product UI or dashboard aesthetics
- Polished web-3D / marketing 3D aesthetics (Spline, most Three.js showcase work) — good tradition, different tradition
- Infographic / data visualization (unless data *is* the piece)
- Parody of existing artists' styles
- Polished "AI-looking" renders — no midjourney-default glossy surfaces
- Nostalgic demoscene pastiche (respect it, don't imitate it)

---

## References (touchstones, not models to copy)

- Casey Reas — systems and rules as medium
- Memo Akten — emergence, biological metaphor
- Refik Anadol — scale and data-as-material (but with more restraint than his work tends toward)
- Robert Hodgin — particle systems, the Plexus lineage
- Agnes Martin — for color and restraint, not subject
- Walter Benjamin — *why* this matters (aestheticization, aura, reproducibility). The theoretical backbone.

Consulted, not copied. Original work only.
