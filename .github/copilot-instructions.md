# Copilot Instructions for GenArt2025

An audio-responsive generative art project using Tone.js and Canvas rendering. Multiple visualization sketches respond to real-time audio features (bass, mid, high frequencies, spectral analysis, etc.).

## Build & Development

### Setup
```bash
npm install
npm run dev
```
Opens on `http://localhost:5173/` with hot-module reloading via Vite.

### Production Build
```bash
npm run build
```
Creates optimized `dist/` folder for deployment. See DEPLOYMENT.md for options (Netlify, Vercel, GitHub Pages, Cloudflare).

### Preview Production Build
```bash
npm run preview
```

### Testing
Uses Playwright for end-to-end testing. Tests run against the development server.

```bash
# Run all tests
npm run test

# Run tests in UI mode (interactive, visual debugging)
npm run test:ui

# Run tests in debug mode with step-through capability
npm run test:debug

# Run specific test file
npx playwright test tests/app.spec.js

# Run tests on a specific browser
npx playwright test --project=chromium
```

Tests are located in `tests/` and verify canvas rendering, control functionality, and responsive behavior. First run downloads browsers automatically.

## Project Architecture

### Core Application Structure
- **Entry Point:** `index.html` + `sketch.js` (main audio-reactive app with ribbon visualization)
- **Multi-sketch Framework:** `/genart-sketches/` contains a modular system with 20+ visualization sketches
  - **main.js** - Loads all sketches, manages Tone.js audio player, handles UI controls
  - **sketches/** - Individual sketch classes (Lorenz, Rossler, Particles, Waveform, etc.)
  - **colorPalette.js** - Reusable color system, Camera class for smooth transformations
  - **aestheticSystem-v3.js** - V3 sketches use TempoAnalyzer, AestheticState, and OrbitingCamera

### Sketch Class Pattern
All sketches follow a consistent interface:
```javascript
export class SketchName {
  constructor(canvas, ctx) { }    // Init with canvas and 2D context
  reset() { }                      // Reset internal state
  draw(audioFeatures) { }          // Called each frame with audio data
}
```

**Audio Features Object** (passed to `draw()`):
```javascript
{
  bass: 0-1,                   // 60-250Hz band
  mid: 0-1,                    // 500-2000Hz band  
  high: 0-1,                   // 4000-6000Hz band
  spectralCentroid: 0-1,       // Brightness of sound
  spectralRolloff: 0-1,        // Frequency carrying 85% of energy
  rms: 0-1,                    // Overall energy level
  zcr: 0-1,                    // Zero crossing rate
  mfcc: Float32Array(13),      // Mel-frequency cepstral coefficients
  chroma: Float32Array(12),    // Pitch class distribution
  amplitudeSpectrum: Array(512) // Raw FFT magnitude spectrum
}
```

### Two Design Generations
- **V1/V2:** Original sketches (lorenz.js, particles.js, etc.) use basic Camera + FallColors
- **V3:** Advanced sketches (lorenz-v3.js, particles-v3.js, etc.) use TempoAnalyzer, AestheticState, and OrbitingCamera for more sophisticated audio interpretation and visual transitions

### Canvas Rendering
- All sketches use 2D Canvas context, **not p5.js** (except in isolated project directories)
- Device pixel ratio is factored into dimensions: `canvas.width / (window.devicePixelRatio || 1)`
- Most sketches use HSL color mode (hue, saturation, lightness) for smooth color transitions

### Color System
- **Fall Palette:** 8 HSL colors ranging from yellow to burgundy; used for all sketches
- Located in `colorPalette.js`; referenced via import: `import { FallColors, Camera } from './colorPalette.js'`
- HSL values in colorPalette.js are often in form `{ h: hue, s: sat, l: light }`

### Audio Analysis
- **Tone.js (v15.1.22):** Web Audio framework, audio playback, and feature analysis
- **Meyda (v5.6.3):** Advanced audio feature extraction (MFCC, chroma, spectral analysis)
- Audio analysis happens in `genart-sketches/main.js` `updateAudioFeatures()` function
- **Note:** audioAnalysis-v2.js is a reference module with pitch detection and octave mapping; not actively used in the main app

## Key Conventions

### File Organization
- **Active project:** `/genart-sketches/` - This is the deployed, feature-complete system
- **Legacy/exploratory sketches:** Standalone directories at root level (lorenz-attractor/, particles-field/, etc.) - These are older or experimental versions; refer to genart-sketches for canonical implementations
- **Library code:** p5.brush.js and similar in project folders are brushes/rendering utilities; not dependencies

### Control Flow (genart-sketches/main.js)
1. User loads audio file or hits play
2. `updateAudioFeatures()` analyzes current playback frame using Tone.js analyzer + Meyda
3. `currentSketch.draw(audioFeatures)` is called each animation frame
4. Sketch renders directly to canvas context with computed visuals

### Development Patterns
- **No external DOM manipulation in sketches** - Sketches only draw to canvas
- **Reuse Camera and FallColors** from colorPalette.js rather than creating custom systems
- **V3 sketches** are the preferred pattern for new work; they handle tempo detection and aesthetic state smoothly
- **Pre-allocate arrays** in sketch constructors to avoid garbage collection stutter (see: ribbon points array in sketch.js)
- **Frame rate monitoring:** sketches often log FPS every 60 frames during development (remove for production)

### Responsive Canvas
- All sketches respond to window resize via `p.windowResized()` or equivalent
- Canvas stretches to fill container; sketches scale/recompute internally

### Performance Notes
- **Target:** Smooth 60fps animation
- **Optimization:** Only recompute audio features when audio is playing; cache intermediate calculations
- **GC pressure:** Avoid creating objects in draw loops; pre-allocate or pool arrays/objects
- Production build is ~249KB gzipped

## Common Tasks

### Adding a New Sketch
1. Create `genart-sketches/sketches/my-sketch.js` with the standard class pattern
2. Import in `genart-sketches/main.js`
3. Add to sketch registry/dropdown (in main.js around line 150+)
4. Use `import { FallColors, Camera } from '../colorPalette.js'` for colors/camera
5. Call `this.canvas.width / (window.devicePixelRatio || 1)` for correct dimensions

### Modifying Audio Responsiveness
- Edit the audio feature mappings in your sketch's `draw(audioFeatures)` method
- Multiply audioFeatures values by tuning constants (e.g., `bass * 2`, `high * 0.5`)
- Test with varied audio: low-frequency drums, high-frequency vocals, complex passages

### Debugging Sketches
- Use `console.log()` to inspect audioFeatures each frame (watch for NaN or stuck values)
- Toggle sketch visibility in dropdown; check for errors in browser DevTools console
- Verify canvas is initializing at correct dimensions with `console.log(this.canvas.width, this.canvas.height)`
- Use `drawingContext` or directly check `ctx` to ensure rendering pipeline is working

## Dependencies
- **vite@7.1.12** - Build tool and dev server
- **p5@2.0.5** - Graphics library (used in some isolated projects, not in main genart-sketches)
- **tone@15.1.22** - Web Audio framework and audio playback
- **meyda@5.6.3** - Audio feature extraction
- **@playwright/test@1.58.2** - (dev) E2E testing framework for validating UI interactions and canvas rendering

## Browser Support
Requires modern Web Audio API support:
- Chrome/Edge 89+
- Firefox 88+
- Safari 14.1+

## Important Notes
- The `.claude/` directory contains previous Claude session settings; safe to ignore or update as needed
- Multiple project directories at root level (lorenz-attractor/, particles-field/, etc.) represent work-in-progress or exploratory versions—refer to genart-sketches/ for the canonical, working system
- Fullscreen mode hides controls automatically for clean recording/presentation
- Pre-load audio file path is configurable in main.js (`PRELOAD_AUDIO` constant)
