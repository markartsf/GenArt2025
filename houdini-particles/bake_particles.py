#!/usr/bin/env python3
"""
Pre-bake music-reactive particle geometry as .bgeo.sc sequence.
Houdini just loads and plays — no solver, no keyframes, instant scrub.

Run with hython:
  hython bake_particles.py
"""

import hou
import csv
import os
import math
import random

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, "audio_data.csv")
HIP_PATH = os.path.join(SCRIPT_DIR, "music_particles_v2.hip")
GEO_DIR = os.path.join(SCRIPT_DIR, "geo")
FPS = 24

# Only bake first 60 seconds for a manageable test
MAX_SECONDS = 60
MAX_FRAMES = MAX_SECONDS * FPS

print("=== Music-Reactive Particle Baker ===")

# ============================================================
# Load audio data
# ============================================================
audio_data = []
with open(CSV_PATH, 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        audio_data.append({k: float(v) for k, v in row.items()})

total_frames = min(len(audio_data), MAX_FRAMES)
print(f"Loaded {len(audio_data)} frames, baking first {total_frames} ({total_frames/FPS:.0f}s)")

# ============================================================
# Create geo output directory
# ============================================================
os.makedirs(GEO_DIR, exist_ok=True)

# ============================================================
# Particle simulation in pure Python
# ============================================================

class Particle:
    __slots__ = ['pos', 'vel', 'age', 'life', 'color', 'pscale', 'emitter_id', 'birth_energy']
    def __init__(self, pos, vel, life, color, pscale, emitter_id, birth_energy):
        self.pos = list(pos)
        self.vel = list(vel)
        self.age = 0.0
        self.life = life
        self.color = list(color)
        self.pscale = pscale
        self.emitter_id = emitter_id
        self.birth_energy = birth_energy


def vec_add(a, b):
    return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]

def vec_scale(a, s):
    return [a[0]*s, a[1]*s, a[2]*s]

def vec_len(a):
    return math.sqrt(a[0]**2 + a[1]**2 + a[2]**2)

def vec_normalize(a):
    l = vec_len(a)
    if l < 0.0001:
        return [0, 0, 0]
    return [a[0]/l, a[1]/l, a[2]/l]

def simple_noise_3d(x, y, z):
    """Simple pseudo-noise for curl approximation."""
    # Hash-based noise
    def hash_f(n):
        n = math.sin(n) * 43758.5453123
        return n - math.floor(n)

    ix = math.floor(x)
    iy = math.floor(y)
    iz = math.floor(z)
    fx = x - ix
    fy = y - iy
    fz = z - iz

    # Smoothstep
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    fz = fz * fz * (3 - 2 * fz)

    n = ix + iy * 157 + iz * 113

    v000 = hash_f(n)
    v100 = hash_f(n + 1)
    v010 = hash_f(n + 157)
    v110 = hash_f(n + 158)
    v001 = hash_f(n + 113)
    v101 = hash_f(n + 114)
    v011 = hash_f(n + 270)
    v111 = hash_f(n + 271)

    v00 = v000 + (v100 - v000) * fx
    v10 = v010 + (v110 - v010) * fx
    v01 = v001 + (v101 - v001) * fx
    v11 = v011 + (v111 - v011) * fx

    v0 = v00 + (v10 - v00) * fy
    v1 = v01 + (v11 - v01) * fy

    return v0 + (v1 - v0) * fz


def curl_noise(x, y, z, scale=1.0):
    """Compute curl of noise field for divergence-free flow."""
    eps = 0.01
    sx, sy, sz = x * scale, y * scale, z * scale

    # Partial derivatives via finite differences
    # Using 3 offset noise fields for 3D curl
    def nx(px, py, pz): return simple_noise_3d(px + 100, py + 200, pz + 300)
    def ny(px, py, pz): return simple_noise_3d(px + 400, py + 500, pz + 600)
    def nz(px, py, pz): return simple_noise_3d(px + 700, py + 800, pz + 900)

    # curl = (dNz/dy - dNy/dz, dNx/dz - dNz/dx, dNy/dx - dNx/dy)
    cx = (nz(sx, sy+eps, sz) - nz(sx, sy-eps, sz) - ny(sx, sy, sz+eps) + ny(sx, sy, sz-eps)) / (2*eps)
    cy = (nx(sx, sy, sz+eps) - nx(sx, sy, sz-eps) - nz(sx+eps, sy, sz) + nz(sx-eps, sy, sz)) / (2*eps)
    cz = (ny(sx+eps, sy, sz) - ny(sx-eps, sy, sz) - nx(sx, sy+eps, sz) + nx(sx, sy-eps, sz)) / (2*eps)

    return [cx, cy, cz]


