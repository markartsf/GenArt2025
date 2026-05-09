let nodes = [];
let colors = ["#0a0d02BB","#922301BB","#f76e0BB9","#ead8b8BB","#c0df80BB","#a59b3cBB","#86601aBB","#013f61BB","#07606aBB","#0f7b9cBB","#366a1cBB","#eb7300BB","#142027BB","#47020eBB","#884114BB","#686963BB","#66aecBB9","#8ab2c0BB","#2f3b3eBB","#dd841f","#0f202e","#862534","#116887","#304fad","#451c06","#743212","#9c400a","#f97e01","#929e78","#13b2bc","#0c8194","#0c8194"];
let mode = 0;
let i = 0;
let moving = true;
let rseed;
let zoom = 1;
let tzoom = 1;
let freq = 1;
let baseZoom = 1;

// Audio
let song = null;
let fft, ampAnalyzer;
let audioStarted = false;

// Auto-normalisation: track running peak so quiet tracks still drive visuals
let peakAmp = 0.001;

// Audio globals read by Node class
let audioScale  = 0;   // amplitude  → orbit radius
let audioSpeed  = 0;   // mids       → counter speed
let audioBass   = 0;   // bass       → zoom pulse
let audioTreble = 0;   // treble     → stroke weight

function setup() {
    createCanvas(windowWidth, windowHeight);
    rseed = random(1000);

    fft = new p5.FFT(0.6, 512);        // lower smoothing = snappier
    ampAnalyzer = new p5.Amplitude(0.6);
}

function draw() {
    randomSeed(rseed);

    if (audioStarted && song) {
        fft.analyze();

        let rawBass   = fft.getEnergy("bass")   / 255;
        let rawMid    = fft.getEnergy("mid")    / 255;
        let rawTreble = fft.getEnergy("treble") / 255;
        let rawAmp    = ampAnalyzer.getLevel();

        // Auto-normalise: slowly track the peak level seen so far
        peakAmp = max(peakAmp * 0.9998, rawAmp);
        let normAmp = rawAmp / max(peakAmp, 0.001);

        // Smooth and scale — aggressive multipliers for visible response
        audioScale  = lerp(audioScale,  min(normAmp * 2,   1),   0.25);
        audioSpeed  = lerp(audioSpeed,  min(rawMid  * 6,   1),   0.22);
        audioBass   = lerp(audioBass,   min(rawBass * 5,   1),   0.25);
        audioTreble = lerp(audioTreble, min(rawTreble * 6, 1),   0.2);

        // Bass pulses zoom on top of manual scroll
        tzoom = constrain(baseZoom + audioBass * 1.0, 1, 2);

        // Update meters in HTML
        document.getElementById('amp-meter').style.width  = (normAmp * 100) + '%';
        document.getElementById('bass-meter').style.width = (audioBass * 100) + '%';
        document.getElementById('mid-meter').style.width  = (audioSpeed / 4 * 100) + '%';
        document.getElementById('high-meter').style.width = (audioTreble / 4 * 100) + '%';
    }

    if (frameCount % 5 == 0 && i < colors.length) {
        let ang = map(i, 0, colors.length, 0, TAU) - HALF_PI;
        nodes.push(new Node(i % 2, i, ang));
        i++;
    }

    background(255);
    translate(width / 2, height / 2);
    zoom = lerp(zoom, tzoom, 0.1);
    push();
    scale(zoom);
    for (let n of nodes) {
        n.show();
        n.connect();
        n.arrange();
    }
    pop();

    fill(0, 80);
    noStroke();
    textAlign(LEFT, BOTTOM);
    textSize(height / 40);
    text(mode, -width / 2, height / 2);
    textAlign(RIGHT, BOTTOM);
    textSize(height / 40);
    text(freq - 1, width / 2, height / 2);
}

// Called when nodes finish spawning and moving is toggled
function mousePressed() {
    // Ignore clicks on HTML buttons/labels
    if (document.getElementById('overlay').style.display !== 'none' &&
        document.getElementById('overlay').style.display !== '') return;

    mode = (mode + 1) % 5;
    if (mode == 0) freq++;
    if (freq == 7) freq = 1;
    rseed = random(1000);
    frameCount = 0;
}

function keyPressed() {
    if (keyCode != 32) return;
    moving = !moving;
    for (let n of nodes) {
        if (!moving) n.counter = HALF_PI;
        else n.counter = map(n.i, 0, colors.length - 1, 0, TAU) - HALF_PI;
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

function mouseWheel(event) {
    baseZoom += event.delta / 1000;
    baseZoom = constrain(baseZoom, 1, 1.5);
}

// ── Audio control functions (called from HTML) ─────────────────

function onSoundLoaded() {
    fft.setInput(song);
    ampAnalyzer.setInput(song);
    song.loop();
    audioStarted = true;
    document.getElementById('playBtn').textContent = 'Pause';
}

function loadBundled() {
    document.getElementById('overlay').style.display = 'none';
    userStartAudio().then(() => {
        if (song) { song.stop(); song.disconnect(); }
        song = loadSound('circles01a.mp3', onSoundLoaded);
    });
}

function loadFile(input) {
    const file = input.files[0];
    if (!file) return;
    document.getElementById('overlay').style.display = 'none';
    const url = URL.createObjectURL(file);
    userStartAudio().then(() => {
        if (song) { song.stop(); song.disconnect(); }
        song = loadSound(url, onSoundLoaded);
    });
}

function togglePlay() {
    if (!song) return;
    if (song.isPlaying()) {
        song.pause();
        document.getElementById('playBtn').textContent = 'Play';
    } else {
        song.loop();
        document.getElementById('playBtn').textContent = 'Pause';
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        document.body.classList.add('fullscreen-mode');
    } else {
        document.exitFullscreen();
        document.body.classList.remove('fullscreen-mode');
    }
}
