# V2 Features: Pitch-Responsive & Enhanced

## What's New in V2

### 1. Pitch Detection & Note Mapping
- **Real-time pitch detection** from audio spectrum
- Each musical note (C, C#, D, E, F, F#, G, G#, A, A#, B) maps to specific colors
- Example: C notes → Burgundy, E notes → Cadmium Orange, A notes → Yellow

### 2. Octave-Based Visual Behaviors
Different frequency ranges create different visual qualities:

| Octave Range | Frequency | Color | Behavior |
|--------------|-----------|-------|----------|
| Sub-Bass | 20-60 Hz | Burgundy | Slow, large, long trails |
| Bass | 60-250 Hz | Brown | Medium speed, thick lines |
| Low-Mid | 250-500 Hz | Neutral Orange | Balanced |
| Mid | 500-2000 Hz | Cadmium Orange | Standard response |
| High-Mid | 2000-4000 Hz | Naphthol Red | Quick, energetic |
| Presence | 4000-6000 Hz | Cadmium Yellow | Fast, smaller |
| Brilliance | 6000+ Hz | Neutral Yellow | Very fast, delicate |

### 3. Melodic Contour Detection
- **Ascending melodies** → Rotation speeds up, colors brighten
- **Descending melodies** → Rotation reverses, colors deepen
- **Stable pitch** → Smooth, consistent movement

### 4. Musical Dynamics Mapping
Maps volume levels to visual intensity:
- **pp (pianissimo)** → Thin lines, subtle
- **p (piano)** → Light touch
- **mp (mezzo-piano)** → Growing presence
- **mf (mezzo-forte)** → Full visibility
- **f (forte)** → Bold, dramatic
- **ff (fortissimo)** → Maximum impact, glowing, thick lines

### 5. Onset/Attack Detection
- **Drum hits, piano strikes, guitar plucks** → Instant visual burst
- Lines suddenly thicken
- Glow intensifies
- Particle explosions

### 6. Bolder Graphics
- **Line thickness:** 5-20px (vs 4-16px in V1)
- **More particles:** 400 max (vs 300 in V1)
- **Slower fades:** Longer trails (0.02 vs 0.03)
- **More points:** 8000 in attractors (vs 5000-7000)
- **Stronger glows:** Up to 70px blur radius

## How It Works

### Lorenz V2
```javascript
// Notes control colors
C, F, B → Burgundy/Brown (warm darks)
D, G, C# → Oranges (mid-tones)
E, A, F# → Yellows (bright highs)

// Octave controls intensity
Bass notes → Slower rotation, thicker lines
High notes → Faster rotation, brighter colors

// Melody controls motion
Ascending → Speeds up, brightens
Descending → Slows down, darkens
```

### Particles V2
```javascript
// Each octave spawns different particle types
Sub-bass → Large, slow, burgundy particles
Mid-range → Medium, cadmium orange
High frequencies → Small, fast, yellow particles

// Particles in same octave connect
Bass particles link with thick brown lines
Treble particles link with delicate yellow lines

// Energy in octave = particle count
More bass → More burgundy particles
More highs → More yellow particles
```

### Rössler V2 (To Be Implemented)
```javascript
// Pitch controls 3D rotation axes
Low notes → X-axis rotation
Mid notes → Y-axis rotation
High notes → Z-axis rotation

// Harmonic content affects trail colors
Rich harmonics → Multiple colors interwoven
Sparse harmonics → Single color dominance
```

### Waveform V2 (To Be Implemented)
```javascript
// Circular mode: Note-based ring colors
Each ring colored by dominant pitch at that moment

// Linear mode: Pitch-based layer colors
4 layers, each responding to different octave

// Radial mode: Frequency-to-position mapping
Low frequencies → Inner radius (burgundy)
High frequencies → Outer radius (yellow)
```

## Musical Examples & Expected Results

### Classical Piano (Chopin, Debussy)
- **Behavior:** Elegant melodic contours, clear note-to-color mapping
- **Visuals:** Flowing colors follow melody, dynamics create thickness variations
- **Best Sketch:** Lorenz V2 - shows pitch progression beautifully

### Electronic/Bass Music (Dubstep, Drum & Bass)
- **Behavior:** Heavy sub-bass triggers burgundy explosions, high synths create yellow sparks
- **Visuals:** Massive thick burgundy lines, particle bursts on drops
- **Best Sketch:** Particles V2 - octave separation very visible

### Jazz (Miles Davis, Coltrane)
- **Behavior:** Complex mid-range harmonics, rapid pitch changes
- **Visuals:** Rich orange/red palette, organic flowing motion
- **Best Sketch:** Rössler V2 - 3D depth matches harmonic complexity

### Orchestral (Film Scores, Symphonies)
- **Behavior:** Full frequency spectrum active, dramatic dynamics
- **Visuals:** All colors simultaneously, huge range from pp to ff
- **Best Sketch:** Waveform V2 - shows full spectrum beautifully

## Technical Improvements

### Pitch Detection Algorithm
```
1. FFT analysis → Find peak frequency
2. Convert frequency to note (A4 = 440Hz)
3. Calculate MIDI note number
4. Detect cents (fine-tuning)
5. Map to color index
```

### Octave Band Analysis
```
1. Split spectrum into 7 octave ranges
2. Calculate energy in each band
3. Assign color index per range
4. Use for visual behavior selection
```

### Melodic Contour
```
1. Store last 20 pitch detections
2. Compare current vs previous
3. Calculate interval (semitones)
4. Determine direction (ascending/descending/stable)
5. Modify rotation/motion accordingly
```

## Performance Considerations

V2 does more computation:
- Pitch detection: ~1-2ms per frame
- Octave analysis: ~0.5ms per frame
- Melodic analysis: ~0.1ms per frame
- **Total overhead: ~2-3ms** (still 60fps capable)

## Future V3 Ideas

1. **Chord Detection:** Major vs Minor affects color temperature
2. **Rhythm Detection:** Visual patterns sync to beat
3. **Key Detection:** Entire palette shifts based on musical key
4. **Timbre Analysis:** Instrument type affects particle shape
5. **Stereo Field:** Left/right channel create spatial depth
6. **MIDI Input:** Direct control from keyboards/controllers

## Switching Between V1 and V2

We've created two parallel versions:
- **V1:** Simple, direct, reliable (keeps your original version safe)
- **V2:** Experimental, pitch-aware, more interactive

You can:
- Switch in real-time via dropdown
- Compare side-by-side
- Use V1 for stable recordings
- Use V2 for experimental sessions

## Recording Tips for V2

**To showcase pitch features:**
1. Use melodic music (piano, vocals, saxophone)
2. Choose pieces with clear pitch changes
3. Test with different octaves (bass vs soprano)

**To showcase octave features:**
1. Use full-spectrum music (orchestral, electronic)
2. Show how bass vs treble creates different particles
3. Try a capella vs full band

**To showcase dynamics:**
1. Use classical music with pp to ff range
2. Show visual response from quiet to loud
3. Capture crescendos and decrescendos
