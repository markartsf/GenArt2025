# GenArt2025 - Audio-Responsive Generative Art 🍂

An interactive audio-responsive generative art project featuring multiple visualization sketches that react to audio features in real-time. Immerse yourself in a dramatic fall experience with warm, organic colors and flowing camera movements.

## Features

- **Fall Color Palette** - Rich burgundy, cadmium orange, naphthol red, browns, and golden yellows
- **Dynamic Camera Movement** - Audio-driven pan, zoom, and rotation for dramatic effect
- **Thick, Expressive Lines** - Bold strokes that pulse and glow with the music
- **Real-time Audio Analysis** - Powered by Tone.js for comprehensive audio feature extraction
- **Multiple Generative Sketches**:
  - **Lorenz Attractor** - Chaotic system with thick lines responding to bass, mid, and high frequencies
  - **Particle Field** - Dynamic particle system with glowing connections and flow fields
  - **Rössler Attractor** - 3D chaotic attractor with dramatic multi-axis rotation
  - **Audio Waveform** - Three creative visualization modes (circular, linear, radial spectrum)

## Audio Features

All sketches respond to various audio features:
- **Bass, Mid, High Frequencies** - Extracted from amplitude spectrum
- **Spectral Centroid** - Brightness of the sound
- **Spectral Rolloff** - Frequency below which most energy is contained
- **RMS** - Root mean square energy
- **Zero Crossing Rate** - Rate of sign changes in the signal
- **MFCC** - Mel-frequency cepstral coefficients
- **Chroma** - Pitch class distribution

## Installation

```bash
npm install
```

## Running the Project

```bash
npm run dev
```

Open your browser to http://localhost:5173/

## Usage

1. **Upload Audio File** - Click the file input to select an audio file (mp3, wav, etc.)
2. **Select Sketch** - Choose from the dropdown menu:
   - Lorenz Attractor
   - Particle Field
   - Rössler Attractor
   - Audio Waveform
3. **Control Playback** - Use Play/Pause and Stop buttons to control audio playback
4. **Watch the Magic** - Each sketch responds dynamically to the audio features

## Sketch Details

### Lorenz Attractor
- **Visual Style:** Thick, flowing lines (3-11px) in fall colors
- **Camera:** Dynamic pan, zoom, and rotation responding to audio
- **Audio Response:**
  - Parameters (sigma, rho, beta) modulated by bass, mid, and high frequencies
  - Rotation influenced by spectral centroid
  - Scale dramatically responds to RMS energy
  - Dramatic glow effects on high frequencies and bass hits
- **Colors:** Cycles through fall palette based on Z-position

### Particle Field
- **Visual Style:** Large glowing particles (5-30px) with thick connecting lines
- **Camera:** Audio-driven movement with bass-responsive zoom
- **Audio Response:**
  - Particle size pulses with bass (up to 30px)
  - Velocity influenced by mid frequencies
  - Connection lines appear and thicken with bass
  - Flow field driven by noise and audio features
  - Particle count scales with audio intensity
- **Colors:** Fall palette with dramatic glow effects

### Rössler Attractor
- **Visual Style:** Bold 3D trails (3-13px) with perspective
- **Camera:** Multi-axis rotation with audio-driven depth
- **Audio Response:**
  - 3D rotation on X, Y, Z axes based on spectral features
  - Parameters respond dramatically to bass, mid, and high frequencies
  - Scale pulses intensely with RMS and bass
  - Intense glow effects during high frequency peaks
- **Colors:** Fall palette influenced by MFCC coefficients and depth

### Audio Waveform
- **Visual Style:** Multiple thick layers with mirror reflections
- **Camera:** Dynamic movement synchronized to audio
- **Three Visualization Modes:**
  - **Circular Mode** - Concentric waveform rings (3-11px lines) with history trails
  - **Linear Mode** - 4-layer waveform with thick lines (4-12px) and reflection
  - **Radial Spectrum Mode** - 200 frequency bars (4-10px) radiating from pulsing center
- **Audio Response:**
  - Bass creates dramatic amplitude changes
  - High frequencies trigger intense glow effects
  - Center circle pulses 30-110px with bass
- **Colors:** Full fall palette cycling through frequency spectrum

## Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` folder.

## Preview Production Build

```bash
npm run preview
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions on deploying to:
- **Netlify** (recommended - drag & drop the `dist` folder)
- **Vercel** (automatic deployment from GitHub)
- **GitHub Pages** (free hosting)
- **Cloudflare Pages** (fast global CDN)

The production build is optimized and ready to deploy to any static hosting service!

## Technical Details

### Color Palette
The fall color system uses HSL values for dynamic audio modulation:
- Neutral Yellow (H: 50°, S: 45%, L: 65%)
- Cadmium Yellow (H: 48°, S: 95%, L: 55%)
- Naphthol Red (H: 355°, S: 85%, L: 45%)
- Cadmium Orange (H: 25°, S: 90%, L: 55%)
- Neutral Orange (H: 30°, S: 60%, L: 55%)
- Brown (H: 25°, S: 45%, L: 35%)
- Burgundy (H: 345°, S: 65%, L: 30%)

### Camera System
Audio-reactive camera with smooth interpolation:
- Bass drives zoom pulsing (1.0 - 1.3x)
- Mid frequencies create gentle panning
- Spectral centroid controls rotation
- High frequencies add dynamic jitter
- 5% smoothing for fluid movement

### Performance
- Canvas rendering with device pixel ratio support
- Optimized particle systems with lifecycle management
- Efficient audio analysis (512-1024 samples)
- Smooth 60fps animation loop
- Production build: ~249KB gzipped

## Dependencies

- **Vite** - Build tool and dev server
- **Tone.js** - Web Audio framework for audio playback and analysis

## Browser Compatibility

Requires a modern browser with Web Audio API support:
- Chrome/Edge 89+
- Firefox 88+
- Safari 14.1+

## License

ISC
