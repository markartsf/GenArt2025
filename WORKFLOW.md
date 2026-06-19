# WORKFLOW.md — Working With Me on Generative Art
 
> A guide for agents (Claude, Claude Code, and any collaborator) on *how* to work
> with me, not *what* to build. The aesthetic and technical specifics live in
> `DESIGN.md` and `PATTERNS.md`; the project index lives in `README.md`. This
> document governs **cadence, communication, and the rhythm of the work.**
 
---
 
## 0. The one-sentence version
 
**Show me something running before you ask me to think.** Most decisions in a
generative sketch are made by *looking*, not by discussing — so default to a small,
visible change and a render, and reserve detailed point-by-point questions for the
rare moments they actually earn their cost.
 
---
 
## 1. Read this first: the working tension
 
These are **generative art sketches.** They are closer to gestural painting than to
shipping a product. I work the way I paint: make a mark, step back, see what the
canvas wants, make the next mark. The piece tells me what it needs *once it exists* —
not before.
 
Agents trained on software engineering carry a strong default: **specify fully,
confirm every detail, then build,** because in production code ambiguity is expensive
and rework is costly. That instinct is correct *there.* It is frequently wrong *here*,
because in a sketch:
 
- **Rendering is cheap.** Running the thing is the fastest way to evaluate it.
- **The spec is partly discovered by looking.** I often can't tell you what I want
  until I see what the algorithm actually produces. The output is information that
  *feeds back into* the spec.
- **Over-specification destroys the thing being sought.** Surprise, emergence, and
  the happy accident are not bugs in this process — they're the point. Nailing down
  every parameter before the first render forecloses the search space I'm here to
  explore.
- **My visual cortex is the evaluation function.** Words about "particle decay rate
  0.95" mean nothing to me until rendered. Verbal back-and-forth *before* a render is
  usually wasted motion, because the judgment can't happen in language.
So: rigor is welcome, but it has to be **the right rigor at the right time.** The rest
of this document is mostly about timing.
 
---
 
## 2. Two modes — learn to tell them apart
 
Almost every frustration comes from running the wrong mode. Name the mode you're in,
out loud, in a sentence, when it's ambiguous.
 
### Sketch Mode (the default)
 
We are *finding* something. We don't yet know exactly what the piece is. Behavior:
 
- **Render first, discuss second.** Make the smallest reasonable change that produces
  a visible result, then show it.
- **Assume and proceed.** When a small detail is unspecified, pick a sensible default,
  state the assumption in one line, and *keep going.* Don't stop to ask.
- **Bias toward velocity and momentum.** I need to see where we're headed more than I
  need any single decision to be optimal.
- **Throwaway code is fine.** Quick, rough, replaceable. We are not hardening anything
  yet.
- **Two variants beat one question.** If you're unsure between A and B and both are
  cheap, render both and let me point. Showing is faster than asking.
### Build Mode (the deliberate one)
 
We've *found* the piece (or part of it) and now we're hardening, structuring, or
shipping it. Behavior:
 
- **Now spec discipline pays.** Architecture, file structure, audio routing, the
  build/deploy pipeline, anything expensive to reverse — slow down, lay it out, get
  my sign-off.
- **Careful, atomic commits with real messages.** (See §5.)
- **Point-by-point is appropriate here.** The detailed questioning that's annoying in
  Sketch Mode is correct in Build Mode.
### Detecting the mode
 
| Signal | Likely mode |
|---|---|
| "Let's try…", "what if…", "play with…", "rough" | Sketch |
| New visual idea, no clear target yet | Sketch |
| "Lock this in", "clean up", "ship", "refactor" | Build |
| Architecture / context management / audio routing / deploy | Build |
| A WebGL/context/teardown bug that bites if done wrong | Build |
| Unsure | **Assume Sketch, say so, proceed** |
 
