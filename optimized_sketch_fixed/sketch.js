let sound, fft, amp;
let started = false;
let canvas;

function preload() {
  sound = loadSound('track.mp3', () => {
    select('#loading').html('Audio loaded. Click Play to start.');
  }, err => {
    select('#loading').html('Error loading audio.');
    console.error(err);
  });
}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.hide();
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
  fft = new p5.FFT(0.8, 1024);
  amp = new p5.Amplitude();
  amp.smooth(0.8);
  background(0);
}

function draw() {
  if (!started) return;
  background(0, 0.05);

  let spectrum = fft.analyze();
  let level = amp.getLevel();
  let bass = fft.getEnergy('bass');
  let mid = fft.getEnergy('mid');
  let treble = fft.getEnergy('treble');

  // Visualize reactive particles
  for (let i = 0; i < 200; i++) {
    let x = random(width);
    let y = random(height);
    let hue = map(bass + mid + treble, 0, 765, 0, 360);
    let size = map(level, 0, 0.3, 2, 25);
    fill(hue, 80, 100, 30);
    ellipse(x, y, size, size);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// User gesture unlock for Safari
function startAudio() {
  userStartAudio();
  if (sound && !sound.isPlaying()) {
    sound.play();
  }
  select('#playButton').hide();
  select('#loading').hide();
  canvas.show();
  started = true;
}

document.getElementById('playButton').addEventListener('click', startAudio);
