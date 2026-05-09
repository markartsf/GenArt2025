# Van Gogh Swirls Visualization

Audio-reactive visualization inspired by Van Gogh's "Starry Night" with flowing spiral patterns.

## Features

- **Spiral Motion**: Streamers orbit swirl centers while spiraling in/out
- **Drifting Swirls**: Swirl centers slowly drift and move around
- **Inter-swirl Flow**: Streamers occasionally flow between nearby swirls
- **Audio Reactive**:
  - Bass: affects drift speed and distance pulsing
  - Mid: controls spiral speed
  - High: controls rotation speed
- **Fall Color Palette**: Warm reds, oranges, yellows, and browns
- **No Straight Lines**: Pure circular/spiral motion using trigonometry

## How to Run

From the GenArt2025 directory:
```
npm run dev
```

Then open: `http://localhost:5173/van-gogh-swirls/`

## Controls

- Load audio file
- Play/Pause/Stop buttons
- **R key**: Reset/regenerate pattern (works in fullscreen)
- **Fullscreen button**: Toggle fullscreen for recording

## Files

- `index.html` - Main HTML page with controls
- `sketch.js` - StarrySwirlField class visualization
- `circles01a.mp3` - Sample ambient synth track

## Recording Tips

1. Load audio and click Play
2. Click Fullscreen button
3. Start screen recording
4. Press R to regenerate patterns during recording
5. Press ESC to exit fullscreen when done