# Emitter positions: ring of 12 + center
NUM_RING = 12
emitters = []
for i in range(NUM_RING):
    angle = (i / NUM_RING) * 2 * math.pi
    emitters.append([math.cos(angle) * 2.0, 0, math.sin(angle) * 2.0])
emitters.append([0, 0, 0])  # Center emitter

# Color palette for frequency bands
COLORS = {
    'bass':     [1.0, 0.1, 0.3],     # Hot pink/red
    'low_mid':  [1.0, 0.5, 0.0],     # Orange
    'mid':      [0.0, 0.8, 1.0],     # Cyan
    'high_mid': [0.6, 0.1, 1.0],     # Purple
    'high':     [1.0, 1.0, 0.2],     # Yellow
}

particles = []
dt = 1.0 / FPS
rng = random.Random(42)

print("Simulating particles...")

for frame_idx in range(total_frames):
    frame = frame_idx + 1
    audio = audio_data[frame_idx]
    time = frame * dt

    bass = audio['bass']
    low_mid = audio['low_mid']
    mid = audio['mid']
    high_mid = audio['high_mid']
    high = audio['high']
    beat = audio['beat']
    energy = audio['energy']

    # ---- EMIT NEW PARTICLES ----
    base_emit = 3
    bass_emit = int(bass * 40)
    beat_emit = int(beat * 150)
    total_emit = base_emit + bass_emit + beat_emit

    for e in range(total_emit):
        # Pick emitter
        r = rng.random()
        if beat > 0.5 and r < 0.5:
            eidx = NUM_RING  # center
        else:
            eidx = rng.randint(0, NUM_RING - 1)

        emit_pos = list(emitters[eidx])
        # Jitter position
        emit_pos[0] += (rng.random() - 0.5) * 0.4
        emit_pos[1] += (rng.random() - 0.5) * 0.2
        emit_pos[2] += (rng.random() - 0.5) * 0.4

        # Initial velocity
        if eidx == NUM_RING:
            # Center: burst in random directions
            phi = rng.random() * 2 * math.pi
            theta = rng.random() * math.pi
            speed = 1.0 + beat * 6.0 + bass * 3.0
            vel = [
                math.sin(theta) * math.cos(phi) * speed,
                (math.cos(theta) * 0.5 + 0.8) * speed,
                math.sin(theta) * math.sin(phi) * speed
            ]
        else:
            # Ring: outward + upward spiral
            angle = (eidx / NUM_RING) * 2 * math.pi
            outward = 0.5 + energy * 2.5
            upward = 0.5 + mid * 3.0
            tangent = angle + math.pi * 0.5
            vel = [
                math.cos(angle) * outward + math.cos(tangent) * 0.5,
                upward,
                math.sin(angle) * outward + math.sin(tangent) * 0.5
            ]

        # Add velocity noise
        vel[0] += (rng.random() - 0.5) * 0.6
        vel[1] += (rng.random() - 0.5) * 0.4
        vel[2] += (rng.random() - 0.5) * 0.6

        # Life duration
        life = 1.5 + rng.random() * 3.5

        # Color from dominant frequency
        bands = {'bass': bass, 'low_mid': low_mid, 'mid': mid, 'high_mid': high_mid, 'high': high}
        dominant = max(bands, key=bands.get)
        color = list(COLORS[dominant])
        # Variation
        color[0] = max(0, min(1, color[0] + (rng.random() - 0.5) * 0.2))
        color[1] = max(0, min(1, color[1] + (rng.random() - 0.5) * 0.2))
        color[2] = max(0, min(1, color[2] + (rng.random() - 0.5) * 0.2))

        pscale = 0.03 + rng.random() * 0.08

        p = Particle(emit_pos, vel, life, color, pscale, eidx, energy)
        particles.append(p)

    # ---- UPDATE EXISTING PARTICLES ----
    alive = []
    for p in particles:
        p.age += dt
        if p.age >= p.life:
            continue

        age_ratio = p.age / p.life
        x, y, z = p.pos
        vx, vy, vz = p.vel

        # Force 1: Curl noise (mid-driven)
        noise_strength = 0.3 + mid * 2.5
        noise_scale = 0.4 + high * 0.3
        cx, cy, cz = curl_noise(x + time * 0.15, y + time * 0.1, z + time * 0.15, noise_scale)
        vx += cx * noise_strength * dt
        vy += cy * noise_strength * dt
        vz += cz * noise_strength * dt

        # Force 2: Gentle gravity
        vy -= 0.4 * dt

        # Force 3: Bass radial push
        if bass > 0.25:
            dist = vec_len(p.pos)
            if dist > 0.1:
                outward = vec_normalize(p.pos)
                push = bass * 2.5 * dt
                vx += outward[0] * push
                vy += outward[1] * push * 0.3
                vz += outward[2] * push

        # Force 4: Beat shockwave
        if beat > 0.5:
            dist = vec_len(p.pos)
            if dist > 0.1:
                outward = vec_normalize(p.pos)
                shock = 4.0 * dt / max(dist * 0.5, 0.3)
                vx += outward[0] * shock
                vy += outward[1] * shock * 0.5 + 1.0 * dt
                vz += outward[2] * shock

        # Force 5: High-freq shimmer
        if high > 0.15:
            shimmer = high * 1.5 * dt
            vx += (simple_noise_3d(x*5 + time*8, y*5, z*5) - 0.5) * shimmer
            vy += (simple_noise_3d(x*5, y*5 + time*8, z*5) - 0.5) * shimmer
            vz += (simple_noise_3d(x*5, y*5, z*5 + time*8) - 0.5) * shimmer

        # Damping
        vx *= 0.993
        vy *= 0.993
        vz *= 0.993

        # Update position
        p.pos = [x + vx * dt, y + vy * dt, z + vz * dt]
        p.vel = [vx, vy, vz]

        # Update visual properties — keep scale reasonable
        # Fade from full size to zero over lifetime
        p.pscale = (0.05 + rng.random() * 0.1) * (1.0 - age_ratio ** 1.5) * (1.0 + beat * 0.3)

        alive.append(p)

    particles = alive

    # ---- WRITE GEOMETRY ----
    geo = hou.Geometry()

    # Add attributes
    geo.addAttrib(hou.attribType.Point, "Cd", (1.0, 1.0, 1.0))
    geo.addAttrib(hou.attribType.Point, "Alpha", 1.0)
    geo.addAttrib(hou.attribType.Point, "pscale", 0.05)
    geo.addAttrib(hou.attribType.Point, "v", (0.0, 0.0, 0.0))
    geo.addAttrib(hou.attribType.Point, "age", 0.0)
    geo.addAttrib(hou.attribType.Point, "life", 1.0)

    # Store audio values as detail attributes (for shader use)
    geo.addAttrib(hou.attribType.Global, "bass", 0.0)
    geo.addAttrib(hou.attribType.Global, "beat", 0.0)
    geo.addAttrib(hou.attribType.Global, "energy", 0.0)
    geo.setGlobalAttribValue("bass", bass)
    geo.setGlobalAttribValue("beat", beat)
    geo.setGlobalAttribValue("energy", energy)

    for p in particles:
        age_ratio = p.age / p.life
        alpha = max(0, 1.0 - age_ratio ** 1.5)

        # Brighten on beats
        color = list(p.color)
        if beat > 0.5:
            color = [min(1, c + 0.3) for c in color]
        color = [c * alpha for c in color]

        pt = geo.createPoint()
        pt.setPosition(hou.Vector3(p.pos))
        pt.setAttribValue("Cd", tuple(color))
        pt.setAttribValue("Alpha", alpha)
        pt.setAttribValue("pscale", max(0.005, p.pscale))
        pt.setAttribValue("v", tuple(p.vel))
        pt.setAttribValue("age", p.age)
        pt.setAttribValue("life", p.life)

    # Save geometry
    geo_path = os.path.join(GEO_DIR, f"particles.{frame:04d}.bgeo.sc")
    geo.saveToFile(geo_path)

    if frame % 50 == 0 or frame <= 5:
        print(f"  Frame {frame}/{total_frames}: {len(particles)} particles")

