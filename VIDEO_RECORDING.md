# Automated Video Recording for GenArt2025

## Automated Recording Solutions

### Option 1: OBS Studio (Best - Free & Powerful)

**What it can do:**
- Record specific browser window
- Set exact duration (auto-stop)
- High quality (60fps, 1080p/4K)
- Multiple audio sources
- Hotkey automation

**Setup:**
1. Download OBS Studio (free): https://obsproject.com/
2. Add Browser Source
3. Point to http://localhost:5173/
4. Set resolution (1920x1080 or 1080x1080 for Instagram)
5. Configure audio (system audio + optional mic)

**Automated Recording Script:**

Create `record.sh`:
```bash
#!/bin/bash
# Automated OBS recording via CLI

# Install obs-cli
npm install -g obs-cli

# Start OBS recording
obs-cli start-recording

# Record for 3 minutes
sleep 180

# Stop recording
obs-cli stop-recording

echo "Recording saved to OBS output folder"
```

**Even Better - Scene Collection:**
1. Create scene: "GenArt Lorenz"
2. Create scene: "GenArt Particles"
3. Create scene: "GenArt Rössler"
4. Create scene: "GenArt Waveform"
5. Hotkeys to switch (1, 2, 3, 4)
6. Macro to cycle through all

---

### Option 2: Puppeteer (Programmatic - Full Automation)

**What it can do:**
- Fully automated browser control
- Load audio file automatically
- Cycle through sketches
- Record videos programmatically
- No manual interaction needed

**Setup:**
```bash
npm install puppeteer puppeteer-screen-recorder
```

**Create `autoRecord.js`:**
```javascript
import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';

async function recordVisualization(sketchName, duration = 60000) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  const recorder = new PuppeteerScreenRecorder(page);

  // Load your app
  await page.goto('http://localhost:5173/');

  // Wait for it to load
  await page.waitForSelector('#audioFile');

  // Upload audio file (you'll need to set this path)
  const audioInput = await page.$('#audioFile');
  await audioInput.uploadFile('/path/to/your/music.mp3');

  // Select sketch
  await page.select('#sketchSelect', sketchName);

  // Click play
  await page.waitForSelector('#playPause:not([disabled])');
  await page.click('#playPause');

  // Start recording
  await recorder.start(`./recordings/${sketchName}.mp4`);

  // Record for specified duration
  await page.waitForTimeout(duration);

  // Stop recording
  await recorder.stop();

  await browser.close();
}

// Record all sketches
(async () => {
  await recordVisualization('lorenz', 60000);  // 60 seconds
  await recordVisualization('particles', 60000);
  await recordVisualization('rossler', 60000);
  await recordVisualization('waveform', 60000);
})();
```

**Run it:**
```bash
node autoRecord.js
```

---

### Option 3: QuickTime + AppleScript (Mac Only)

**Simple automation:**

Create `record-genart.scpt`:
```applescript
tell application "Google Chrome"
    activate
    open location "http://localhost:5173/"
    delay 5
end tell

tell application "QuickTime Player"
    activate
    new screen recording
    delay 2
    tell application "System Events"
        keystroke "r" using {command down}
    end tell
    delay 60
    tell application "System Events"
        keystroke "q" using {command down, control down}
    end tell
end tell
```

**Run:**
```bash
osascript record-genart.scpt
```

---

### Option 4: FFmpeg (Command Line - Advanced)

**What it can do:**
- Record browser window directly
- Set exact bitrate and quality
- Add audio mixing
- Convert formats

**Record browser window:**
```bash
# Mac (using screen capture)
ffmpeg -f avfoundation \
  -i "1:0" \
  -framerate 60 \
  -video_size 1920x1080 \
  -t 60 \
  -c:v libx264 \
  -preset ultrafast \
  -crf 18 \
  output.mp4

# Windows (using gdigrab)
ffmpeg -f gdigrab \
  -framerate 60 \
  -i desktop \
  -t 60 \
  output.mp4
```

---

## Recommended Workflow for Your Project

### Semi-Automated (Easiest)

**Setup once in OBS:**

1. **Scene Setup:**
   ```
   Scene 1: "GenArt - Lorenz V3"
   - Browser source: http://localhost:5173/
   - Audio: System audio
   - Resolution: 1920x1080

   Scene 2: "GenArt - Particles V3"
   - Same setup

   etc.
   ```

2. **Hotkeys:**
   ```
   F1 → Switch to Lorenz
   F2 → Switch to Particles
   F3 → Switch to Rössler
   F4 → Switch to Waveform
   F9 → Start recording
   F10 → Stop recording
   ```

3. **Record session:**
   ```
   1. Start dev server: npm run dev
   2. Open OBS
   3. Load audio in browser
   4. Press F9 to start recording
   5. Press F1 (Lorenz) - let it record 30 sec
   6. Press F2 (Particles) - let it record 30 sec
   7. Press F3 (Rössler) - let it record 30 sec
   8. Press F4 (Waveform) - let it record 30 sec
   9. Press F10 to stop
   10. You now have a 2-minute video showing all sketches!
   ```

---

### Fully Automated (Set and Forget)

