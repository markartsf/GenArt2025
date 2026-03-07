# Geometric Morphing - DEBUG MODE

Audio analysis using **Tone.js Meter + Compressor** for better quiet audio response. Debug display shows real-time frequency band values.

## Audio Processing Chain

```
Player → Compressor → Filters → Meters
                  ↓
               FFT Analyzer
                  ↓
             Tone.Destination
```

**Compressor settings:**
- Threshold: -24dB
- Ratio: 4:1
- Attack: 0.003s
- Release: 0.1s
- **Purpose**: Boosts quiet tracks and makes variations more obvious

**Filters + Meters (per band):**
- BASS (60-250Hz): Lowpass @ 250Hz
- MID-LOW (250-800Hz): Bandpass @ 800Hz, Q=1
- MID-HIGH (800-2000Hz): Bandpass @ 1400Hz, Q=1
- HIGH (2000-8000Hz): Highpass @ 2000Hz
- **Smoothing**: 0.8 on all meters

**Gain/Normalization:**
- Adjustable gain slider (1x-20x, default 10x)
- Auto-normalization tracks recent max values
- Values displayed: Raw → Gained → Normalized %

## Two-Layer System

### Layer 1: Background Shapes (Violin 200-800Hz)
Large geometric shapes (circle, triangle, hexagon) that respond to sustained violin:

**Visual Parameters:**
- **Size**: Pulses from baseSize to 1.8x with violin energy
- **Rotation**: Slow rotation speed increases with violin
- **Hue**: Color shifts based on violin intensity
- **Stroke Width**: Thickens with violin (4-10px)
- **Glow**: Increases with violin energy

**Behavior:**
- Smooth interpolation (0.1 lerp factor)
- Always visible
- Centered on screen
- 3 shapes total

### Layer 2: Foreground Particles (Pluck 800-2000Hz)
Small particles that burst from center based on pluck synth energy:

**Visual Parameters:**
- **Spawn Rate**: 0-8 particles every 3 frames based on pluck energy
- **Speed**: 2-10 pixels/frame based on pluck
- **Size**: 3-13px based on pluck
- **Brightness**: Flashes brighter with pluck energy (+40% lightness)
- **Glow**: Intense blur (20-70px) based on pluck

**Behavior:**
- Radiate outward from center
- Fade out over time
- More pluck energy = more particles, faster, bigger, brighter

## Direct Continuous Mapping

No onset detection or beat triggers - everything is **directly mapped** to current audio energy:

```javascript
// Violin → Background
size = baseSize * (1 + violin * 0.8)
rotation_speed = 0.002 + violin * 0.01
hue_shift = violin * 50
stroke = 4 + violin * 6

// Pluck → Foreground
particles_per_spawn = floor(pluck * 8)
particle_speed = 2 + pluck * 8
particle_size = 3 + pluck * 10
brightness = lightness + pluck * 40
```

## Why This Works

**Violin (sustained, slow):**
- Lower frequencies (200-800Hz)
- Continuous energy
- Smooth changes
- → Perfect for smooth background pulsing/rotation

**Pluck Synth (percussive, fast):**
- Higher frequencies (800-2000Hz)
- Varying energy (peaks with plucks)
- Rapid changes
- → Perfect for particle spawn rate/intensity

**You'll see:**
- Background pulses smoothly with violin
- Particles burst rapidly with pluck intensity
- Two tempos clearly visualized
- No missed beats - continuous response

## UI Display

Real-time metrics:
- Violin energy (200-800Hz) %
- Pluck energy (800-2000Hz) %
- Active pluck particles count
- Background shapes count (always 3)

## How to Run

From GenArt2025 directory:
```
npm run dev
```

Then open: `http://localhost:5173/geometric-morphing/`

Load circles01a.mp3 (included) - you'll see BOTH tracks immediately!
