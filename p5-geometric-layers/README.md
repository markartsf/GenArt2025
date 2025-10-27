# P5.js Geometric Layers - Audio Reactive

Audio-responsive generative art with layered gradients and geometric cutouts.

## How to Run

1. **Simple local server:**
   ```bash
   cd p5-geometric-layers
   python3 -m http.server 8000
   ```

2. **Open in browser:**
   ```
   http://localhost:8000
   ```

3. **Load audio and play!**

## Audio-Reactive Features

### 🎵 **Bass (Low Frequencies)**
- **Number of layers**: 3-7 layers based on bass intensity
- **Shape scale**: Geometric cutouts grow larger with bass
- More bass = more layers = denser composition

### 🎶 **Mid (Mid Frequencies)**
- **Gradient steps**: 3-10 color transitions based on mid energy
- **Shape rotation**: Geometric shapes rotate up to 90° with mid frequencies
- More mid = more gradient bands = richer color transitions

### 🎼 **High (High Frequencies)**
- **Angle changes**: Gradient angle shifts when high frequencies spike
- **Palette shuffling**: Colors reshuffle when high > 0.3
- **Shape selection**: Spectral data determines which shapes appear in grid
- More high = more dynamic color and shape changes

### 📊 **RMS (Overall Energy)**
- **Grid density**: 2-10 cells based on overall energy level
- **Shadow blur**: Dramatic shadows pulse with energy (0.5x to 2x)
- More energy = denser grid = more geometric complexity

## Features

- ✅ Fall color palette (13 rich autumn colors)
- ✅ Layered gradients with BURN blend mode
- ✅ Geometric cutouts (arcs, triangles, squares)
- ✅ Starfield texture overlay with ADD blend
- ✅ Smooth angle transitions
- ✅ Audio-reactive layer count, grid density, shape scale
- ✅ Regenerate button for new variations
- ✅ Deep English red background theme

## Why This Design?

The original code created beautiful static compositions. This audio-reactive version:
- **Animates smoothly** instead of regenerating randomly
- **Maps audio meaningfully** - bass adds layers, mid adds gradients, high changes angles
- **Maintains aesthetic** - still uses burn/add blending for that rich, layered look
- **Uses fall palette** - matches the GenArt2025 autumn aesthetic

## Controls

- **Play/Pause**: Start/stop audio playback and animation
- **Stop**: Stop and reset to initial state
- **Regenerate**: New starfield pattern and angle jump
