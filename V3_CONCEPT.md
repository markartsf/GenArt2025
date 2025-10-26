# V3: Ethereal Transitions - Country to Urban

## Your Creative Vision

"Ethereal motion moving across terrain - slowly in the country (the strings) and faster in the urban area, more vibrant, more exciting."

## Design Philosophy

**V1/V2:** Reactive pulsation → Instant response to audio
**V3:** Compositional flow → Gradual transitions over time

### Core Concepts

1. **Tempo-Driven, Not Beat-Driven**
   - Detect overall tempo (BPM)
   - Slow tempos → Country aesthetic (gentle, flowing)
   - Fast tempos → Urban aesthetic (vibrant, energetic)

2. **Smooth Transitions, Not Pulses**
   - Changes happen over 5-10 seconds
   - Interpolate between states
   - Feels like traveling through landscapes

3. **Spatial Metaphors**
   - "Terrain" = Visual space
   - "Movement" = Camera orbit + flow
   - "Country" = Sparse, organic, earth tones
   - "Urban" = Dense, geometric, bright colors

4. **Camera as Narrative**
   - Continuous orbit (revolution)
   - Speed matches tempo
   - Height varies with intensity
   - Creates sense of journey

## Technical Approach

### Tempo Detection
```javascript
// Not using onset detection (too reactive)
// Instead: Analyze tempo over time windows

analyzeTempoWindow(audioFeatures, windowSize = 4000ms) {
  // Average spectral flux over window
  // Detect periodicity
  // Return BPM estimate
  // Classify: slow (60-90), moderate (90-120), fast (120-180)
}
```

### Transition System
```javascript
// Smooth interpolation between aesthetic states

class AestheticState {
  constructor() {
    this.current = {
      speed: 0.5,      // 0 = still, 1 = fast
      density: 0.5,    // 0 = sparse, 1 = dense
      warmth: 0.7,     // 0 = cool, 1 = warm
      lineThickness: 15 // px
    };

    this.target = { ...this.current };
    this.transitionSpeed = 0.02; // Slow transitions
  }

  // Gradually move toward target
  update() {
    for (let key in this.current) {
      this.current[key] += (this.target[key] - this.current[key]) * this.transitionSpeed;
    }
  }

  // Set new target based on tempo
  setTempo(bpm) {
    if (bpm < 90) {          // Country/Strings
      this.target.speed = 0.3;
      this.target.density = 0.3;
      this.target.warmth = 0.8;
      this.target.lineThickness = 25;
    } else if (bpm < 120) {  // Moderate
      this.target.speed = 0.6;
      this.target.density = 0.6;
      this.target.warmth = 0.5;
      this.target.lineThickness = 20;
    } else {                 // Urban/Fast
      this.target.speed = 0.9;
      this.target.density = 0.9;
      this.target.warmth = 0.3;
      this.target.lineThickness = 15;
    }
  }
}
```

### Camera Revolution
```javascript
class OrbitingCamera {
  constructor() {
    this.angle = 0;
    this.radius = 50;
    this.height = 0;
    this.speed = 0.01; // Base revolution speed
  }

  update(aesthetic) {
    // Revolution speed matches aesthetic tempo
    this.speed = 0.005 + (aesthetic.speed * 0.02);

    // Orbit around center
    this.angle += this.speed;

    // Height varies with intensity
    this.height = Math.sin(this.angle * 0.5) * 20;

    // Radius breathes gently
    this.radius = 50 + Math.sin(this.angle * 0.3) * 15;
  }

  apply(ctx, width, height) {
    ctx.save();
    ctx.translate(width / 2, height / 2);

    // Orbital position
    const offsetX = Math.cos(this.angle) * this.radius;
    const offsetY = Math.sin(this.angle) * this.radius + this.height;

    ctx.translate(offsetX, offsetY);

    // Gentle rotation following orbit
    ctx.rotate(this.angle * 0.2);
  }

  restore(ctx) {
    ctx.restore();
  }
}
```

### Line Thickness System
```javascript
// Much thicker base, subtle variations

getLineThickness(aesthetic, position) {
  const base = aesthetic.lineThickness; // 10-30px range

  // Gentle variation based on position (not audio)
  const positionVariation = Math.sin(position * 0.1) * 5;

  // Very gentle audio influence (not pulsing)
  const audioInfluence = aesthetic.speed * 3;

  return base + positionVariation + audioInfluence;
}
```

## Visual Characteristics

### Country Aesthetic (Slow Tempo)
```
Speed: Slow, flowing
Line Thickness: 25-30px (thick, bold)
Colors: Warm browns, burgundy, deep oranges
Density: Sparse trails, breathing room
Camera: Slow orbit, low angle
Movement: Organic, curving paths
Feel: Ethereal, contemplative
```

