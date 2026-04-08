#!/usr/bin/env python3
"""
Analyze an audio file and export per-frame FFT band data + beat detection
for use in Houdini particle systems.

Outputs a CSV with columns:
  frame, bass, low_mid, mid, high_mid, high, beat, energy
"""

import sys
import subprocess
import os
import csv
import struct
import wave
import math

FPS = 24
HOP_SIZE_FACTOR = 1  # 1 = one FFT window per frame


def decode_mp3_to_wav(mp3_path, wav_path):
    """Convert MP3 to WAV using ffmpeg."""
    subprocess.run([
        "ffmpeg", "-y", "-i", mp3_path,
        "-ar", "44100", "-ac", "1", "-sample_fmt", "s16",
        wav_path
    ], capture_output=True, check=True)
    print(f"Converted to WAV: {wav_path}")


def read_wav(wav_path):
    """Read WAV file and return (samples_as_floats, sample_rate)."""
    with wave.open(wav_path, 'r') as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        sample_rate = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    if sampwidth == 2:
        fmt = f"<{n_frames * n_channels}h"
        int_samples = struct.unpack(fmt, raw)
        max_val = 32768.0
    elif sampwidth == 4:
        fmt = f"<{n_frames * n_channels}i"
        int_samples = struct.unpack(fmt, raw)
        max_val = 2147483648.0
    else:
        raise ValueError(f"Unsupported sample width: {sampwidth}")

    # Mix to mono if stereo
    if n_channels == 2:
        samples = [(int_samples[i] + int_samples[i+1]) / (2.0 * max_val)
                    for i in range(0, len(int_samples), 2)]
    else:
        samples = [s / max_val for s in int_samples]

    return samples, sample_rate


def hann_window(n):
    """Generate a Hann window of size n."""
    return [0.5 * (1 - math.cos(2 * math.pi * i / (n - 1))) for i in range(n)]