**Use the Puppeteer script above, enhanced:**

**Create `fullAutoRecord.js`:**
```javascript
import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';

const sketches = ['lorenz', 'particles', 'rossler', 'waveform'];
const versions = ['v1', 'v2'];
const audioFile = '/path/to/your/music.mp3';

async function recordAllCombinations() {
  for (const version of versions) {
    for (const sketch of sketches) {
      await recordOne(version, sketch, 45000);  // 45 seconds each
      console.log(`✓ Recorded ${version} - ${sketch}`);
    }
  }
}

async function recordOne(version, sketch, duration) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  const recorder = new PuppeteerScreenRecorder(page, {
    fps: 60,
    videoFrame: {
      width: 1920,
      height: 1080
    }
  });

  await page.goto('http://localhost:5173/');
  await page.waitForSelector('#audioFile');

  // Upload audio
  const input = await page.$('#audioFile');
  await input.uploadFile(audioFile);

  // Select version
  await page.select('#versionSelect', version);

  // Select sketch
  await page.select('#sketchSelect', sketch);

  // Wait for audio to load
  await page.waitForSelector('#playPause:not([disabled])');

  // Start playback
  await page.click('#playPause');

  // Wait for first visual response (1 second)
  await page.waitForTimeout(1000);

  // Start recording
  await recorder.start(`./recordings/${version}-${sketch}.mp4`);

  // Record
  await page.waitForTimeout(duration);

  // Stop
  await recorder.stop();
  await browser.close();
}

recordAllCombinations();
```

**Run once:**
```bash
node fullAutoRecord.js
```

**Result:** 8 videos (4 sketches × 2 versions) recorded automatically!

---

## Recording Presets for Different Platforms

### YouTube (Best Quality)
```
Resolution: 1920x1080
Framerate: 60fps
Bitrate: 8000 kbps
Format: MP4 (H.264)
```

### Instagram Feed/Reels
```
Resolution: 1080x1080 (square)
Framerate: 30fps
Bitrate: 5000 kbps
Format: MP4
Duration: 15-90 seconds
```

### TikTok
```
Resolution: 1080x1920 (vertical)
Framerate: 30fps
Bitrate: 5000 kbps
Duration: 15-60 seconds
```

### Twitter
```
Resolution: 1280x720
Framerate: 30fps
Bitrate: 4000 kbps
Duration: Max 2:20
```

---

## OBS Settings for High Quality

**Video:**
```
Base Canvas: 1920x1080
Output: 1920x1080
FPS: 60
```

**Output:**
```
Encoder: x264 (CPU) or NVENC (GPU if available)
Rate Control: CBR
Bitrate: 8000 kbps
Preset: Quality (or high quality if using NVENC)
```

**Audio:**
```
Sample Rate: 48khz
Channels: Stereo
Bitrate: 320 kbps
```

---

## Post-Processing Scripts

**Auto-trim silence:**
```bash
ffmpeg -i input.mp4 -af silenceremove=1:0:-50dB output.mp4
```

**Add intro/outro:**
```bash
ffmpeg -i intro.mp4 -i main.mp4 -i outro.mp4 \
  -filter_complex "[0:v][1:v][2:v]concat=n=3:v=1:a=1" \
  final.mp4
```

**Create Instagram square from 16:9:**
```bash
ffmpeg -i input.mp4 -vf "crop=1080:1080" output.mp4
```

---

## Automated Batch Processing

**Create `process-all.sh`:**
```bash
#!/bin/bash

# Process all recordings for different platforms
for file in recordings/*.mp4; do
    name=$(basename "$file" .mp4)

    # YouTube version (no changes needed)
    cp "$file" "output/youtube-$name.mp4"

    # Instagram square
    ffmpeg -i "$file" -vf "crop=1080:1080" \
      "output/instagram-$name.mp4"

    # TikTok vertical (crop center)
    ffmpeg -i "$file" -vf "crop=1080:1920" \
      "output/tiktok-$name.mp4"

    echo "Processed $name"
done
```

---

## Recommended Setup for Your Project

**For iteration and testing:**
1. Use OBS with hotkeys
2. Quick manual recording when testing new features
3. 30-60 second clips

**For final polished videos:**
1. Use Puppeteer script
2. Record all combinations automatically
3. Let it run while you sleep
4. Wake up to 8+ videos ready to edit

**For social media:**
1. Use batch processing script
2. One source file → Multiple platform versions
3. Upload everywhere

---

## Integration with Your Workflow

**Add to package.json:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "record": "node fullAutoRecord.js",
    "process-videos": "./process-all.sh"
  }
}
```

**Then:**
```bash
npm run dev              # Start server
npm run record           # Record all variations
npm run process-videos   # Create platform-specific versions
```

---

## Next Steps

1. **Now:** Set up OBS for manual recording
   - Test with current V2
   - Record 2-3 clips of different sketches

2. **Soon:** Create Puppeteer script
   - Automate recording of all sketches
   - Set up for V3 when ready

3. **Later:** Batch processing
   - When you have final versions
   - Create all platform versions at once

Want me to create the actual recording scripts for you?
