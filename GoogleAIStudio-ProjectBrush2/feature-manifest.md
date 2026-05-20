# Feature Manifest

## Current Project State
The application is a generative art visualizer reacting to audio using `p5.js`, `p5.sound`, and `p5.brush`.
Currently, the basic setup of the sketch is implemented in `public/sketch.html`.
* **Stable Core:** WebGL canvas successfully integrates `p5.brush.scaleBrushes()` and cumulative drawing loops (`preserveDrawingBuffer: true`).
* **Audio Interactivity:** Async file load & initialize bypasses browser autoplay restrictions restrictions. FFT energy (bass & treble) is mapped to drawing events.

## Verified Dependencies
* `p5.js` v1.11.2 
* `p5.sound` v1.11.2
* `p5.brush` v1.1.4

## Next Implementation Cycle: The "Ambient Enfantines" Pass
1. **Pacing and Scale**: Re-tool the animation loop and brush speed to map to 30-40BPM ambient synthesis. Reduce speed mappings from `[5, 50]` down to `[0.1, 1.5]`.
2. **Perlin Flowfield Integration**: Migrate randomized angles into pure `noise(x,y)` vector fields so brushes drift organically along visible fluid paths.
3. **"Enfantines" Spline Textures**: Expand the `brushType` array to utilize Alejandro's multi-stroked, natural brushes (`watercolor`, `charcoal`, `marker`, `hatch_brush`) executing short, connected line segments. 
4. **Graceful Fade & Canvas Cleanup**: Introduce a deeply transparent, low-frequency wiping mechanism (e.g., `fill(5, 5, 5, 5)` every Nth frame) that slowly eats away old strokes, keeping the composition fresh for lengths over 3:00 minutes.