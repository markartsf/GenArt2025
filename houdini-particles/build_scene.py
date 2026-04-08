#!/usr/bin/env python3
"""
Build a Houdini scene with music-reactive particle system.

Run with hython:
  hython build_scene.py

The scene features:
- Multiple emitter points arranged in a ring
- Particle birth rate driven by bass/beats
- Curl noise forces modulated by mid frequencies
- Color driven by frequency spectrum
- Particle trails for visual richness
"""

import hou
import csv
import os
import math

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, "audio_data.csv")
HIP_PATH = os.path.join(SCRIPT_DIR, "music_particles.hip")
FPS = 24
TOTAL_FRAMES = 5899

print("Building music-reactive particle scene...")

# ============================================================
# Load audio data
# ============================================================
audio_data = []
with open(CSV_PATH, 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        audio_data.append({k: float(v) for k, v in row.items()})

print(f"Loaded {len(audio_data)} frames of audio data")

# ============================================================
# Scene setup
# ============================================================
hou.hipFile.clear()
hou.setFps(FPS)
hou.playbar.setFrameRange(1, TOTAL_FRAMES)
hou.playbar.setPlaybackRange(1, TOTAL_FRAMES)

obj = hou.node("/obj")

# ============================================================
# 1. AUDIO DATA node — stores frequency data as point attributes
# ============================================================
audio_geo = obj.createNode("geo", "AUDIO_DATA")
audio_geo.moveToGoodPosition()
# Remove default file node
for child in audio_geo.children():
    child.destroy()

# Create a single point that carries audio attributes per frame
audio_wrangle = audio_geo.createNode("attribwrangle", "audio_attributes")
audio_wrangle.parm("class").set(0)  # Detail attribute
audio_wrangle.parm("snippet").set("""
// Audio data is set via keyframes on spare parameters
// This wrangle reads them and stores as detail attributes
f@bass = ch("bass");
f@low_mid = ch("low_mid");
f@mid = ch("mid");
f@high_mid = ch("high_mid");
f@high = ch("high");
f@beat = ch("beat");
f@energy = ch("energy");
""")

# Add spare parameters for each audio channel
ptg = audio_wrangle.parmTemplateGroup()
for chan_name in ['bass', 'low_mid', 'mid', 'high_mid', 'high', 'beat', 'energy']:
    parm = hou.FloatParmTemplate(chan_name, chan_name, 1, default_value=(0.0,))
    ptg.addParmTemplate(parm)
audio_wrangle.setParmTemplateGroup(ptg)

# Set keyframes from CSV data
print("Setting audio keyframes...")
for chan_name in ['bass', 'low_mid', 'mid', 'high_mid', 'high', 'beat', 'energy']:
    parm = audio_wrangle.parm(chan_name)
    # Sample every frame — for efficiency, skip frames with no change for beat
    for row in audio_data:
        frame = int(row['frame'])
        kf = hou.Keyframe()
        kf.setFrame(frame)
        kf.setValue(row[chan_name])
        kf.setExpression("linear()", hou.exprLanguage.Hscript)
        parm.setKeyframe(kf)

    if (audio_data.index(row) + 1) % 1000 == 0:
        print(f"  Keyframed {chan_name}...")

# Add a null as output
audio_out = audio_geo.createNode("null", "AUDIO_OUT")
audio_out.setInput(0, audio_wrangle)
audio_out.setDisplayFlag(True)
audio_out.setRenderFlag(True)

print("Audio data node complete.")

# ============================================================
# 2. EMITTER geometry — ring of points + center
# ============================================================
emitter_geo = obj.createNode("geo", "EMITTER")
emitter_geo.moveToGoodPosition()
for child in emitter_geo.children():
    child.destroy()

# Create a circle of emitter points
emitter_wrangle = emitter_geo.createNode("attribwrangle", "create_emitters")
emitter_wrangle.parm("class").set(0)  # Detail
emitter_wrangle.parm("snippet").set("""
// Create a ring of emitter points
int num_emitters = 12;
float radius = 2.0;

for (int i = 0; i < num_emitters; i++) {
    float angle = (float(i) / float(num_emitters)) * 2.0 * PI;
    vector pos = set(cos(angle) * radius, 0, sin(angle) * radius);
    int pt = addpoint(0, pos);
    setpointattrib(0, "emitter_id", pt, i);
    setpointattrib(0, "emitter_angle", pt, angle);
}

// Center emitter for bass hits
int center = addpoint(0, {0, 0, 0});
setpointattrib(0, "emitter_id", center, num_emitters);
setpointattrib(0, "emitter_angle", center, 0.0);
""")

emitter_out = emitter_geo.createNode("null", "EMITTER_OUT")
emitter_out.setInput(0, emitter_wrangle)
emitter_out.setDisplayFlag(True)
emitter_out.setRenderFlag(True)

# ============================================================
# 3. PARTICLE SYSTEM — the main event
# ============================================================
particle_geo = obj.createNode("geo", "PARTICLES")
particle_geo.moveToGoodPosition()
for child in particle_geo.children():
    child.destroy()

# --- Object merge to bring in emitter points ---
merge_emitter = particle_geo.createNode("object_merge", "get_emitters")
merge_emitter.parm("objpath1").set("/obj/EMITTER/EMITTER_OUT")

# --- Solver SOP for particle simulation ---
solver = particle_geo.createNode("solver", "particle_solver")
solver.setInput(0, merge_emitter)

# Unlock the solver so we can create nodes inside it
solver.allowEditingOfContents()

# The SOP solver structure: solver > d (dopnet) > s (sopsolver) > SOP network
# Inside d/s/ we have: Prev_Frame (previous frame geo), Input_1..4, and OUT
solver_sop = solver.node("d/s")  # The sopsolver DOP containing our SOP network
prev_frame = solver_sop.node("Prev_Frame")
out_node = solver_sop.node("OUT")

# Create the wrangle that does all the particle work
particle_wrangle = solver_sop.createNode("attribwrangle", "particle_sim")
particle_wrangle.parm("class").set(0)  # Detail mode - we manage all points
particle_wrangle.parm("snippet").set('''
// ============================================================
// MUSIC-REACTIVE PARTICLE SYSTEM
// ============================================================

// Read audio data from the AUDIO_DATA node
float bass = detail("op:/obj/AUDIO_DATA/AUDIO_OUT", "bass", 0);
float low_mid = detail("op:/obj/AUDIO_DATA/AUDIO_OUT", "low_mid", 0);
float mid = detail("op:/obj/AUDIO_DATA/AUDIO_OUT", "mid", 0);
float high_mid = detail("op:/obj/AUDIO_DATA/AUDIO_OUT", "high_mid", 0);
float high = detail("op:/obj/AUDIO_DATA/AUDIO_OUT", "high", 0);
float beat = detail("op:/obj/AUDIO_DATA/AUDIO_OUT", "beat", 0);
float energy = detail("op:/obj/AUDIO_DATA/AUDIO_OUT", "energy", 0);

float dt = 1.0 / 24.0;
float time = @Frame / 24.0;

// ============================================================
// EMIT NEW PARTICLES
// ============================================================
// Base emission + bass-driven bursts + beat explosions
int base_emit = 5;
int bass_emit = int(bass * 80);
int beat_emit = int(beat * 200);
int total_emit = base_emit + bass_emit + beat_emit;

// Emit from emitter points (ring positions)
int num_emitters = 13; // 12 ring + 1 center
for (int e = 0; e < total_emit; e++) {
    // Pick an emitter — beats favor center, bass favors ring
    int emitter_idx;
    float r = random(time * 1000 + e * 7.31);
    if (beat > 0.5 && r < 0.6) {
        emitter_idx = 12; // center
    } else {
        emitter_idx = int(random(time * 500 + e * 3.17) * 12) % 12;
    }

    float angle = (float(emitter_idx) / 12.0) * 2.0 * PI;
    float radius = 2.0;
    vector emit_pos;
    if (emitter_idx == 12) {
        emit_pos = {0, 0, 0};
    } else {
        emit_pos = set(cos(angle) * radius, 0, sin(angle) * radius);
    }

    // Add some randomness to position
    emit_pos += (vector(random(time * 200 + e * 13.7 + 0.1)) - 0.5) * 0.3;

    int pt = addpoint(0, emit_pos);

    // Initial velocity — outward + upward, modulated by energy
    vector vel;
    if (emitter_idx == 12) {
        // Center: burst outward in all directions on beats
        float phi = random(time * 300 + e * 5.1) * 2.0 * PI;
        float theta = random(time * 300 + e * 9.3) * PI;
        float speed = (1.0 + beat * 5.0 + bass * 2.0);
        vel = set(sin(theta)*cos(phi), cos(theta)*0.5 + 0.5, sin(theta)*sin(phi)) * speed;
    } else {
        // Ring: spiral outward + upward
        float outward = 0.5 + energy * 2.0;
        float upward = 0.3 + mid * 2.0;
        vel = set(cos(angle) * outward, upward, sin(angle) * outward);
        // Add spiral spin
        float tangent_angle = angle + PI * 0.5;
        vel += set(cos(tangent_angle), 0, sin(tangent_angle)) * 0.5;
    }

    // Add velocity noise
    vel += (vector(random(time * 100 + e * 17.3 + 0.5)) - 0.5) * 0.5;

    setpointattrib(0, "v", pt, vel);
    setpointattrib(0, "age", pt, 0.0);
    setpointattrib(0, "life", pt, 2.0 + random(time * 50 + e * 2.7) * 4.0);
    setpointattrib(0, "pscale", pt, 0.02 + random(time * 80 + e * 1.1) * 0.06);

    // Color based on which frequency band is dominant
    vector col;
    float max_band = max(bass, max(low_mid, max(mid, max(high_mid, high))));
    if (max_band == bass) {
        col = set(1.0, 0.1, 0.2);        // Deep red/magenta for bass
    } else if (max_band == low_mid) {
        col = set(1.0, 0.4, 0.0);        // Orange for low-mid
    } else if (max_band == mid) {
        col = set(0.1, 0.8, 1.0);        // Cyan for mids
    } else if (max_band == high_mid) {
        col = set(0.5, 0.2, 1.0);        // Purple for high-mid
    } else {
        col = set(1.0, 1.0, 0.3);        // Yellow for highs
    }
    // Add some color variation
    col += (vector(random(time * 60 + e * 4.4)) - 0.5) * 0.2;
    col = clamp(col, 0, 1);
    setpointattrib(0, "Cd", pt, col);

    // Store birth energy for later use
    setpointattrib(0, "birth_energy", pt, energy);
    setpointattrib(0, "emitter", pt, emitter_idx);
}

// ============================================================
// UPDATE EXISTING PARTICLES
// ============================================================
int num_pts = npoints(0);
int to_remove[];

for (int i = 0; i < num_pts - total_emit; i++) {
    float age = point(0, "age", i);
    float life = point(0, "life", i);

    // Age the particle
    age += dt;
    setpointattrib(0, "age", i, age);

    // Remove dead particles
    if (age > life) {
        append(to_remove, i);
        continue;
    }

    float age_ratio = age / life;

    // Get current velocity
    vector vel = point(0, "v", i);
    vector pos = point(0, "P", i);

    // --- FORCE 1: Curl noise (modulated by mid frequencies) ---
    float noise_strength = 0.5 + mid * 3.0;
    float noise_scale = 0.3 + high * 0.5;
    vector noise_pos = pos * noise_scale + time * 0.2;
    // Approximate curl noise using offset noise samples
    float eps = 0.01;
    vector n1 = vector(noise(noise_pos + set(0, eps, 0)));
    vector n2 = vector(noise(noise_pos - set(0, eps, 0)));
    vector n3 = vector(noise(noise_pos + set(0, 0, eps)));
    vector n4 = vector(noise(noise_pos - set(0, 0, eps)));
    vector n5 = vector(noise(noise_pos + set(eps, 0, 0)));
    vector n6 = vector(noise(noise_pos - set(eps, 0, 0)));
    vector curl = set(
        (n1.z - n2.z) - (n3.y - n4.y),
        (n3.x - n4.x) - (n5.z - n6.z),
        (n5.y - n6.y) - (n1.x - n2.x)
    ) / (2.0 * eps);
    vel += curl * noise_strength * dt;

    // --- FORCE 2: Gravity (subtle) ---
    vel.y -= 0.3 * dt;

    // --- FORCE 3: Bass pulse — radial push outward ---
    if (bass > 0.3) {
        vector to_center = -normalize(pos);
        vel -= to_center * bass * 2.0 * dt;  // Push outward
    }

    // --- FORCE 4: Beat shockwave ---
    if (beat > 0.5) {
        float dist = length(pos);
        if (dist > 0.01) {
            vector outward = normalize(pos);
            vel += outward * 3.0 * dt / max(dist * 0.5, 0.5);
        }
    }

    // --- FORCE 5: High frequency shimmer ---
    if (high > 0.2) {
        vector shimmer = vector(noise(pos * 5.0 + time * 10.0));
        vel += (shimmer - 0.5) * high * 2.0 * dt;
    }

    // Damping
    vel *= 0.995;

    // Update position
    pos += vel * dt;
    setpointattrib(0, "v", i, vel);
    setpointattrib(0, "P", i, pos);

    // Update scale — shrink as particle ages
    float base_scale = point(0, "pscale", i);
    float scale_mult = 1.0 - pow(age_ratio, 2.0);
    // Beats cause momentary scale pulse
    scale_mult *= (1.0 + beat * 0.5);
    setpointattrib(0, "pscale", i, base_scale * max(scale_mult, 0.001));

    // Update color — shift hue over lifetime, brighten on beats
    vector col = point(0, "Cd", i);
    // Fade alpha with age
    float alpha = 1.0 - pow(age_ratio, 1.5);
    // Brighten on beats
    if (beat > 0.5) {
        col = lerp(col, {1, 1, 1}, 0.3);
    }
    col *= alpha;
    setpointattrib(0, "Cd", i, col);
    setpointattrib(0, "Alpha", i, alpha);
}

// Remove dead particles (reverse order to preserve indices)
for (int i = len(to_remove) - 1; i >= 0; i--) {
    removepoint(0, to_remove[i]);
}
''')

# Wire it up inside the solver: Prev_Frame -> wrangle -> OUT
particle_wrangle.setInput(0, prev_frame)
out_node.setInput(0, particle_wrangle)
particle_wrangle.setDisplayFlag(True)
particle_wrangle.setRenderFlag(True)

# --- Trail SOP for particle ribbons ---
trail = particle_geo.createNode("trail", "particle_trails")
trail.setInput(0, solver)
trail.parm("result").set(1)   # Connect trail points into lines
trail.parm("length").set(6)   # 6 frame trail length

# --- Add width to trails based on age ---
trail_width = particle_geo.createNode("attribwrangle", "trail_width")
trail_width.setInput(0, trail)
trail_width.parm("class").set(1)  # Point
trail_width.parm("snippet").set("""
float alpha = f@Alpha;
f@width = 0.01 + alpha * 0.02;
""")

# --- Output merge: points + trails ---
merge = particle_geo.createNode("merge", "merge_output")
merge.setInput(0, solver)
merge.setInput(1, trail_width)

# Final output
particle_out = particle_geo.createNode("null", "PARTICLE_OUT")
particle_out.setInput(0, merge)
particle_out.setDisplayFlag(True)
particle_out.setRenderFlag(True)

# ============================================================
# 4. CAMERA
# ============================================================
cam = obj.createNode("cam", "render_cam")
cam.parmTuple("t").set((8, 5, 8))
cam.parmTuple("r").set((-25, 45, 0))
cam.parm("resx").set(1920)
cam.parm("resy").set(1080)

# ============================================================
# 5. ENVIRONMENT LIGHT
# ============================================================
env_light = obj.createNode("envlight", "env_light")
env_light.parm("light_intensity").set(0.3)

# ============================================================
# Layout
# ============================================================
obj.layoutChildren()

# ============================================================
# Save
# ============================================================
hou.hipFile.save(HIP_PATH)
print(f"\nScene saved to: {HIP_PATH}")
print(f"\nTo open: Launch Houdini and open {HIP_PATH}")
print(f"Frame range: 1-{TOTAL_FRAMES} ({TOTAL_FRAMES/FPS:.1f} seconds)")
print(f"\nInside Houdini:")
print(f"  1. Click on PARTICLES node")
print(f"  2. Press Play on the timeline")
print(f"  3. Watch particles react to the music!")
print(f"  4. For rendering, switch to the Karma renderer")
