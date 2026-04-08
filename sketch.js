// --- Global Variables ---
let scene, camera, renderer, particles, material;
let audioContext, analyser, source, audio, dataArray;
const clock = new THREE.Clock();

// Audio analysis parameters
const audioState = { bass: 0, mid: 0, treble: 0 };
const FFT_SIZE = 512;
const BASS_RANGE = [20, 140];    // Hz
const MID_RANGE = [400, 2600];   // Hz
const TREBLE_RANGE = [5200, 14000]; // Hz

// Particle simulation API
const PARTICLE_COUNT = 20000;
const controls = {};
const opts = {}; // Cache the options object to avoid 60fps re-allocations

// --- Main Initialization ---
function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    
    const canvasContainer = document.getElementById('canvas-container');
    const width = canvasContainer ? canvasContainer.clientWidth : window.innerWidth;
    const height = canvasContainer ? canvasContainer.clientHeight : window.innerHeight;

    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 100;
    
    const canvasEl = document.getElementById('canvas');
    // Pass the existing canvas to the renderer so it sits correctly in the layout
    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
    renderer.setSize(width, height);

    // 2. Particle System Setup
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    material = new THREE.PointsMaterial({
        size: 0.5,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 3. Audio Setup
    document.getElementById('audioFile').addEventListener('change', handleAudioUpload);
    
    // Wire up the playback control buttons
    document.getElementById('playPause').addEventListener('click', togglePlay);
    document.getElementById('stop').addEventListener('click', stopAudio);
    document.getElementById('reset').addEventListener('click', () => {
        camera.position.set(0, 0, 100);
        camera.lookAt(scene.position);
    });

    // 4. Handle Window Resizing
    window.addEventListener('resize', onWindowResize, false);
    
    // 5. Initial Info display
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = "Upload an MP3 file to begin.";
    
    // 6. Start Animation Loop
    animate();
}

// --- Audio Handling ---
function handleAudioUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // If audio is already playing, stop it.
    if (audio) {
        audio.pause();
        // Revoke the old URL to free up memory.
        URL.revokeObjectURL(audio.src);
    }
    // Disconnect the old source if it exists.
    if (source) {
        source.disconnect();
    }

    const url = URL.createObjectURL(file);
    audio = new Audio(url);
    audio.loop = true;

    // Initialize AudioContext if it's the first time.
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.connect(audioContext.destination); // Connect analyser to destination once
        
        // ✅ GOOD: Allocate the frequency array ONCE
        dataArray = new Uint8Array(analyser.frequencyBinCount);
    }

    // Create a new source node for the new audio element.
    source = audioContext.createMediaElementSource(audio);
    // Connect the new source to the analyser.
    source.connect(analyser);
    
    // Resume AudioContext after user gesture.
    audioContext.resume();

    // Enable UI controls
    document.getElementById('playPause').disabled = false;
    document.getElementById('stop').disabled = false;
    document.getElementById('playPause').textContent = 'Pause';
    
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = `Loading audio: ${file.name}...`;
    
    audio.play().catch(e => {
        console.warn("Autoplay prevented:", e);
        document.getElementById('playPause').textContent = 'Play';
        if (statusEl) statusEl.textContent = `Ready: ${file.name} (Press Play)`;
    });

    audio.addEventListener('playing', () => {
        if (statusEl) statusEl.textContent = `Playing: ${file.name}`;
    });
}

function togglePlay() {
    if (!audio) return;
    if (audio.paused) {
        audioContext.resume();
        audio.play();
        document.getElementById('playPause').textContent = 'Pause';
    } else {
        audio.pause();
        document.getElementById('playPause').textContent = 'Play';
    }
}

function stopAudio() {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    document.getElementById('playPause').textContent = 'Play';
}

function analyzeAudio() {
    if (!analyser || !dataArray) return;

    const bufferLength = analyser.frequencyBinCount;
    analyser.getByteFrequencyData(dataArray);

    function getAverage(range) {
        const sampleRate = audioContext.sampleRate;
        const start = Math.round(range[0] * bufferLength / (sampleRate / 2));
        const end = Math.round(range[1] * bufferLength / (sampleRate / 2));
        let sum = 0;
        for (let i = start; i < end; i++) {
            sum += dataArray[i];
        }
        const avg = (sum / (end - start)) / 255;
        return isNaN(avg) ? 0 : avg;
    }
    
    audioState.bass = getAverage(BASS_RANGE);
    audioState.mid = getAverage(MID_RANGE);
    audioState.treble = getAverage(TREBLE_RANGE);
}


