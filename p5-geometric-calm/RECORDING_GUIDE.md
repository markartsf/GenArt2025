# Recording Guide - P5.js Geometric Calm

## All Recording Features Implemented! 🎥

### Quick Setup for Recording

1. **Load your audio file**
2. **Check "16:9 Aspect Ratio"** - Sets canvas to 1920×1080 (perfect for video)
3. **Check "Auto-regenerate every 15s"** - Compositions change automatically
4. **Press Play**
5. **Click Fullscreen button** ⛶
6. **Start your screen recorder** (QuickTime, OBS, etc.)

---

## Recording Features

### ✅ 16:9 Aspect Ratio
- **Checkbox:** "16:9 Aspect Ratio (for recording)"
- **Size:** 1920×1080 pixels (Full HD)
- **Purpose:** Standard video format for YouTube, Vimeo, etc.

### ✅ Auto-Regeneration
- **Checkbox:** "Auto-regenerate every 15s (recording mode)"
- **Timing:** New composition every 15 seconds with smooth crossfade
- **Countdown:** Shows in debug panel ("Auto-regen: 12s")
- **Purpose:** Creates variety in long recordings without manual intervention

### ✅ Fullscreen Mode
- **Button:** "⛶ Fullscreen"
- **Behavior:**
  - Hides top UI controls completely
  - Shows only the art + on-canvas button
  - Perfect clean frame for recording
- **Keyboard shortcut:** ESC to exit

### ✅ On-Canvas Regenerate Button
- **Location:** Bottom-right corner
- **Visible:** Always (including in fullscreen!)
- **Hover effect:** Darkens when you hover over it
- **Cooldown:** 2 seconds between clicks
- **Purpose:** Manually trigger new compositions while recording without leaving fullscreen

---

## Recording Workflow Options

### Option 1: Manual Control
**Best for:** Curated recordings where you want to time each transition

1. Check "16:9 Aspect Ratio"
2. Do NOT check "Auto-regenerate"
3. Press Play → Fullscreen
4. Start recording
5. Click on-canvas "Regenerate" button whenever you want a new composition

### Option 2: Auto Mode
**Best for:** Long-form recordings, ambient video loops

1. Check "16:9 Aspect Ratio"
2. Check "Auto-regenerate every 15s"
3. Press Play → Fullscreen
4. Start recording
5. Let it run - compositions change automatically
6. Can still manually click "Regenerate" if you want an early change

---

## What Animates

### Always Active:
- ✓ Individual shapes rotating (arcs, triangles, squares, circles)
- ✓ Subtle shape pulsing with bass
- ✓ Global scale breathing
- ✓ Shadow intensity responding to highs

### On Regeneration (every 15s or manual):
- ✓ New color palette (from Chromotome)
- ✓ New geometric grid layout
- ✓ New shapes and positions
- ✓ 3-second smooth crossfade transition

---

## Tips for Best Results

### Audio Selection
- ✓ Use instrumental or ambient music for calm aesthetic
- ✓ Songs with clear bass/mids/highs show more animation
- ✓ 3-5 minute songs work great (12-20 compositions at 15s each)

### Visual Quality
- ✓ 16:9 at 1920×1080 is Full HD
- ✓ Record at 60fps if possible (matches sketch framerate)
- ✓ Shapes animate smoothly, so high framerate looks best

### Screen Recording Tools
- **Mac:** QuickTime Player (built-in, easy)
- **Cross-platform:** OBS Studio (free, powerful)
- **Pro:** ScreenFlow, Camtasia

### Post-Production
- Trim start/end to remove UI setup
- Add audio track (sync to your uploaded audio file)
- Export at 1920×1080, 60fps for best quality

---

## Debug Panel (Top-Left)

Shows real-time info:
- **FPS:** Should stay at ~60
- **Layers | Shapes:** Composition complexity
- **Audio bars:** Green (bass), Blue (mid), Orange (high)
- **Scale:** Current breathing scale value
- **Crossfading:** Shows 0-100% during transitions
- **Auto-regen:** Countdown timer when enabled

---

## Troubleshooting

**Shapes appear partial/incomplete?**
- Fixed! Gradients redraw before cutouts now

**UI won't hide in fullscreen?**
- Refresh the page
- Make sure you clicked the Fullscreen button
- Browser support: Chrome, Firefox, Safari all work

**Auto-regen not working?**
- Make sure audio is playing (not paused)
- Check the countdown timer in debug panel
- Regeneration pauses during crossfades

**Button not clickable in fullscreen?**
- Make sure you're clicking the semi-transparent button in bottom-right
- Hover should make it darker
- 2-second cooldown between clicks

---

## Example Recording Session

1. Load "ambient-song.mp3" (3 minutes)
2. Check both "16:9 Aspect Ratio" and "Auto-regenerate"
3. Press Play
4. Click Fullscreen ⛶
5. Start screen recorder
6. **Result:** 3-minute video with 12 different compositions, smooth transitions every 15 seconds
7. Stop recording, add audio in post, export!

---

Perfect for creating ambient visual loops, music visualizations, or background video content! 🎨✨
