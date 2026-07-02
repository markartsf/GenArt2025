# Project Brushstroke — V1.0

A standalone audio-reactive generative piece: **Ribbon + Burst** marks accrete toward a
frame as a track plays, rendered natively through **p5.brush** on a cream ground. Audio
energy drives *form* — accretion density, per-mark boldness, and transient flurries on note
onsets. Append-only: marks only ever arrive.

Self-contained: plain HTML + vendored `lib/p5.min.js` (p5 2.3.0) + `lib/p5.brush.js`
(2.1.9-beta) + `winterland.mp3`. No build step.

## Run locally

**Must be served over HTTP** — the Web Audio API is blocked on `file://`, so don't just
double-click `index.html`. From the repo root:

```bash
npx vite project-brushstroke/v1 --port 8092
# or:  cd project-brushstroke/v1 && python3 -m http.server 8092
```

Then open <http://localhost:8092/>. Judge at retina in a real browser (Claude Preview forces
pixelDensity 1).

## Deploy to Netlify

The site is static; the publish directory is this `project-brushstroke/v1` folder (set in the
repo-root `netlify.toml`). Any of:

1. **Drag-and-drop** — drag the `project-brushstroke/v1` folder onto the Netlify "Sites" drop
   zone at <https://app.netlify.com/drop>. Instant, no account config.
2. **Netlify CLI** — `npx netlify deploy --dir project-brushstroke/v1 --prod`
   (runs `netlify login` first; needs your Netlify account).
3. **Git-connected** — in Netlify, "Add new site → Import from Git", pick this repo, leave the
   build command empty and set publish directory to `project-brushstroke/v1` (or rely on the
   root `netlify.toml`). Auto-deploys on push.

Audio, video capture, and fullscreen all work on the HTTPS Netlify URL. The site is public
unless you gate it in Netlify.

## Controls

- **Curate:** Reseed (`seed×7+1`), ‹ › step, Random, hero count/type. **Save PNG** freezes a frame.
- **Load track…** — play against any local audio file instead of the baked `winterland.mp3`
  (basic; per-track auto-normalization comes in V1.1).
- **▶ Play with audio** — audio-driven reveal. **Reveal ▶ (manual)** — silent fixed-clock preview.
- Sliders: **rate** (strokes/s @ full energy), **audio → boldness**, **transient flurry** (strokes/hit).
- **Stage controls** (top-right) / keys: **P** presentation mode (hide UI), **F** fullscreen,
  **R** record a `.webm` video of the playthrough (canvas + the track's audio; keep the tab
  visible while recording).

## Notes / known limits

- Video capture uses `MediaRecorder` (webm, vp9/opus preferred). Best in Chrome; some Safari
  builds lack support and the Record button reports that gracefully.
- The reveal loop uses `requestAnimationFrame`, so it pauses if the tab is backgrounded —
  keep it visible while playing or recording.
- Canvas is sized once at setup and never resized at runtime (a p5.brush framebuffer
  constraint); presentation mode scales the *display* only.
