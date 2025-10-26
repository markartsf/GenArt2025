# Quick Video Recording Guide

## ✅ Yes, OBS Captures Both Video AND Audio!

OBS Studio records **both your visuals and the audio playing** from your composition. The audio is synchronized perfectly with the video.

---

## Option 1: OBS Studio (Recommended - Free & Easy)

### Download & Install
1. Download OBS Studio: https://obsproject.com/
2. Install and open OBS Studio

### Setup (One-Time)

1. **Add Browser Source:**
   - Click "+" under Sources
   - Select "Browser"
   - Name it "GenArt2025"
   - URL: `http://localhost:5173`
   - Width: 1920, Height: 1080
   - Click OK

2. **Configure Audio:**
   - Go to Settings → Audio
   - Desktop Audio Device: Set to your system audio
   - Click OK

3. **Set Recording Quality:**
   - Go to Settings → Output
   - Recording Quality: "High Quality, Medium File Size"
   - Recording Format: MP4
   - Click OK

4. **Set Resolution:**
   - Go to Settings → Video
   - Base Resolution: 1920x1080
   - Output Resolution: 1920x1080
   - FPS: 60 (or 30 for smaller files)
   - Click OK

### Recording Your Visuals

1. **Start your dev server:**
   ```bash
   cd /Users/markgould/Documents/GenArt2025
   npm run dev
   ```

2. **In OBS Studio:**
   - Make sure your "GenArt2025" browser source is visible
   - You should see your visualization in the OBS preview

3. **Load your composition:**
   - In the browser source preview, you should be able to interact with the page
   - Select "V3 - Ethereal Transitions"
   - Choose your sketch (Lorenz, Rössler, Particles, or Waveform)
   - Upload your audio file

4. **Start Recording:**
   - Click "Start Recording" in OBS (bottom right)
   - Click "Play" in your visualization
   - Let it run through your composition

5. **Stop Recording:**
   - Click "Stop Recording" in OBS
   - Videos save to: `~/Videos/` (on Mac) or `C:\Users\[YourName]\Videos\` (on Windows)

### Tips for Best Results

- **Full Screen the Browser Source:** Right-click the browser source in OBS and select "Fullscreen Projector (Source)" for a cleaner capture
- **Hide UI Elements:** You can add custom CSS in the browser source properties to hide controls:
  ```css
  #controls { display: none !important; }
  ```
- **Multiple Takes:** OBS auto-numbers your recordings, so you can do multiple takes

---

## Option 2: macOS Native (QuickTime - Simple)

### For macOS Users

1. **Open QuickTime Player**
2. File → New Screen Recording
3. Click the down arrow next to record button
4. Select your audio input (make sure it's set to capture system audio)
5. Click red record button
6. Select your browser window with the visualization
7. Click "Start Recording"
8. Play your composition
9. Stop recording: Click stop button in menu bar

**Note:** QuickTime doesn't capture system audio by default. You'll need a tool like BlackHole or Loopback to route audio.

---

## Option 3: Automated with Puppeteer (Advanced)

For fully automated recording with synchronized audio:

### Install Puppeteer
```bash
cd /Users/markgould/Documents/GenArt2025
npm install --save-dev puppeteer puppeteer-screen-recorder
```

### Create Recording Script

Create `record-video.js`:

```javascript
import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';

async function recordVisualization(audioFile, sketch = 'lorenz', duration = 180000) {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const recorder = new PuppeteerScreenRecorder(page, {
    followNewTab: false,
    fps: 60,
    videoFrame: {
      width: 1920,
      height: 1080,
    },
    aspectRatio: '16:9',
  });

  // Navigate to your app
  await page.goto('http://localhost:5173');

  // Wait for app to load
  await page.waitForSelector('#versionSelect');

  // Select V3
  await page.select('#versionSelect', 'v3');

  // Select sketch
  await page.select('#sketchSelect', sketch);

  // Upload audio file
  const fileInput = await page.$('#audioFile');
  await fileInput.uploadFile(audioFile);

  // Wait for audio to load
  await page.waitForFunction(() => {
    const playBtn = document.getElementById('playPause');
    return !playBtn.disabled;
  });

  // Start recording
  await recorder.start(`./recordings/${sketch}-${Date.now()}.mp4`);

  // Start playback
  await page.click('#playPause');

  // Record for specified duration
  await new Promise(resolve => setTimeout(resolve, duration));

  // Stop recording
  await recorder.stop();
  await browser.close();

  console.log('Recording complete!');
}

// Usage
const audioPath = '/path/to/your/composition.mp3';
recordVisualization(audioPath, 'lorenz', 180000); // 3 minutes
```

### Run the Script
```bash
# Make sure dev server is running in another terminal
npm run dev

# In another terminal, run the recording script
node record-video.js
```

---

## Recommended Workflow

### For Quick Testing:
Use **OBS Studio** with manual controls. It's visual, easy to use, and gives you full control.

### For Final Videos:
1. Use **OBS Studio** with these settings:
   - Recording Quality: "Indistinguishable Quality, Large File Size"
   - Format: MP4
   - FPS: 60
   - Resolution: 1920x1080

2. **Hide the controls** using custom CSS in the browser source

3. **Record multiple takes** of different sketches

4. **Edit in post** if needed (iMovie, DaVinci Resolve, etc.)

---

## Quick Reference - OBS Hotkeys

Set these in OBS Settings → Hotkeys:

- Start Recording: `Cmd+R` (Mac) or `Ctrl+R` (Windows)
- Stop Recording: `Cmd+R` (Mac) or `Ctrl+R` (Windows)
- Start/Stop Recording: (same key toggles)

---

## Export Formats for Different Platforms

After recording, you may want to export for specific platforms:

### YouTube
- Resolution: 1920x1080
- Frame Rate: 60fps
- Format: MP4 (H.264)
- Bitrate: 8-12 Mbps

### Instagram
- Resolution: 1080x1080 (square) or 1080x1920 (story)
- Frame Rate: 30fps
- Format: MP4
- Duration: Up to 60 seconds (feed), 15 seconds (story)

### Twitter/X
- Resolution: 1920x1080
- Frame Rate: 30-60fps
- Format: MP4
- Duration: Up to 2:20

You can use **HandBrake** (free) or **FFmpeg** to convert formats after recording with OBS.
