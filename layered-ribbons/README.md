# Layered Ribbons - TRUE Dual Layer System

Two separate sets of ribbons, each responding to one audio layer. Uses Tone.Meter + Compressor for enhanced audio response.

## Dual Layer System

**Layer 1: 4 Violin Ribbons** (background)
**Layer 2: 5 Pluck Ribbons** (foreground)

Each layer has distinct visual characteristics and responds exclusively to its audio frequency band:

### Layer 1: Violin Ribbons (MID-LOW 250-800Hz)

**Visual Style:**
- Wide, thick ribbons (10-28px)
- Slow flow speed (0.8x)
- Large amplitude waves (100-180px)
- Soft, gentle glow (25-55px blur)
- Moderate opacity (0.5-0.8)

**Audio Response (VIOLIN ONLY):**
- Smooth flowing sine waves
- Wave amplitude: base × (0.3 + violin × 4)
- Hue shift: ±80 degrees
- Thickness pulses with violin energy
- Slow frequency (0.02-0.03)
- Creates breathing, undulating background

### Layer 2: Pluck Ribbons (MID-HIGH 800-2000Hz)

**Visual Style:**
- Thin, sharp ribbons (3-13px)
- Fast flow speed (1.2x)
- Sharp vertical spikes (up to 400px)
- Intense glow (15-65px blur)
- High opacity (0.8-1.0)
- Brighter colors (+25% lightness on plucks)

**Audio Response (PLUCK SYNTH ONLY):**
- Sharp vertical spikes on right edge
- Spike energy: pluck^1.2 × 400px
- Fast decay (0.85 multiplier per frame)
- Hue shift: ±100 degrees
- Bright flashes on attacks
- Small base wave for continuity
- Fast frequency (0.08-0.12)

## Audio Processing

```
Player → Compressor → Filters → Meters → Destination
```

**Compressor:** -24dB threshold, 4:1 ratio, 3ms attack, 100ms release
**Filters:** Bandpass @ 800Hz (violin), Bandpass @ 1400Hz (pluck)
**Smoothing:** 0.8 on all meters

## Visual Features

- **4 violin ribbons** + **5 pluck ribbons** = 9 total
- **100 points per ribbon** with 12px spacing
- **Fall color palette** (8 colors, alternated between layers)
- **Smooth bezier curves** using quadraticCurveTo
- **Dual flow speeds** (violin slower, pluck faster)
- **Lighter fade trail** (6% opacity per frame)
- **Layered composition** for depth

## Why This Works

**Clear Visual Separation:**
- Wide, flowing background = slow violin
- Thin, spiking foreground = fast plucks
- Different flow speeds enhance tempo contrast
- Color brightness distinguishes layers

**Audio-to-Visual Mapping:**
- Violin → smooth, continuous, gentle
- Pluck → sharp, staccato, intense
- Each layer ONLY responds to its frequency band
- No mixing = clearer dual-tempo visualization

**Overlapping Creates Depth:**
- 4 violin ribbons weave behind
- 5 pluck ribbons dart in front
- Trails create flowing history
- Colors blend and interact

## Running

From GenArt2025 directory:
```
npm run dev
```

Open: `http://localhost:5173/layered-ribbons/`

Load your dual-tempo music and watch the ribbons **flow with violin** and **spike with plucks**!