print(f"\nBaked {total_frames} frames to {GEO_DIR}/")

# ============================================================
# Build Houdini scene with renderable particles + emissive material
# ============================================================
print("\nBuilding Houdini scene...")
hou.hipFile.clear()
hou.setFps(FPS)
hou.playbar.setFrameRange(1, total_frames)
hou.playbar.setPlaybackRange(1, total_frames)

obj = hou.node("/obj")

# ---- CREATE EMISSIVE MATERIAL ----
matlib = obj.createNode("matnet", "materials")

# Build a Principled Shader with emission
principled = matlib.createNode("principledshader::2.0", "particle_glow")
# Make it emissive — color comes from Cd attribute
principled.parm("basecolorr").set(1)
principled.parm("basecolorg").set(1)
principled.parm("basecolorb").set(1)
principled.parm("basecolor_usePointColor").set(1)  # Use Cd attribute
principled.parm("basecolor_usePackedColor").set(1)  # Use Cd from packed instances
# Enable emission
principled.parm("emitcolorr").set(1)
principled.parm("emitcolorg").set(1)
principled.parm("emitcolorb").set(1)
principled.parm("emitcolor_usePointColor").set(1)
principled.parm("emitint").set(3.0)  # Emission intensity for glow
# Low roughness for shiny look
principled.parm("rough").set(0.1)
principled.parm("reflect").set(0.5)

