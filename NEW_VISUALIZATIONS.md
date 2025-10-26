# New Visualizations - User Guide

## 🎉 Three New Musical Visualizations Added!

All three visualizations are now live at http://localhost:5173/

---

## 🌟 Spiral Galaxy

**What it does:**
Creates a galaxy-like spiral formation where notes spiral outward from the center. Each musical octave gets its own spiral arm, creating a beautiful cosmic visualization of your composition.

**Musical Mapping:**
- **Octaves** → Separate spiral arms (8 total, one per octave)
- **Pitch** → Influences position along spiral
- **Tempo** → Rotation speed (slow country spirals → fast urban spirals)
- **Audio Energy (RMS)** → How fast spirals grow outward
- **Staccato hits** → Particle bursts across all active spirals
- **Bass** → Central core pulse size

**Aesthetic Transitions:**
- **Country/Strings (slow):**
  - Wide, gentle spirals
  - Slow rotation
  - Warm burgundy/brown colors
  - Loose spiral tightness
  - Long-lasting trails

- **Urban/Synth (fast):**
  - Tight, fast spirals
  - Rapid rotation
  - Bright yellow/orange colors
  - Dense spiral arms
  - Quick, vibrant bursts

**What to watch for:**
- How the spirals slowly rotate during the string section
- The explosion of spiral arms when the urban section hits
- The central core pulsing with bass
- Multiple octaves creating layered spiral patterns

---

## 🌳 Fractal Tree

**What it does:**
Grows a living tree structure where each note triggers branch growth. The tree starts as an organic, flowing oak during country sections and transforms into a sharp, geometric crystalline structure in urban sections.

**Musical Mapping:**
- **Notes** → Trigger new branch growth
- **Pitch** → Branch angle (high notes branch upward, low notes downward)
- **Octaves** → Branch generation/depth (octave 1 = trunk, 2 = main branches, etc.)
- **Audio Energy** → How many branches grow
- **Tempo** → Branch angle sharpness (smooth curves → sharp angles)
- **Staccato hits** → Random branching bursts
- **Bass** → Trunk thickness

**Aesthetic Transitions:**
- **Country/Strings:**
  - Oak tree aesthetic
  - Thick, flowing branches
  - Gentle curves (30-60 degree angles)
  - Brown/burgundy bark colors
  - Longer branches
  - Slower growth

- **Urban/Synth:**
  - Crystalline tree aesthetic
  - Thin, geometric branches
  - Sharp angles (60-90 degrees)
  - Bright yellow/orange colors
  - Shorter, compact branches
  - Rapid, explosive growth

**What to watch for:**
- The gradual transformation from organic curves to geometric shapes
- How higher octaves create finer branch details
- The "leaves" (growth tips) at the ends of branches
- The tree filling the screen from bottom to top

---

## 🔷 Chromatic Kaleidoscope

**What it does:**
Creates mesmerizing symmetrical patterns that reflect the harmonic structure of your music. The patterns morph and rotate, with the number of symmetry axes (mirror reflections) changing based on musical harmony and tempo.

