// Sacred Geometry Orb — Three.js
// Morphing geometric forms with shader-like materials

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let meshes = [];
let wireframeMeshes = [];
let currentGeomIndex = 0;
let rotating = true;
let showWireframe = false;
let clock;
let time = 0;

const GEOMETRIES = [
  () => new THREE.IcosahedronGeometry(1.8, 3),
  () => new THREE.DodecahedronGeometry(1.8, 1),
  () => new THREE.OctahedronGeometry(1.8, 3),
  () => new THREE.TorusKnotGeometry(1.2, 0.4, 200, 32, 2, 3),
  () => new THREE.TorusKnotGeometry(1.2, 0.35, 200, 32, 3, 5),
];

const PALETTES = [
  { primary: 0x88ccff, secondary: 0xaa66ff, emissive: 0x112244 },
  { primary: 0xffaa44, secondary: 0xff4488, emissive: 0x220a00 },
  { primary: 0x44ffaa, secondary: 0x44aaff, emissive: 0x001a10 },
];
let paletteIndex = 0;

function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.08);

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 5);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = false;

  clock = new THREE.Clock();

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x111133, 1.5);
  scene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(0x88aaff, 120, 30);
  pointLight1.position.set(5, 5, 5);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0xff66aa, 80, 20);
  pointLight2.position.set(-5, -3, -5);
  scene.add(pointLight2);

  const rimLight = new THREE.DirectionalLight(0x4488ff, 1.5);
  rimLight.position.set(0, 5, -5);
  scene.add(rimLight);

  // Background star field
  addStarfield();

  // Build initial geometry
  buildGeometry(currentGeomIndex);

  // Resize handler
  window.addEventListener('resize', onResize);

  animate();
}

function addStarfield() {
  const starGeometry = new THREE.BufferGeometry();
  const count = 2000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 80;
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05 });
  scene.add(new THREE.Points(starGeometry, starMaterial));
}

function buildGeometry(index) {
  // Remove old meshes
  meshes.forEach(m => scene.remove(m));
  wireframeMeshes.forEach(m => scene.remove(m));
  meshes = [];
  wireframeMeshes = [];

  const pal = PALETTES[paletteIndex];
  const geom = GEOMETRIES[index]();

  // Main mesh — MeshPhysicalMaterial for refractive, gem-like quality
  const mat = new THREE.MeshPhysicalMaterial({
    color: pal.primary,
    emissive: pal.emissive,
    metalness: 0.3,
    roughness: 0.1,
    transmission: 0.4,
    thickness: 0.5,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geom, mat);
  scene.add(mesh);
  meshes.push(mesh);

  // Inner glowing core
  const coreMat = new THREE.MeshBasicMaterial({
    color: pal.secondary,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
  });
  const core = new THREE.Mesh(geom.clone(), coreMat);
  core.scale.setScalar(0.92);
  scene.add(core);
  meshes.push(core);

  // Wireframe overlay
  const wireMat = new THREE.MeshBasicMaterial({
    color: pal.secondary,
    wireframe: true,
    transparent: true,
    opacity: showWireframe ? 0.6 : 0.08,
  });
  const wireMesh = new THREE.Mesh(geom.clone(), wireMat);
  wireMesh.scale.setScalar(1.002);
  scene.add(wireMesh);
  wireframeMeshes.push(wireMesh);

  // Outer halo ring (torus)
  if (index < 3) {
    const ringGeom = new THREE.TorusGeometry(2.4, 0.015, 16, 200);
    const ringMat = new THREE.MeshBasicMaterial({
      color: pal.secondary,
      transparent: true,
      opacity: 0.5,
    });
    const ring1 = new THREE.Mesh(ringGeom, ringMat);
    ring1.rotation.x = Math.PI / 3;
    scene.add(ring1);
    meshes.push(ring1);

    const ring2 = new THREE.Mesh(ringGeom.clone(), ringMat.clone());
    ring2.rotation.x = -Math.PI / 3;
    ring2.rotation.y = Math.PI / 4;
    scene.add(ring2);
    meshes.push(ring2);
  }
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  time += delta;

  if (rotating) {
    meshes.forEach((m, i) => {
      m.rotation.x += delta * (0.12 + i * 0.03);
      m.rotation.y += delta * (0.18 - i * 0.02);
    });
    wireframeMeshes.forEach(m => {
      m.rotation.x += delta * 0.12;
      m.rotation.y += delta * 0.18;
    });
  }

  // Gentle pulse
  const scale = 1 + Math.sin(time * 0.8) * 0.03;
  meshes[0] && (meshes[0].scale.setScalar(scale));

  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Controls exposed to HTML buttons
window.toggleWireframe = function () {
  showWireframe = !showWireframe;
  wireframeMeshes.forEach(m => {
    m.material.opacity = showWireframe ? 0.6 : 0.08;
  });
};

window.toggleRotation = function () {
  rotating = !rotating;
};

window.nextGeometry = function () {
  currentGeomIndex = (currentGeomIndex + 1) % GEOMETRIES.length;
  paletteIndex = (paletteIndex + 1) % PALETTES.length;
  buildGeometry(currentGeomIndex);
};

init();