### Urban Aesthetic (Fast Tempo)
```
Speed: Fast, energetic
Line Thickness: 15-20px (still thick but tighter)
Colors: Bright yellows, sharp oranges, reds
Density: Dense, overlapping trails
Camera: Fast orbit, high angle
Movement: Geometric, angular paths
Feel: Vibrant, exciting
```

### Transition (Moving Between)
```
Duration: 5-10 seconds
Method: Smooth interpolation
Camera: Gradual speed change
Colors: Blend from warm to cool
Density: Gradual spacing change
Feel: Journey, traveling through space
```

## Sketch Behaviors

### Lorenz V3
- **Base thickness:** 15-30px
- **Country mode:** Slow rotation, wide curves, warm palette
- **Urban mode:** Fast rotation, tight spirals, bright palette
- **Camera:** Continuous orbit, speed matches tempo
- **Transition:** Rotation speed gradually changes

### Rössler V3
- **Base thickness:** 12-28px
- **Country mode:** Slow 3D rotation, sparse trails
- **Urban mode:** Fast multi-axis rotation, dense trails
- **Camera:** Orbiting viewpoint, creates depth
- **Transition:** Gradual axis shift

### Particles V3
- **Base size:** 10-35px
- **Country mode:** Few large particles, slow drift
- **Urban mode:** Many small particles, fast movement
- **Camera:** Orbit creates parallax effect
- **Transition:** Particle count gradually changes

### Waveform V3
- **Base thickness:** 8-25px
- **Country mode:** Gentle waves, sparse layers
- **Urban mode:** Sharp waves, dense layers
- **Camera:** Rotating perspective
- **Transition:** Wave complexity gradually changes
```

## Implementation Strategy

### Phase 1: Core Systems
1. TempoAnalyzer class
2. AestheticState class
3. OrbitingCamera class
4. SmoothTransition utility

### Phase 2: Update Sketches
1. Lorenz V3 - thicker lines + orbit
2. Rössler V3 - thicker lines + orbit
3. Particles V3 - size range + orbit
4. Waveform V3 - thickness + orbit

### Phase 3: Fine-Tuning
1. Adjust transition speeds
2. Calibrate tempo thresholds
3. Perfect camera orbit
4. Test with your composition

## Expected Behavior

**Your Composition (Strings → Urban):**

```
0:00-1:00  Slow strings playing
           → Country aesthetic
           → Thick burgundy/brown lines (25-30px)
           → Slow camera orbit
           → Sparse, flowing trails
           → Contemplative mood

1:00-1:30  Tempo picking up
           → Gradual transition
           → Lines thinning slightly (20-25px)
           → Camera orbit speeding up
           → Trails densifying
           → Colors brightening

1:30-2:30  Urban section
           → Urban aesthetic
           → Bright yellow/orange lines (15-20px)
           → Fast camera orbit
           → Dense, energetic trails
           → Vibrant, exciting mood

2:30-3:00  Return to slow
           → Gradual transition back
           → Thickening lines again
           → Slowing orbit
           → Return to contemplation
```

## Testing Plan

1. **Test with your composition**
   - Verify country → urban transition
   - Check timing feels right
   - Adjust transition speed if needed

2. **Test with pure examples**
   - Classical strings (Barber's Adagio) → Full country
   - Electronic (Aphex Twin) → Full urban
   - Progressive (Pink Floyd) → Multiple transitions

3. **Calibrate thresholds**
   - Find right BPM boundaries
   - Adjust aesthetic parameters
   - Perfect camera speeds

## Customization Points

```javascript
// Easy to adjust in code:

// Transition speed
transitionSpeed: 0.02  // Lower = slower transitions

// Tempo thresholds
countryMax: 90    // BPM below this = country
urbanMin: 120     // BPM above this = urban

// Line thickness ranges
countryThickness: { min: 25, max: 30 }
urbanThickness: { min: 15, max: 20 }

// Camera orbit speed
countryOrbitSpeed: 0.005
urbanOrbitSpeed: 0.025

// Color warmth
countryWarmth: 0.8  // More burgundy/brown
urbanWarmth: 0.3    // More yellow/orange
```

## Why This Approach

**Vs V1/V2 (Reactive):**
- Less "video game" feel
- More "cinematic" feel
- Matches compositional intent
- Works better for longer pieces
- Creates narrative arc

**For Your Piece:**
- Respects musical structure
- Emphasizes journey/transition
- Country vs Urban metaphor clear
- Camera adds depth perception
- Thicker lines = more presence

**For Recording:**
- Smoother video (no jitter)
- Better for editing
- More "watchable" for longer
- Professional aesthetic

Ready to build this?