**Musical Mapping:**
- **Harmony** → Symmetry complexity (more harmonics = more symmetry axes)
- **Pitch Class** → Color (C=first color, C#=second, etc. through chromatic scale)
- **Tempo** → Symmetry order (3-6 fold in country, 8-16 fold in urban)
- **Waveform Shape** → Pattern shapes (organic in country, geometric in urban)
- **Audio Energy** → Pattern size/radius
- **Staccato hits** → Geometric shape bursts
- **Bass** → Central mandala core size

**Aesthetic Transitions:**
- **Country/Strings:**
  - 3-6 fold symmetry (simple, like a flower)
  - Organic, flowing waveform shapes
  - Warm burgundy/brown colors
  - Gentle, slow rotation
  - Larger, softer patterns

- **Urban/Synth:**
  - 8-16 fold symmetry (complex, like a snowflake)
  - Sharp geometric shapes (triangles, polygons)
  - Bright yellow/orange colors
  - Fast rotation
  - Smaller, precise patterns
  - Multiple overlapping symmetries

**What to watch for:**
- How symmetry order increases as your composition speeds up
- The central mandala core that pulses with bass
- Color changes based on pitch (different notes = different colors)
- Patterns layering and overlapping
- Perfect symmetry during harmonic moments

---

## 🎮 How to Use

1. **Go to:** http://localhost:5173/

2. **Select a visualization** from the dropdown:
   - 🌟 Spiral Galaxy (selected by default)
   - 🌳 Fractal Tree
   - 🔷 Chromatic Kaleidoscope
   - (Plus your original 4 visualizations)

3. **Upload your audio file**

4. **Press Play** and watch the magic!

5. **Switch visualizations** while playing to see different interpretations

---

## 📹 Recording These Visualizations

All three work perfectly with OBS Studio! See `QUICK_VIDEO_RECORDING.md` for instructions.

**Recommended recording order:**
1. **Spiral Galaxy** - Most dramatic for showing tempo changes
2. **Chromatic Kaleidoscope** - Most beautiful for harmonic content
3. **Fractal Tree** - Best for showing organic → geometric transformation

Each offers a unique perspective on your composition!

---

## 🎨 Technical Details

### Pitch Detection
All three visualizations include real-time pitch detection that:
- Finds the dominant frequency in the audio spectrum
- Maps it to a musical octave (0-7)
- Determines pitch class for chromatic mapping
- Detects harmonic content

### Aesthetic System Integration
All use the V3 Aesthetic System:
- **Tempo Analysis** - Detects BPM from spectral flux
- **Smooth Transitions** - 5-10 second transitions between aesthetics
- **Tempo Acceleration** - Glows when BPM is increasing
- **Transient Detection** - Flashes on staccato synth hits
- **Color System** - Fall palette with warmth-based adjustments

### Performance
- **Spiral Galaxy:** 100-1000+ points, optimized connections
- **Fractal Tree:** Self-pruning (old branches fade), ~200-500 branches
- **Kaleidoscope:** Max 20 shapes, radial symmetry rendering

---

## 💡 Creative Tips

### For Your Composition (Country → Urban):

**Spiral Galaxy:**
- Watch the spirals start wide and slow during strings
- See them tighten and accelerate as synths enter
- Multiple octaves create stunning layered patterns

**Fractal Tree:**
- The transformation from oak to crystal is perfect for your arc
- Tree grows from bottom (strings establish foundation)
- Branches explode into geometry as urban section hits

**Kaleidoscope:**
- Simple 3-4 fold symmetry in string section
- Explodes into 12-16 fold complexity in urban section
- Harmonic moments create perfect symmetries

### Combining Multiple Videos:
Record all 7 visualizations and create a multi-screen compilation showing different aspects of the same composition simultaneously!

---

## 🐛 Troubleshooting

**If visualizations seem "stuck" or not responding:**
- Make sure audio is playing (check browser play button)
- Try a different audio file
- Refresh the page
- Check browser console for errors

**If pitch detection seems off:**
- This is normal for complex polyphonic music
- The system detects the *dominant* frequency
- Harmonic content creates beautiful patterns even if not "correct"

**If performance is slow:**
- Close other browser tabs
- Try a lower resolution in OBS if recording
- Some visualizations are more CPU intensive than others

---

## 🚀 What's Next?

You now have **7 unique visualizations** for your composition:

**Original V3 (Enhanced):**
1. Lorenz Attractor - Chaotic butterfly with thick lines
2. Particle Field - Full-screen particle swarms
3. Rössler Attractor - 3D spiral growing to fill screen
4. Audio Waveform - 3 modes (circular, linear, radial)

**New Musical Visualizations:**
5. 🌟 Spiral Galaxy - Octave-based spiral arms
6. 🌳 Fractal Tree - Growing organic → geometric tree
7. 🔷 Chromatic Kaleidoscope - Harmonic symmetry patterns

Each tells a different story about your music!

---

## 📊 Debug Info

Each visualization shows real-time debug info at the bottom:
- Current BPM
- Visualization-specific metrics (points, symmetry, octave, etc.)
- Aesthetic state (Country/Countryside/Suburban/Urban)

This helps you understand what the system is detecting and how it's responding.

Enjoy your new visualizations! 🎉