# ---- PARTICLES geo node ----
particle_geo = obj.createNode("geo", "PARTICLES")
for child in particle_geo.children():
    child.destroy()

# File SOP loads the baked sequence
file_sop = particle_geo.createNode("file", "load_particles")
file_sop.parm("file").set(os.path.join(GEO_DIR, "particles.$F4.bgeo.sc"))

# Boost scale for visibility
boost = particle_geo.createNode("attribwrangle", "boost_scale")
boost.setInput(0, file_sop)
boost.parm("class").set(1)  # Point
boost.parm("snippet").set("""
// Ensure minimum visible size
f@pscale = max(f@pscale, 0.04);

// Vivid colors
v@Cd = clamp(v@Cd * 1.5, 0, 1);
""")

# Add width attribute for Mantra sphere rendering (width = pscale * 2)
add_width = particle_geo.createNode("attribwrangle", "add_render_attribs")
add_width.setInput(0, boost)
add_width.parm("class").set(1)  # Point
add_width.parm("snippet").set("""
// Mantra renders points as spheres when they have 'width'
f@width = f@pscale * 2.0;
""")

# Assign the emissive material
material_assign = particle_geo.createNode("material", "assign_material")
material_assign.setInput(0, add_width)
material_assign.parm("shop_materialpath1").set("/obj/materials/particle_glow")

# Output null
out = particle_geo.createNode("null", "OUT")
out.setInput(0, material_assign)
out.setDisplayFlag(True)
out.setRenderFlag(True)

# Layout inside the geo node
particle_geo.layoutChildren()

# ---- GROUND PLANE (dark, reflective) ----
ground_geo = obj.createNode("geo", "GROUND")
for child in ground_geo.children():
    child.destroy()
grid = ground_geo.createNode("grid", "floor")
grid.parm("sizex").set(40)
grid.parm("sizey").set(40)
grid.parm("rows").set(2)
grid.parm("cols").set(2)
# Dark material
ground_mat = matlib.createNode("principledshader::2.0", "dark_floor")
ground_mat.parm("basecolorr").set(0.02)
ground_mat.parm("basecolorg").set(0.02)
ground_mat.parm("basecolorb").set(0.03)
ground_mat.parm("rough").set(0.3)
ground_mat.parm("reflect").set(0.5)
ground_assign = ground_geo.createNode("material", "assign_mat")
ground_assign.setInput(0, grid)
ground_assign.parm("shop_materialpath1").set("/obj/materials/dark_floor")
ground_out = ground_geo.createNode("null", "OUT")
ground_out.setInput(0, ground_assign)
ground_out.setDisplayFlag(True)
ground_out.setRenderFlag(True)
ground_geo.layoutChildren()
# Move ground down slightly
ground_geo.parmTuple("t").set((0, -0.5, 0))

# ---- CAMERA ----
cam = obj.createNode("cam", "render_cam")
cam.parmTuple("t").set((8, 5, 8))
cam.parmTuple("r").set((-22, 45, 0))
cam.parm("resx").set(1280)
cam.parm("resy").set(720)
cam.parm("near").set(0.1)

# ---- LIGHTS ----
# Key light
key_light = obj.createNode("hlight", "key_light")
key_light.parmTuple("t").set((5, 10, 5))
key_light.parmTuple("r").set((-60, 30, 0))
key_light.parm("light_intensity").set(0.8)
key_light.parm("light_type").set(7)  # Distant light

# Dim environment for ambient fill
env_light = obj.createNode("envlight", "env_light")
env_light.parm("light_intensity").set(0.15)

# ---- Layout all obj-level nodes ----
obj.layoutChildren()

# ---- Save ----
hou.hipFile.save(HIP_PATH)
print(f"\nScene saved: {HIP_PATH}")
print(f"Frame range: 1-{total_frames} ({total_frames/FPS:.0f} seconds)")
print(f"\nOpen in Houdini:")
print(f"  1. File > Open > music_particles_v2.hip")
print(f"  2. Click PARTICLES in the network editor")
print(f"  3. Press Play (spacebar) to animate")
print(f"  4. Switch to Render View tab and click 'Render' to see lit/glowing result")
print(f"  5. Trackpad: Option+swipe=orbit, Option+Shift+swipe=pan, Option+Cmd+swipe=zoom")