The valuable meta-skill is **cheap transitions between modes.** Moving from sketch to
build should be a deliberate, announced step ("This is working — want me to switch to
Build Mode and harden it?"), not a silent slide into heavyweight process.
 
---
 
## 3. Question discipline
 
The problem is almost never *that* you ask questions. It's **when, how many, and at
what granularity.** Guidelines:
 
- **The render is the question.** Prefer "here are two versions, which direction?" over
  "should the easing be linear or exponential?" Let my eyes answer.
- **Ask about direction, not implementation.** Good: "warmer or cooler palette?",
  "denser or sparser?", "more chaotic or more ordered?" Bad in Sketch Mode: "what
  cubic-bezier control points?", "what FFT bin range?" — just pick one and show me.
- **Batch and defer.** If you have five small uncertainties, don't interrupt the loop
  five times. Make defensible defaults, note them in a short list at the bottom of your
  message, and render. I'll correct the two that matter.
- **One blocking question, maximum, per turn** — and only when the fork is genuinely
  irreversible or expensive (see §6). Everything else is an assumption-plus-render.
- **Offer a default and proceed:** "I'll use X unless you say otherwise" — *then
  actually do X and show it,* don't wait.
A useful test before asking me anything: **"Could I have just shown him instead?"**
If yes, show me.
 
---
 
## 4. The feedback loop — what "regular visual intervals" means
 
I need to *see* the work evolving at a steady rhythm. Concretely:
 
- **Small change → render → look → react.** Keep each loop short enough that I'm never
  more than one render away from the current state of the piece.
- **Never disappear into a long silent build** in Sketch Mode. A 200-line change I
  can't see yet is worse than three 60-line changes I can watch land.
- **End turns on something I can run**, not on a wall of questions. If you must ask,
  ask *and* leave me a running version reflecting your best guess.
- **Keep the iteration surface live.** localhost:5173 (Vite) for general work, the
  standalone HTML for self-contained pieces — whatever lets me hit refresh and judge.
The painting analogy holds: I'm stepping back from the canvas between marks. Don't make
me wait for the whole painting to react to the first brushstroke.
 
---
 
## 5. Commits and the living spec — rigor *in service of* speed
 
Frequent commits and fast sketching are not in tension — **commits are what make
fearless speed possible.** A tight commit cadence means I can always roll back, so we
can experiment recklessly without losing good states.
 
- **Sketch Mode commits are checkpoints / save points.** Commit often, at every state
  worth being able to return to. Messages can be short and honest:
  `wip: trying radial palette on scene 3`. The goal is recoverability, not ceremony.
- **Build Mode commits are atomic and described.** Clear messages, coherent units of
  change, the discipline appropriate to code we're keeping.
- **Tag or note the keepers.** When a sketch state is one I love, mark it clearly so we
  never lose it to the next experiment.
### The spec is a living document
 
I value sticking to a spec with strict revisions — but the spec **evolves by looking.**
 
- Treat the spec as **versioned and revisable**, not frozen at kickoff. When a render
  teaches us something, the correct response is to *revise the spec*, note the change,
  and continue — not to treat the original as binding.
- **Strictness applies to honoring the *current* agreed spec,** not to pretending the
  first draft was complete. "Strict revisions" means changes are deliberate and
  recorded, not that change is resisted.
- Keep a short running list of open decisions and resolved ones, so we always know what
  we've actually committed to versus what's still in play.
---
 
## 6. When to genuinely slow down
 
Velocity is the default, *not* an absolute. There are real cases where point-by-point
deliberation is correct, and an agent that recognizes them is more valuable, not less.
Slow down and spec carefully when a decision is:
 
- **Irreversible or expensive to undo** — architecture, data/file structure, the shape
  of the codebase.
- **A known footgun** — WebGL context lifecycle and teardown (we've been bitten by
  context accumulation before), Safari AudioContext rules, audio ducking/routing.
- **Pipeline-level** — git/Vercel deploy behavior, the build setup, anything that
  affects how the whole thing ships.
- **A model/effort escalation point** — large refactors, gnarly shader debugging, or
  anything past ~four rounds without convergence may warrant escalating the model or
  stepping back to re-architect rather than grinding.
The skill is *discrimination*: heavyweight process on the 10% that needs it, and a fast
brush on the 90% that doesn't.
 
---
 
## 7. Library and stack choices — prove the integration before you recommend it
 
A confident argument for one library over another (p5.brush over Spectral.js, one
renderer over another) is worth very little until it has been shown to **load, compile,
and run together in my actual environment.** Most of the bugs that cost us hours —
server errors, rendering glitches, shader compile failures, load-order problems — are
*integration* failures that were predictable up front, not flaws in the "better"
library. They surface late because the recommendation was reasoned from priors instead
of proven.
 
This is not a detour from render-first — it **is** render-first, applied to the stack
choice. The cheapest way to settle "should we use X" is a thin running proof, not an
essay.
 
**Before strongly recommending a library or stack:**
 
- **Spike it first.** Stand up the smallest possible slice — the candidate libraries
  loading *together*, the canvas/shader compiling, the server serving it, console
  clean. A recommendation backed by a 20-line proof that actually runs beats a
  paragraph of sound-sounding logic.
- **Check interoperability, not just merit.** The question is rarely "which library is
  better" in the abstract — it's "do these actually work *together*, and with my
  existing audio / WebGL / p5 stack?" Two excellent libraries can be a bad pair.
- **Check environment fit explicitly.** Will it work the way I actually load things —
  standalone HTML via `<script>` tag, Vite at `:5173`, or `python3 -m http.server` for
  Web Audio? ESM vs UMD vs global, CDN availability, load order, build step, Safari
  quirks, WebGL context interactions. These are the *predictable* failure classes —
  name the risk before we build on top of it, not after.
- **Hold recommendations loosely, and date them.** The library landscape moves and my
  knowledge has a cutoff. For a load-bearing choice, a quick check of the current
  version, maintenance status, and known interop issues is worth more than confidence
  from memory. Say plainly when a recommendation is a prior rather than a verified fact.
**Default:** when a stack decision is load-bearing, *show me it running together in
minimal form first,* then recommend. Don't argue me into an architecture that hasn't
compiled yet.
 
---
 
## 8. Anti-patterns (things that break the flow)
 
- ❌ Asking a stack of detailed questions before rendering anything.
- ❌ Recommending a library or stack confidently from priors, with no minimal proof it
  loads, compiles, and runs together in my environment.
- ❌ Interrupting the loop to confirm a trivial, reversible default.
- ❌ Going silent for a large build I can't see incrementally.
- ❌ Treating the opening spec as frozen and resisting visually-motivated revision.
- ❌ Ending a turn on questions instead of on something I can run.
- ❌ Asking about *implementation details* ("which easing?") that a render would answer.
- ❌ Sliding into Build Mode discipline (atomic commits, full specs, sign-offs) while
  we're clearly still sketching — and the reverse: staying loose when we're shipping.
## 9. Default behaviors (the quick scan)
 
1. Assume **Sketch Mode** unless told otherwise; say which mode you're in if unclear.
2. **Render first.** Smallest visible change, then show it.
3. **Assume-and-show** over ask. State assumptions in one line; keep moving.
4. **Direction questions, not implementation questions.** Max one blocking question.
5. **Two variants** when cheap and you're genuinely unsure.
6. **Short loops**, never a long silent build.
7. **Commit often** as checkpoints; tag the keepers.
8. The **spec is living** — revise by looking, record the change, continue.
9. For a **load-bearing stack choice, spike it** — show it loading and compiling
   together before recommending; hold library opinions loosely.
10. **Slow down only** for the irreversible, the footguns, and the pipeline.
11. Before asking anything: *"Could I have just shown him instead?"*
 
