// =============================================================
// ASCII NOISE — p5.js + Web Audio API
// Based on the OpenProcessing sketch by the user.
//
// Audio → Visual mappings:
//   BASS PLUCK onset  → background flashes dark, chars snap to dense blocks
//   BASS (smooth)     → cell size pulse, background darkens
//   VIOLIN mid        → noise step size (texture scale: fine ↔ coarse)
//   HIGH frequencies  → palette temperature shift (warm ↔ cool chars)
//   OVERALL energy    → zOff evolution speed (how fast the field flows)
// =============================================================

// ─── Original character set preserved exactly ────────────────
const asciiChars = [
  "░", "▒", "▓", "█",
  "▄", "▀", "▌", "▐",
  "▖", "▗", "▘", "▙", "▚", "▛", "▜", "▝", "▞", "▟",
  "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█",
  "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█",
  "─", "━", "│", "┃", "┌", "┐", "└", "┘",
  "├", "┤", "┬", "┴", "┼", "╳", "╱", "╲",
  "⣿", "⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯",
  "⠀", "⠁", "⠃", "⠇", "⠏", "⠟", "⠿", "⡿"
];

// Subsets for audio-driven character switching
const CHARS_HEAVY  = ["█", "▓", "▒", "░", "▉", "▊", "▋", "▌", "▍", "▎", "▏", "⣿", "⣾", "⣟", "⣯"];
const CHARS_BLOCK  = ["▄", "▀", "▌", "▐", "▖", "▗", "▘", "▙", "▚", "▛", "▜", "▝", "▞", "▟"];
const CHARS_LINE   = ["─", "━", "│", "┃", "╳", "╱", "╲", "┼", "├", "┤", "┬", "┴"];
const CHARS_BRAILLE= ["⠀", "⠁", "⠃", "⠇", "⠏", "⠟", "⠿", "⡿", "⣿", "⣾", "⣽", "⣻"];

// ─── Palettes ─────────────────────────────────────────────────
const PALETTES = [
  {
    name: 'Original',
    cols: ['#484064','#786B88','#DFAF66','#24212C','#B79767','#EDE1D6','#C16359','#38806B','#719CA9','#979189'],
    bg: [255, 255, 255],
    bgDark: [36, 33, 44],
  },
  {
    name: 'Winter',
    cols: ['#08183A','#003680','#005A9C','#0095B0','#52B8CC','#A8D8E8','#E0F4FA','#1A3C6A','#2E7AB0','#8ACAD8'],
    bg: [240, 248, 255],
    bgDark: [5, 10, 40],
  },
  {
    name: 'Noir',
    cols: ['#080808','#181818','#303030','#505050','#787878','#A8A8A8','#D8D8D8','#F0F0F0','#404040','#909090'],
    bg: [240, 240, 240],
    bgDark: [5, 5, 5],
  },
  {
    name: 'Embers',
    cols: ['#1A0200','#4D1000','#8B2000','#C44000','#E06000','#F09030','#FFD060','#FF7030','#CC2800','#660800'],
    bg: [255, 245, 230],
    bgDark: [20, 5, 0],
  },
  {
    name: 'Abyss',
    cols: ['#04000A','#180040','#4000A0','#8000C0','#B040E0','#D080FF','#F0D0FF','#600090','#3000A8','#A060D8'],
    bg: [240, 230, 255],
    bgDark: [4, 0, 12],
  },
];

let paletteIdx = 0;

// ─── Audio state ──────────────────────────────────────────────
let audioCtx    = null;
let analyserFFT = null;
let freqData;
const FFT_SIZE  = 2048;
let BIN_HZ      = 48000 / FFT_SIZE;
let audioReady  = false;

// Smoothed band values
let bassSmooth = 0, midSmooth = 0, highSmooth = 0;
let bassFlashVal = 0;   // 0-1 flash intensity

// One-pole follower
function makeFollower(up, dn) {
  let v = 0;
  return { feed: (x) => { const c = x > v ? up : dn; v += (x - v) * (1 - c); return v; } };
}
const bassF = makeFollower(0.4, 0.88);
const midF  = makeFollower(0.15, 0.97);
const highF = makeFollower(0.20, 0.96);

