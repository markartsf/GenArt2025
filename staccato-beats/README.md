# Staccato Beats - Dual Layer Audio Response

True dual-tempo visualization with beat detection for clear response to both sustained violin and fast plucking strings.

## Dual Visual System

### Layer 1: Background Waves (Slow Violin)
- Horizontal flowing waves
- Respond to **bass + mid frequencies** (sustained notes)
- Smooth, continuous motion
- Wave amplitude driven by violin intensity
- Gentle breathing aesthetic

### Layer 2: Beat Bursts (Fast Plucking)
- Explosive particle bursts
- **Spawn on each detected beat/pluck**
- 8-15 particles per beat
- Radiate outward from random positions
- Sharp, staccato response

## Beat Detection Algorithm

Uses onset detection to identify plucking beats:
1. Tracks **high frequency energy** (where plucks occur)
2. Detects **sudden energy spikes** above threshold
3. Cooldown period (100ms) prevents double-triggers
4. Beat indicator in UI shows detection in real-time

**Detection criteria:**
- Energy delta > 0.15
- Cooldown elapsed
- Current energy > 0.1

## Audio Mapping

### Background Waves (Sustained)
- **Bass**: Wave amplitude (30-130px)
- **Mid**: Additional amplitude boost
- **Bass**: Phase speed (how fast waves flow)
- **Bass**: Stroke width (2-5px)

### Beat Bursts (Staccato)
- **Beat detected**: Spawn 8-15 particles
- **High frequency**: Triggers detection
- Particle spread: Random radial pattern
- Life: 1.0 → 0 (fades out)

## Visual Feedback

**You'll clearly see:**
- 🔴 Beat indicator flashes RED on each pluck
- Particle bursts explode on every beat
- Waves flow smoothly with violin
- Dual tempo = dual visual layers

## Features

- Pure audio-reactive
- Fall color palette (8 colors)
- Particle trails
- Smooth bezier curves for waves
- Real-time beat detection display
- Fullscreen mode
- R key reset

## How to Run

From GenArt2025 directory:
```
npm run dev
```

Then open: `http://localhost:5173/staccato-beats/`

Load your dual-tempo music and **watch the beats pop**!
