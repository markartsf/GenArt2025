#ifdef GL_ES
precision mediump float;
#endif

// Uniforms from p5.js
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_fft[16]; // Array of 16 FFT frequency bins

// Helper function to convert HSV to RGB color space
vec3 hsv(float h, float s, float v) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(vec3(h) + K.xyz) * 6.0 - K.www);
  return v * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), s);
}

void main() {
    // Output color
    vec4 o = vec4(0.0);

    // Unpack variables from the original shader
    float i = 0.0, e = 0.0, g = 0.0, R = 0.0, s = 0.0;
    vec3 p;
    // Initialize q so that q.yz-- results in a starting position
    vec3 q = vec3(0.0, 1.0, 1.0);

    // Normalize fragment coordinates and set up the ray direction
    // Aspect-correct the coordinates by dividing by the y-resolution
    vec3 d = vec3((gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y, 0.57);
    
    // Get an audio value from the FFT data (bass/low-mids)
    float audio = u_fft[2] / 255.0;

    q.yz--; // Original code: q.yz--

    // Raymarching loop
    for(i = 0.0; i < 79.0; i++) {
        // Clamp the brightness argument to be non-negative
        float brightness = max(0.0, e - e * i / 4.5);
        o.rgb -= hsv(0.58, R + g * 0.18, brightness);
        
        s = 2.8;

        // Add audio influence to ray marching step
        p = q += d * e * R * (0.6 + audio * 0.4); 

        g += p.y / s;
        p = vec3(R = length(p), exp2(mod(-0.25 - p.z, s) / R), p);
        e = --p.y;

        // Inner loop for distance estimation. Corrected to 9 iterations.
        for(int j = 0; j < 9; j++) {
            if (s >= 1000.0) break; // safeguard
            e -= abs(dot(sin(p.xzy * s + e * p.y), cos(p.zzz * s - e)) / s * 0.32);
            s += s;
        }
    }

    // Final color modification based on audio intensity
    o.rgb += audio * 0.1;

    gl_FragColor = vec4(o.rgb, 1.0);
}