def fft_magnitudes(chunk):
    """Compute FFT magnitudes using DFT (no numpy needed).
    Uses a simple power-of-2 Cooley-Tukey FFT.
    """
    n = len(chunk)
    # Pad to next power of 2
    p = 1
    while p < n:
        p *= 2
    padded = chunk + [0.0] * (p - n)
    mags = _fft(padded)
    # Return only first half (positive frequencies)
    return mags[:p // 2]


def _fft(x):
    """Recursive Cooley-Tukey FFT, returns magnitudes."""
    n = len(x)
    if n <= 1:
        return [abs(x[0])]

    if n == 2:
        return [abs(x[0] + x[1]), abs(x[0] - x[1])]

    # Split into even/odd using complex arithmetic
    # For efficiency with pure Python, use iterative approach for small sizes
    even = x[0::2]
    odd = x[1::2]

    # Recursive FFT on halves
    fe = _fft_complex(even)
    fo = _fft_complex(odd)

    result = [0.0] * n
    for k in range(n // 2):
        angle = -2 * math.pi * k / n
        twiddle_re = math.cos(angle)
        twiddle_im = math.sin(angle)
        fo_re, fo_im = fo[k]
        t_re = twiddle_re * fo_re - twiddle_im * fo_im
        t_im = twiddle_re * fo_im + twiddle_im * fo_re
        fe_re, fe_im = fe[k]
        result[k] = math.sqrt((fe_re + t_re)**2 + (fe_im + t_im)**2)
        result[k + n//2] = math.sqrt((fe_re - t_re)**2 + (fe_im - t_im)**2)

    return result


def _fft_complex(x):
    """Recursive FFT returning complex pairs [(re, im), ...]."""
    n = len(x)
    if n == 1:
        val = x[0] if isinstance(x[0], (int, float)) else x[0]
        if isinstance(val, tuple):
            return [val]
        return [(float(val), 0.0)]

    even = x[0::2]
    odd = x[1::2]

    fe = _fft_complex(even)
    fo = _fft_complex(odd)

    result = [(0.0, 0.0)] * n
    for k in range(n // 2):
        angle = -2 * math.pi * k / n
        tw_re = math.cos(angle)
        tw_im = math.sin(angle)
        fo_re, fo_im = fo[k]
        t_re = tw_re * fo_re - tw_im * fo_im
        t_im = tw_re * fo_im + tw_im * fo_re
        fe_re, fe_im = fe[k]
        result[k] = (fe_re + t_re, fe_im + t_im)
        result[k + n//2] = (fe_re - t_re, fe_im - t_im)

    return result


def analyze_audio(samples, sample_rate, fps=24):
    """Analyze audio and return per-frame data."""
    samples_per_frame = sample_rate // fps
    # Use a window size that's a power of 2, close to samples_per_frame
    fft_size = 1
    while fft_size < samples_per_frame:
        fft_size *= 2

    window = hann_window(fft_size)
    total_frames = len(samples) // samples_per_frame
    freq_per_bin = sample_rate / fft_size

    # Define frequency band ranges (in Hz)
    bands = {
        'bass': (20, 150),
        'low_mid': (150, 500),
        'mid': (500, 2000),
        'high_mid': (2000, 6000),
        'high': (6000, 20000),
    }

    # Convert Hz ranges to bin indices
    band_bins = {}
    for name, (lo, hi) in bands.items():
        lo_bin = max(1, int(lo / freq_per_bin))
        hi_bin = min(fft_size // 2 - 1, int(hi / freq_per_bin))
        band_bins[name] = (lo_bin, hi_bin)

    results = []
    prev_energy = 0.0
    energy_history = []

    print(f"Analyzing {total_frames} frames at {fps} FPS...")
    print(f"FFT size: {fft_size}, Freq resolution: {freq_per_bin:.1f} Hz/bin")

    # For very large files, this pure-Python FFT will be slow.
    # Try to use numpy if available, fall back to pure Python.
    use_numpy = False
    try:
        import numpy as np
        use_numpy = True
        print("Using numpy for FFT (fast)")
        window_np = np.hanning(fft_size)
    except ImportError:
        print("Using pure Python FFT (this may take a while for long audio)...")

    for frame in range(total_frames):
        start = frame * samples_per_frame
        chunk = samples[start:start + fft_size]
        if len(chunk) < fft_size:
            chunk = chunk + [0.0] * (fft_size - len(chunk))

        if use_numpy:
            windowed = np.array(chunk) * window_np
            spectrum = np.abs(np.fft.rfft(windowed))
            mags = spectrum.tolist()
        else:
            windowed = [chunk[i] * window[i] for i in range(fft_size)]
            mags = fft_magnitudes(windowed)

        # Extract band energies
        band_values = {}
        for name, (lo_bin, hi_bin) in band_bins.items():
            if hi_bin >= len(mags):
                hi_bin = len(mags) - 1
            if lo_bin > hi_bin:
                band_values[name] = 0.0
                continue
            band_mags = mags[lo_bin:hi_bin + 1]
            band_values[name] = sum(m * m for m in band_mags) / len(band_mags)

        # Total energy for beat detection
        total_energy = sum(band_values.values())
        energy_history.append(total_energy)

        # Simple beat detection: energy spike relative to recent average
        window_size = min(len(energy_history), int(fps * 0.5))  # 0.5 sec window
        if window_size > 0:
            recent_avg = sum(energy_history[-window_size:]) / window_size
            beat = 1.0 if total_energy > recent_avg * 1.8 and total_energy > prev_energy * 1.3 else 0.0
        else:
            beat = 0.0

        results.append({
            'frame': frame + 1,  # Houdini is 1-indexed
            'bass': band_values['bass'],
            'low_mid': band_values['low_mid'],
            'mid': band_values['mid'],
            'high_mid': band_values['high_mid'],
            'high': band_values['high'],
            'beat': beat,
            'energy': total_energy,
        })

        prev_energy = total_energy

        if (frame + 1) % 100 == 0:
            print(f"  Frame {frame + 1}/{total_frames}")

    # Normalize all band values to 0-1 range
    for key in ['bass', 'low_mid', 'mid', 'high_mid', 'high', 'energy']:
        max_val = max(r[key] for r in results) if results else 1.0
        if max_val > 0:
            for r in results:
                r[key] = r[key] / max_val

    return results


def write_csv(results, output_path):
    """Write analysis results to CSV."""
    fieldnames = ['frame', 'bass', 'low_mid', 'mid', 'high_mid', 'high', 'beat', 'energy']
    with open(output_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in results:
            # Round floats
            rounded = {k: (round(v, 6) if isinstance(v, float) else v) for k, v in row.items()}
            writer.writerow(rounded)
    print(f"Wrote {len(results)} frames to {output_path}")


def main():
    if len(sys.argv) < 2:
        mp3_path = "/Users/markgould/Documents/GenArt2025/audio-brush-wanderer/GlassHorizon.mp3"
    else:
        mp3_path = sys.argv[1]

    base_dir = os.path.dirname(os.path.abspath(__file__))
    wav_path = os.path.join(base_dir, "audio_temp.wav")
    csv_path = os.path.join(base_dir, "audio_data.csv")

    print(f"Analyzing: {mp3_path}")

    # Step 1: Convert to WAV
    decode_mp3_to_wav(mp3_path, wav_path)

    # Step 2: Read WAV
    samples, sample_rate = read_wav(wav_path)
    duration = len(samples) / sample_rate
    print(f"Duration: {duration:.1f}s, Sample rate: {sample_rate}")

    # Step 3: Analyze
    results = analyze_audio(samples, sample_rate, fps=FPS)

    # Step 4: Export
    write_csv(results, csv_path)

    # Cleanup temp WAV
    os.remove(wav_path)
    print(f"\nDone! Audio data ready at: {csv_path}")
    print(f"Total frames: {len(results)} ({duration:.1f}s at {FPS} FPS)")

    # Print some stats
    beat_count = sum(1 for r in results if r['beat'] > 0.5)
    print(f"Beats detected: {beat_count}")


if __name__ == "__main__":
    main()