// --- Particle Simulation API Implementation ---
function addControl(id, label, min, max, initialValue) {
    if (!controls[id]) {
        const slidersElement = document.getElementById('controls');
        if (!slidersElement) return initialValue;

        const controlDiv = document.createElement('div');
        controlDiv.className = 'control-group';

        const labelElement = document.createElement('label');
        labelElement.setAttribute('for', id);
        labelElement.textContent = label;
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = id;
        slider.min = min;
        slider.max = max;
        slider.step = (max - min) / 100;
        slider.value = initialValue;
        
        controlDiv.appendChild(labelElement);
        controlDiv.appendChild(slider);
        slidersElement.appendChild(controlDiv);

        controls[id] = slider;
    }
    return parseFloat(controls[id].value);
}

// --- The Creative Visualization Function ---
function updateParticles(i, count, time, target, color, opts) {
    const { bass, mid, treble, rotationSpeed, expansion, chaos, spiralArms } = opts;

    const audioExpansion = expansion + (bass * bass * 40);
    const audioChaos = chaos + mid * 0.8;

    const angle = (i / count) * Math.PI * 2 * spiralArms;
    // Use a stable hash instead of Math.random() so particles don't jitter randomly every frame
    const radius = Math.pow(1 - hash(i), 3) * audioExpansion;

    const timeFactor = time * rotationSpeed;
    const wobble = Math.sin(angle * 2.5 + timeFactor) * audioChaos;

    const x = Math.cos(angle + timeFactor) * radius;
    const z = Math.sin(angle + timeFactor) * radius;
    const y = Math.cos(angle * 3.0 + timeFactor * 0.5) * wobble * 5.0 + (bass * 15);

    target.set(x, y, z);

    const distanceFromCenter = Math.sqrt(x * x + y * y + z * z);
    const hue = 0.6 + (distanceFromCenter / audioExpansion) * 0.2 + (treble * 0.2);
    const saturation = 0.6 + bass * 0.4;
    const lightness = 0.4 + mid * 0.3;

    color.setHSL(hue, saturation, lightness);
}


// --- Animation Loop ---
const target = new THREE.Vector3();
const color = new THREE.Color();

function animate() {
    requestAnimationFrame(animate);

    try {
        const time = clock.getElapsedTime();
        analyzeAudio();

        // --- Get UI Control Values (once per frame) ---
        const rotationSpeed = addControl("rotation", "Rotation Speed", 0.0, 2.0, 0.2);
        const expansion = addControl("expansion", "Expansion", 10, 80, 40);
        const chaos = addControl("chaos", "Chaos", 0.0, 1.0, 0.3);
        const spiralArms = addControl("arms", "Spiral Arms", 1, 8, 3);
        
        const positions = particles.geometry.attributes.position.array;
        const colors = particles.geometry.attributes.color.array;

        opts.bass = audioState.bass;
        opts.mid = audioState.mid;
        opts.treble = audioState.treble;
        opts.rotationSpeed = rotationSpeed;
        opts.expansion = expansion;
        opts.chaos = chaos;
        opts.spiralArms = spiralArms;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            updateParticles(i, PARTICLE_COUNT, time, target, color, opts);

            positions[i * 3] = target.x;
            positions[i * 3 + 1] = target.y;
            positions[i * 3 + 2] = target.z;

            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        particles.geometry.attributes.position.needsUpdate = true;
        particles.geometry.attributes.color.needsUpdate = true;
        
        // Animate camera rotation for a more dynamic feel
        camera.position.x = Math.sin(time * 0.15) * 100;
        camera.position.z = Math.cos(time * 0.15) * 100;
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
    } catch (e) {
        console.error("Error in animation loop:", e);
        const statusEl = document.getElementById('status');
        if (statusEl) statusEl.textContent = "An error occurred. Check the console for details.";
    }
}

// --- Utility Functions ---
function onWindowResize() {
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer) return;
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// Simple hash to get a consistent random value for each particle
function hash(n) {
    return Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;
}

// --- Start Everything ---
init();