// Onset detector for staccato bass pluck
function makeOnset(winSize, thresh) {
  const buf = new Float32Array(winSize).fill(0.05);
  let pos = 0, cool = 0;
  return {
    feed(e) {
      const avg = buf.reduce((a, b) => a + b) / buf.length;
      const hit = cool <= 0 && e > avg * thresh && e > 0.04;
      buf[pos++ % buf.length] = e;
      if (cool > 0) cool--;
      if (hit) cool = 10;
      return hit;
    }
  };
}
const bassOnset = makeOnset(16, 1.6);

function bandEnergy(data, loHz, hiHz) {
  const lo = Math.max(1, Math.floor(loHz / BIN_HZ));
  const hi = Math.min(data.length - 1, Math.ceil(hiHz / BIN_HZ));
  let s = 0;
  for (let i = lo; i <= hi; i++) s += data[i];
  return s / ((hi - lo + 1) * 255);
}

// ─── Grid state ───────────────────────────────────────────────
let cols, rows;
let baseCellSize = 10;
let zOff = 0;
let padLeft, padRight, padTop, padBottom;

// Audio-driven visual params (updated each frame)
let noiseStep   = 0.15;    // texture scale — violin modulates this
let charSet     = asciiChars; // which chars to draw from — bass switches this
let zSpeed      = 0.02;    // field evolution speed — overall energy drives this
let bgR = 255, bgG = 255, bgB = 255;  // background color
let charOffset  = 0;       // shifts character index mapping — bass drives this
let paused      = false;

// ─── p5 sketch ────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(30);
  textAlign(CENTER, CENTER);
  textFont("Courier New, Lucida Console, monospace");
  noiseDetail(5, 0.5);
  computeGrid();
}

function draw() {
  if (paused) return;

  // ── Pull audio data ──
  if (audioReady && analyserFFT) {
    analyserFFT.getByteFrequencyData(freqData);

    const bassE = bandEnergy(freqData,  60,  350);
    const midE  = bandEnergy(freqData, 700, 5000);
    const highE = bandEnergy(freqData, 5000, 16000);

    bassSmooth = bassF.feed(bassE);
    midSmooth  = midF.feed(midE);
    highSmooth = highF.feed(highE);

    // ── Audio → visual only (nothing spatial, nothing size-related) ──

    // Background: bass smoothly darkens it
    const pal = PALETTES[paletteIdx];
    const darkT = min(1, bassSmooth * 1.8);
    bgR = lerp(pal.bg[0], pal.bgDark[0], darkT);
    bgG = lerp(pal.bg[1], pal.bgDark[1], darkT);
    bgB = lerp(pal.bg[2], pal.bgDark[2], darkT);

    // zOff: barely moves — just enough to feel alive, not to look like motion
    zSpeed = 0.0015 + midSmooth * 0.002;

    // Color index shift — high freqs nudge which palette entry each cell picks
    // This changes colour temperature without any spatial change
    colorShift = highSmooth * 0.25;

    // UI meters
    document.getElementById('bass-meter').style.width = (min(1, bassSmooth * 2.5) * 100).toFixed(1) + '%';
    document.getElementById('mid-meter').style.width  = (min(1, midSmooth  * 2.5) * 100).toFixed(1) + '%';
    document.getElementById('high-meter').style.width = (min(1, highSmooth * 2.5) * 100).toFixed(1) + '%';
    document.getElementById('state-label').textContent = 'playing';

  } else {
    // No audio — gentle defaults
    const pal = PALETTES[paletteIdx];
    bgR = pal.bg[0]; bgG = pal.bg[1]; bgB = pal.bg[2];
    noiseStep = 0.15;
    zSpeed    = 0.002;
    charSet   = asciiChars;
  }

  // ── Draw ──
  const pal = PALETTES[paletteIdx];
  background(bgR, bgG, bgB);
  noStroke();

  // Cell size is FIXED — never changes during playback
  const cellSize = baseCellSize;
  textSize(cellSize);

  for (let y = 0; y < rows; y++) {
    const yOff = y * noiseStep;
    for (let x = 0; x < cols; x++) {
      const xOff = x * noiseStep;
      const n = noise(xOff, yOff, zOff);

      // Character: pure noise mapping, no offset
      let idxChar = floor(map(n, 0, 1, 0, asciiChars.length));
      idxChar = constrain(idxChar, 0, asciiChars.length - 1);

      // Color: noise + subtle audio shift changes temperature, not position
      let idxCol = floor(map(n + colorShift, 0, 1.25, 0, pal.cols.length));
      idxCol = constrain(idxCol, 0, pal.cols.length - 1);

      fill(pal.cols[idxCol]);
      text(
        asciiChars[idxChar],
        padLeft + x * cellSize + cellSize * 0.5,
        padTop  + y * cellSize + cellSize * 0.5
      );
    }
  }

  zOff += zSpeed;
}

