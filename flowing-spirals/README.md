# Flowing Spirals - Waves of Concentric Curves

Waves of concentric Archimedean spirals with dramatic audio response. Multiple spiral arms emanate from each center, some completing full rotations, others reversing direction mid-flow.

## Mathematical Approach

### Archimedean Spirals
Uses the Archimedean spiral equation: **r = a + b·θ**

In Cartesian coordinates:
- x = (a + b·θ) · cos(θ)
- y = (a + b·θ) · sin(θ)

### Bezier Curve Rendering
- Spirals are divided into segments
- Each segment rendered as cubic bezier curve
- Control points calculated using spiral tangent vectors
- Tangent vectors derived from parametric derivatives:
  - dx/dθ = b·cos(θ) - (a + b·θ)·sin(θ)
  - dy/dθ = b·sin(θ) + (a + b·θ)·cos(θ)

### What Makes This Different
✅ **True continuous curves** - Uses `bezierCurveTo()` with mathematically calculated control points
✅ **No line segments** - Pure bezier approximation of spiral curves
✅ **Trigonometric motion** - All positions calculated with sine/cosine
✅ **HSL color space** - Smooth hue transitions
✅ **Pure audio-reactive** - Completely frozen without audio

## Audio Mapping (AMPLIFIED Response)

- **Mid + High**: Spiral growth speed - 2-3x more responsive than before
- **Bass**: Dramatic stroke width pulsing (3x multiplier) + rapid hue shifts
- **RMS + High**: Intense glow (up to 60px blur)
- **Mid + High**: Opacity pulsing for breathing effect
- **Bass + High**: Head size pulsing (3-7x base size)

## Visual Features

- **3 spiral centers**, each with **4 concentric arms** = waves of spirals
- **Larger scale**: 2-3x bigger spirals filling more screen space
- **Mixed behaviors**:
  - 40% complete spirals (full rotations, loop continuously)
  - 30% reversing spirals (curve back on themselves)
  - 30% short curves (change direction frequently)
- Smooth bezier curve rendering (no polygonal artifacts)
- Fall color palette with dramatic HSL hue shifting
- Pulsing glowing heads at spiral endpoints
- Longer trails (slower fade)

## Controls

- **R key**: Reset and regenerate spirals
- **Fullscreen button**: Toggle fullscreen for recording
- Load audio to see pure reactive motion

## Technical Details

- Canvas 2D rendering
- Tone.js for audio analysis
- Parametric curve mathematics
- Cubic bezier curve segments
- Tangent-based control point calculation

## How to Run

From GenArt2025 directory:
```
npm run dev
```

Then open: `http://localhost:5173/flowing-spirals/`
