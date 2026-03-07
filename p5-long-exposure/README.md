# P5.js Long Exposure Beams

Standalone p5.js visualization - smooth organic light trails.

## How to Run

1. **Simple local server:**
   ```bash
   cd p5-long-exposure
   python3 -m http.server 8000
   ```

2. **Open in browser:**
   ```
   http://localhost:8000
   ```

3. **Load audio and play!**

## Features

- ✅ Smooth organic curves using `curveVertex()`
- ✅ Very long persistent trails (up to 1000 points)
- ✅ No straight lines - mathematically guaranteed curves
- ✅ Rich color palette (no white blobs)
- ✅ Audio-reactive movement
- ✅ Deep English red background
- ✅ Standalone - no conflicts with main app

## Why Separate?

p5.js creates its own canvas and conflicts with the main Canvas 2D app. This standalone version runs independently and uses p5's full power.
