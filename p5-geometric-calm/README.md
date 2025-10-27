# P5.js Geometric Layers - Calm Audio Reactive

A meditative, subtle audio-reactive version based on the original OpenProcessing sketch.

## Philosophy

This version prioritizes **calm, contemplative visuals** over aggressive reactivity. Changes happen slowly over 10-30 seconds, creating a breathing, meditative experience rather than frantic dancing.

## Key Features

### Visual Approach
- **Static composition with subtle breathing** - layers stay consistent
- **Chromotome color palettes** - beautiful, curated color schemes
- **Geometric cutouts** - arcs, triangles, squares scale by layer depth
- **Burn blend mode** - rich, layered color mixing
- **Starfield overlay** - subtle texture

### Audio Reactivity (VERY Subtle)

**Bass (Very Slow - ~10 seconds)**
- Affects global scale breathing (0.95 to 1.05)
- Smooth interpolation: 0.005 per frame

**Mids (Very Slow - ~30 seconds)**
- Gradually shifts gradient angle (±30 degrees)
- Smooth interpolation: 0.001 per frame

**Highs (Subtle)**
- Adjusts shadow blur intensity (0.8 to 1.2)
- Smooth interpolation: 0.005 per frame

**Regeneration (Very Rare)**
- Only on strong RMS peaks (>0.7)
- Min 10 seconds between regenerations
- 0.1% chance per frame when conditions met
- Creates new composition with new colors/patterns

## Performance

### Optimizations
✅ Graphics buffers created ONCE at generation (not every frame)
✅ All layers pre-rendered
✅ Smooth 60 FPS even with 6 layers
✅ Proper cleanup on regeneration
✅ Memory stable over 3+ minutes

### Memory Budget
- 6 layers max
- Each layer: 800×800×4 bytes = 2.56 MB
- Total: ~15 MB for all graphics buffers
- No memory leaks

## Differences from Original OpenProcessing Sketch

| Feature | Original | This Version |
|---------|----------|--------------|
| **Execution** | Static (noLoop) | Animated loop |
| **Audio** | None | Very subtle |
| **Performance** | Creates buffers in draw() | Pre-creates buffers once |
| **Regeneration** | Click only | Click + rare auto |
| **Speed** | Instant | Slow, breathing |

## Usage

1. Open `http://localhost:5173/p5-geometric-calm/`
2. Load an audio file
3. Press Play
4. Watch subtle breathing and slow color shifts
5. Click "Regenerate" for new composition

## Aesthetic Goal

**"A calm geometric meditation that breathes with your music"**

Not: Dancing, reactive, flashy
Yes: Calm, subtle, contemplative, meditative

Changes should be almost imperceptible moment-to-moment, only noticeable over 20-30 seconds.
