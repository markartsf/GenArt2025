import p5 from 'p5';
import * as Tone from 'tone';

// --- Global State ---
let ribbons = [];
let numRibbons = 8;
let player, analyzer, fftAnalyzer;
let isPlaying = false;

let audioFeatures = {
  bass: 0,
  mid: 0,
  high: 0,
  rms: 0,
  spectrum: new Array(512).fill(0)
};

// Fall colors - warm flowing palette
const palette = [
  { h: 48, s: 95, l: 60 },  // Cadmium Yellow
  { h: 355, s: 85, l: 50 }, // Naphthol Red
  { h: 25, s: 90, l: 55 },  // Cadmium Orange
  { h: 0, s: 80, l: 28 },   // Dark Red
  { h: 345, s: 70, l: 25 }, // Burgundy
  { h: 15, s: 65, l: 30 },  // Dark Brown
  { h: 40, s: 75, l: 58 },  // Neutral Orange
  { h: 50, s: 45, l: 65 },  // Yellow
];

// --- p5.js Setup ---
const sketch = (p) => {
  p.setup = () => {
    // Create canvas and attach to container
    const container = document.getElementById('canvas-container') || document.body;
    const c = p.createCanvas(container.clientWidth || p.windowWidth, container.clientHeight || p.windowHeight);
    if (document.getElementById('canvas-container')) {
      c.parent('canvas-container');
    }
    
    p.colorMode(p.HSL);
    p.noStroke();
    
    setupAudio();
    setupControls();
    resetRibbons();
    p.background(5); // Immediate visual feedback
  };

  p.draw = () => {
    // 1. Update Audio Data
    if (isPlaying) updateAudioFeatures();

    // 2. Visual Update
    // Slow fade for trails
    p.fill(0, 0, 4, 0.15); // HSL very dark grey
    p.rect(0, 0, p.width, p.height);

    // Update and Draw Ribbons
    updateRibbons();
    drawRibbons();
    
    // Debug FPS (Optional, remove for production)
    if (p.frameCount % 60 === 0) {
      console.log("FPS:", Math.floor(p.frameRate()));
    }
  };

  p.windowResized = () => {
    const container = document.getElementById('canvas-container') || document.body;
    p.resizeCanvas(container.clientWidth || p.windowWidth, container.clientHeight || p.windowHeight);
    resetRibbons();
  };

  // --- Logic ---

  function resetRibbons() {
    ribbons = [];
    const spacing = p.width / (numRibbons + 1);

    for (let i = 0; i < numRibbons; i++) {
      const centerX = spacing * (i + 1);
      // Pre-allocate points array to avoid GC thrashing
      const numPoints = 50;
      
      // Initialize with valid positions immediately so we don't draw degenerate gradients
      const points = new Array(numPoints).fill(0).map((_, idx) => {
        return { 
          x: centerX, 
          y: (idx / (numPoints - 1)) * p.height, 
          width: 40 
        };
      });

      ribbons.push({
        centerX: centerX,
        points: points, 
        colorIndex: i % palette.length,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.02 + Math.random() * 0.03,
        baseWidth: 40 + Math.random() * 40,
        numPoints: numPoints,
      });
    }
  }

  function updateRibbons() {
    // Allow updates even when paused so we see the ribbons (just no audio reaction)
    const currentRms = isPlaying ? audioFeatures.rms : 0.05; // Idle movement
    const currentBass = isPlaying ? audioFeatures.bass : 0;
    const currentMid = isPlaying ? audioFeatures.mid : 0;
    const currentHigh = isPlaying ? audioFeatures.high : 0;

    for (const ribbon of ribbons) {
      // Phase advances with audio
      ribbon.phase += ribbon.phaseSpeed * (isPlaying ? (currentRms * 10 + currentMid * 5) : 0.5);

      for (let i = 0; i < ribbon.numPoints; i++) {
        const t = i / (ribbon.numPoints - 1);
        const y = t * p.height;

        const waveAmplitude = (currentBass * 150 + currentMid * 80);
        const wave1 = Math.sin(ribbon.phase + t * Math.PI * 3) * waveAmplitude;
        const wave2 = Math.sin(ribbon.phase * 1.5 + t * Math.PI * 5) * waveAmplitude * 0.5;

        const x = ribbon.centerX + wave1 + wave2;
        const widthMod = 1 + Math.sin(t * Math.PI * 2 + ribbon.phase) * 0.5;
        const w = ribbon.baseWidth * widthMod * (1 + currentHigh * 2);

        // Update existing object instead of creating new one
        ribbon.points[i].x = x;
        ribbon.points[i].y = y;
        ribbon.points[i].width = w;
      }
    }
  }

  function drawRibbons() {
    for (const ribbon of ribbons) {
      const color = palette[ribbon.colorIndex];
      
      // Glow
      const glowAmount = 15 + audioFeatures.rms * 30 + audioFeatures.high * 40;
      p.drawingContext.shadowBlur = glowAmount;
      p.drawingContext.shadowColor = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.7)`;

      for (let i = 0; i < ribbon.points.length - 1; i++) {
        const p1 = ribbon.points[i];
        const p2 = ribbon.points[i + 1];

        // Performance: Skip invisible segments
        if (p1.width < 1 || p2.width < 1) continue;

        // Gradient per segment (Native Canvas API via p5 drawingContext)
        const gradient = p.drawingContext.createLinearGradient(
          p1.x - p1.width / 2, p1.y,
          p1.x + p1.width / 2, p1.y
        );

        const alpha = 0.6 + audioFeatures.high * 0.4;
        gradient.addColorStop(0, `hsla(${color.h}, ${color.s}%, ${color.l - 20}%, 0)`);
        gradient.addColorStop(0.5, `hsla(${color.h}, ${color.s}%, ${color.l}%, ${alpha})`);
        gradient.addColorStop(1, `hsla(${color.h}, ${color.s}%, ${color.l - 20}%, 0)`);

        p.drawingContext.fillStyle = gradient;

        p.beginShape();
        p.vertex(p1.x - p1.width / 2, p1.y);
        p.vertex(p1.x + p1.width / 2, p1.y);
        p.vertex(p2.x + p2.width / 2, p2.y);
        p.vertex(p2.x - p2.width / 2, p2.y);
        p.endShape(p.CLOSE);
      }
    }
    // Reset shadow to avoid affecting other elements
    p.drawingContext.shadowBlur = 0;
  }

  // --- Audio & Controls (Kept mostly same, adapted for module scope) ---
  
  function setupAudio() {
    analyzer = new Tone.Analyser('waveform', 1024);
    fftAnalyzer = new Tone.Analyser('fft', 512);
  }

  function updateAudioFeatures() {
    if (!analyzer || !fftAnalyzer || !isPlaying) return;

    const waveform = analyzer.getValue();
    const spectrum = fftAnalyzer.getValue();
    const bins = spectrum.length;
    const linearSpectrum = spectrum.map(db => Math.pow(10, db / 20));

    const bassEnd = Math.floor(bins * 0.1);
    const midEnd = Math.floor(bins * 0.5);

    audioFeatures.bass = average(linearSpectrum.slice(0, bassEnd));
    audioFeatures.mid = average(linearSpectrum.slice(bassEnd, midEnd));
    audioFeatures.high = average(linearSpectrum.slice(midEnd));

    const sumSquares = waveform.reduce((sum, val) => sum + val * val, 0);
    audioFeatures.rms = Math.sqrt(sumSquares / waveform.length);
    
    // Update DOM UI if exists
    updateAudioInfoDisplay();
  }

  function average(array) {
    if (array.length === 0) return 0;
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }

  function setupControls() {
    const audioFileInput = document.getElementById('audioFile');
    const playPauseBtn = document.getElementById('playPause');
    const stopBtn = document.getElementById('stop');
    const resetBtn = document.getElementById('reset');
    const statusText = document.getElementById('status');

    if(audioFileInput) {
      audioFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          if(statusText) statusText.textContent = 'Loading audio...';
          try {
            if (player) {
              player.stop();
              player.dispose();
            }
            const url = URL.createObjectURL(file);
            player = new Tone.Player(url).toDestination();
            player.volume.value = 0;
            player.connect(analyzer);
            player.connect(fftAnalyzer);
            await Tone.loaded();
            
            if(playPauseBtn) playPauseBtn.disabled = false;
            if(stopBtn) stopBtn.disabled = false;
            if(statusText) statusText.textContent = `✓ Audio loaded: ${file.name}`;
          } catch (error) {
            console.error(error);
            if(statusText) statusText.textContent = '✗ Error loading audio';
          }
        }
      });
    }

    if(playPauseBtn) {
      playPauseBtn.addEventListener('click', async () => {
        if (!player) return;
        if (isPlaying) {
          player.stop();
          isPlaying = false;
          playPauseBtn.textContent = 'Play';
          if(statusText) statusText.textContent = 'Paused';
        } else {
          await Tone.start();
          player.start();
          isPlaying = true;
          playPauseBtn.textContent = 'Pause';
          if(statusText) statusText.textContent = '▶ Playing...';
        }
      });
    }

    if(stopBtn) {
      stopBtn.addEventListener('click', () => {
        if (player) {
          player.stop();
          isPlaying = false;
          if(playPauseBtn) playPauseBtn.textContent = 'Play';
          if(statusText) statusText.textContent = 'Stopped';
        }
      });
    }

    if(resetBtn) {
      resetBtn.addEventListener('click', () => {
        resetRibbons();
      });
    }
  }

  function updateAudioInfoDisplay() {
    const infoDiv = document.getElementById('audio-info');
    if(!infoDiv) return;
    infoDiv.innerHTML = `
      <div class="info-item"><div class="info-label">Bass</div><div class="info-value">${(audioFeatures.bass * 100).toFixed(1)}%</div></div>
      <div class="info-item"><div class="info-label">Mid</div><div class="info-value">${(audioFeatures.mid * 100).toFixed(1)}%</div></div>
      <div class="info-item"><div class="info-label">High</div><div class="info-value">${(audioFeatures.high * 100).toFixed(1)}%</div></div>
      <div class="info-item"><div class="info-label">Energy</div><div class="info-value">${(audioFeatures.rms * 100).toFixed(1)}%</div></div>
    `;
  }
};

// Initialize p5 in instance mode
new p5(sketch);
