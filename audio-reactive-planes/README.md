# Audio Reactive Planes - 3D Geometry

3D rotating planes with gradient shaders that respond to dual-tempo audio. Adapted from Open Processing sketch with Tone.js Meter + Compressor integration.

## Visual System

### 216 Elements (6×6×6 Grid)
Each element is a plane with:
- Animated gradient shader (reused on reset for performance)
- 3D rotation (X, Y, Z axes)
- Dynamic size pulsing
- Fall color schemes (monochromatic, analogous, or full palette)

**Performance Optimized:**
- Elements are reused on reset (not recreated)
- Only properties are randomized, not shaders
- Fixed 6×6×6 grid for consistent performance
- Instant reset with no lag

### 3D Camera
- Orbit controls (drag to rotate view)
- Orthographic projection
- Camera positioned at (600, -600, 600) - **closer for larger view**
- Fills more screen space than original sketch

## Audio-Reactive Mappings

### Layer 1: Violin (MID-LOW 250-800Hz)

**Smooth, Continuous Response:**

**Rotation Speed:**
- Base rotation + violin × 0.02
- Smooth acceleration of all planes
- Whole motif rotates: violin × 0.01

**Size Pulsing:**
- Adds +300px per violin energy unit
- Creates gentle breathing effect
- Combines with base cosine animation

**Shader Speed:**
- baseSpeed × (1 + violin × 2)
- Gradient animations speed up with violin

### Layer 2: Pluck Synth (MID-HIGH 800-2000Hz)

**Sharp, Staccato Response:**

**Rotation Bursts:**
- Additional rotation: pluck × 0.05
- Sharp angular changes on each pluck
- Stacks with violin rotation

**Size Bursts:**
- pluck^1.5 × 600px
- Dramatic size explosions on each pluck
- Exponential response for impact

**Visibility:**
- Number of visible planes based on total energy
- Min 20% visible, max 100%
- More energy = more planes

## Audio Processing

```
Player → Compressor → Filters → Meters → Destination
```

**Compressor:**
- Threshold: -24dB
- Ratio: 4:1
- Attack: 3ms
- Release: 100ms
- Boosts quiet audio significantly

**Filters:**
- BASS: Lowpass @ 250Hz
- MID-LOW (Violin): Bandpass @ 800Hz, Q=1
- MID-HIGH (Pluck): Bandpass @ 1400Hz, Q=1
- HIGH: Highpass @ 2000Hz

**Smoothing:** 0.8 on all meters

## Visual Features

**Gradient Shaders (Randomized on Reset):**
- **Types:** Linear, Radial, Conic, Diamond, Spiral, Star, Kaleidoscope
- **Animations:** Move, Rotate, Wave, Pulse, Wave Pattern, Noise
- **Speed:** Variable based on audio (violin × 2)
- **Colors:** 3 distribution types:
  - 30% Monochromatic (single color variations)
  - 30% Analogous (neighboring palette colors)
  - 40% Full palette variety (3-6 random colors)

**Each reset creates a unique visual:**
- **Background color:** Random dark tint from palette (15% brightness)
- **Element sizes:** Large (800-2000px), Medium (400-1000px), or Small (200-600px)
- **Gradient patterns:** 7 types randomly assigned per plane
- **Animation styles:** 6 types randomly assigned per plane
- **Color combinations:** 3 distribution strategies from full palette
- **Rotation angles:** Randomized initial angles and speeds
- All 8 fall colors have equal chance to appear
- **Instant reset** - no lag or freezing

**Base Animations (SLOWED DOWN for clarity):**
- Base rotation: 0.003 rad/frame (70% slower than original)
- Cosine size pulsing (0.05 and 0.07 frequency)
- Random phase shifts per plane
- Variable amplitude pulsing (30-100px)
- Audio adds smooth violin rotation and sharp pluck bursts on top

**Audio Enhancements:**
- Violin adds smooth continuous movement
- Pluck adds sharp bursts and flashes
- Combined effect creates dual-tempo visualization
- Energy controls element visibility count

## Original Sketch

Adapted from Open Processing sketch by reona396:
- Original: Static animated 3D planes
- Enhanced: Full audio-reactivity with dual-tempo response
- Added: Tone.js Meter + Compressor system
- Modified: Rotation speeds, size pulsing, element visibility

## Controls

- **Drag**: Orbit camera around scene
- **R key**: Reset visualization
- **Fullscreen**: Hide controls, maximize view

## Running

From GenArt2025 directory:
```
npm run dev
```

Open: `http://localhost:5173/audio-reactive-planes/`

Load your dual-tempo music (e.g., circles01a.mp3) and watch:
- Planes gently rotate and pulse with violin
- Sharp bursts and spins with pluck synth
- Beautiful 3D gradient geometry dancing to music!