function computeGrid() {
  padLeft   = width  * 0.08;
  padRight  = width  * 0.08;
  padTop    = height * 0.08;
  padBottom = height * 0.08;
  const gW  = width  - padLeft - padRight;
  const gH  = height - padTop  - padBottom;
  cols = floor(gW / baseCellSize);
  rows = floor(gH / baseCellSize);
}

function computeGridDynamic(cellSize) {
  const gW = width  - padLeft - padRight;
  const gH = height - padTop  - padBottom;
  cols = floor(gW / cellSize);
  rows = floor(gH / cellSize);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeGrid();
}

// ─── Audio loading ────────────────────────────────────────────
async function initAudio(arrayBuffer) {
  if (audioCtx) audioCtx.close();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  BIN_HZ = audioCtx.sampleRate / FFT_SIZE;

  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  analyserFFT = audioCtx.createAnalyser();
  analyserFFT.fftSize = FFT_SIZE;
  analyserFFT.smoothingTimeConstant = 0.72;
  freqData = new Uint8Array(FFT_SIZE / 2);

  const src = audioCtx.createBufferSource();
  src.buffer = decoded;
  src.loop   = true;
  src.connect(analyserFFT);
  analyserFFT.connect(audioCtx.destination);
  src.start(0);

  audioReady = true;
  document.getElementById('overlay').style.display  = 'none';
  document.getElementById('playBtn').textContent    = 'Pause';
  document.getElementById('state-label').textContent = 'playing';
}

// ─── Controls ─────────────────────────────────────────────────
window.loadBundled = async function () {
  try {
    const resp = await fetch('../dist/assets/circles01a.mp3');
    await initAudio(await resp.arrayBuffer());
  } catch (e) {
    alert('Could not load circles01a.mp3\n' + e.message);
  }
};

window.loadAudioFile = async function (input) {
  const file = input.files[0];
  if (!file) return;
  await initAudio(await file.arrayBuffer());
};

window.startNoAudio = function () {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('state-label').textContent = 'no audio';
};

window.togglePlayPause = function () {
  paused = !paused;
  if (audioCtx) paused ? audioCtx.suspend() : audioCtx.resume();
  document.getElementById('playBtn').textContent = paused ? 'Play' : 'Pause';
};

window.cyclePalette = function () {
  paletteIdx = (paletteIdx + 1) % PALETTES.length;
  document.getElementById('palBtn').textContent = 'Palette: ' + PALETTES[paletteIdx].name;
};

window.toggleFullscreen = function () {
  const btn = document.getElementById('fsBtn');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      document.body.classList.add('fullscreen-mode');
      btn.textContent = '✕ Exit Fullscreen';
    });
  } else {
    document.exitFullscreen().then(() => {
      document.body.classList.remove('fullscreen-mode');
      btn.textContent = '⛶ Fullscreen';
    });
  }
};

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    document.body.classList.remove('fullscreen-mode');
    const b = document.getElementById('fsBtn');
    if (b) b.textContent = '⛶ Fullscreen';
  }
});

// Keyboard: P = palette, Space = pause
document.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') window.cyclePalette();
  if (e.key === ' ') { e.preventDefault(); window.togglePlayPause(); }
});
