let mic, fft;
const painters = [];
const numPainters = 7;
const palette = ["#F94144", "#F3722C", "#F8961E", "#F9C74F", "#90BE6D", "#43AA8B", "#577590"];

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  angleMode(DEGREES);

  // Define a new, textured "charcoal" brush
  brush.add("charcoal", {
    type: "standard",
    weight: 25,
    vibration: 3,
    definition: 0.6,
    quality: 12,
    opacity: 40,
    spacing: 0.8,
    blend: false,
    pressure: {
      type: "standard",
      min_max: [0.5, 1.5],
      curve: [0.4, 0.75]
    },
    rotate: "random",
  });
  brush.pick("charcoal");

  // Initialize audio input and FFT
  mic = new p5.AudioIn();
  mic.start();
  fft = new p5.FFT(0.8, 128); // Smoothing, FFT bins
  fft.setInput(mic);

  // Create painter objects
  for (let i = 0; i < numPainters; i++) {
    painters.push(new Painter());
  }

  // Initial message
  textAlign(CENTER, CENTER);
  fill(255, 150);
  noStroke();
  text("Click to begin. Play some music!", width / 2, height / 2);
}

function draw() {
  if (getAudioContext().state !== 'running') return;

  background("#202020");
  translate(-width / 2, -height / 2);

  // Analyze the frequency spectrum
  fft.analyze();
  const bass = fft.getEnergy("bass"); // 0-255
  const mid = fft.getEnergy("lowMid"); // 0-255
  const treble = fft.getEnergy("treble"); // 0-255

  // Update and draw each painter
  for (const painter of painters) {
    painter.update(bass, mid, treble);
  }
}

class Painter {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.angle = random(360);
    this.color = random(palette);
    this.noiseOffsetX = random(1000);
    this.noiseOffsetY = random(1000);
  }

  update(bass, mid, treble) {
    // Treble controls color
    // Only change color on strong treble hits to avoid flickering
    if (treble > 150 && random(1) < 0.1) {
      this.color = random(palette);
    }
    brush.stroke(this.color);

    // Bass controls pressure/size
    const pressure = map(bass, 0, 255, 0.2, 3.0, true);

    // Mid controls movement speed/length
    const length = map(mid, 0, 255, 0, 25, true);

    // Update angle with Perlin noise for organic movement
    this.angle = noise(this.noiseOffsetX, this.noiseOffsetY) * 360 * 3;
    this.noiseOffsetX += 0.005;
    this.noiseOffsetY += 0.005;

    // Calculate previous position
    const prevX = this.x;
    const prevY = this.y;

    // Update position
    this.x += cos(this.angle) * length;
    this.y += sin(this.angle) * length;

    // Draw the line with audio-reactive pressure
    brush.line(prevX, prevY, this.x, this.y, pressure);

    // Wrap around screen edges
    if (this.x > width) this.x = 0;
    if (this.x < 0) this.x = width;
    if (this.y > height) this.y = 0;
    if (this.y < 0) this.y = height;
  }
}

function mousePressed() {
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume().then(() => {
      console.log("Audio context resumed.");
      background("#202020");
    });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background("#202020");
  text("Click to begin. Play some music!", width / 2, height / 2);
}
