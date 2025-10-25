import { FallColors } from './colorPalette.js';

// Enhanced audio analysis with pitch detection and octave mapping
export class AudioAnalysisV2 {
  constructor() {
    // Musical note frequencies (A4 = 440Hz)
    this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Octave ranges for visual mapping
    this.octaves = {
      subBass: { min: 20, max: 60, color: 6 },      // Burgundy
      bass: { min: 60, max: 250, color: 5 },        // Brown
      lowMid: { min: 250, max: 500, color: 4 },     // Neutral Orange
      mid: { min: 500, max: 2000, color: 3 },       // Cadmium Orange
      highMid: { min: 2000, max: 4000, color: 2 },  // Naphthol Red
      presence: { min: 4000, max: 6000, color: 1 }, // Cadmium Yellow
      brilliance: { min: 6000, max: 20000, color: 0 } // Neutral Yellow
    };

    // Musical scales for color harmony
    this.scales = {
      chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      major: [0, 2, 4, 5, 7, 9, 11],
      minor: [0, 2, 3, 5, 7, 8, 10],
      pentatonic: [0, 2, 4, 7, 9]
    };
  }

  // Detect dominant pitch from frequency spectrum
  detectPitch(spectrum, sampleRate = 44100) {
    if (!spectrum || spectrum.length === 0) return null;

    // Find peak frequency
    let maxMagnitude = -Infinity;
    let peakBin = 0;

    for (let i = 1; i < spectrum.length; i++) {
      if (spectrum[i] > maxMagnitude) {
        maxMagnitude = spectrum[i];
        peakBin = i;
      }
    }

    // Convert bin to frequency
    const frequency = (peakBin * sampleRate) / (spectrum.length * 2);

    // Require minimum magnitude threshold
    if (maxMagnitude < 0.01) return null;

    return {
      frequency,
      magnitude: maxMagnitude,
      note: this.frequencyToNote(frequency),
      octave: this.getOctave(frequency),
      midiNote: this.frequencyToMidi(frequency)
    };
  }

  // Convert frequency to musical note
  frequencyToNote(frequency) {
    if (frequency < 20) return null;

    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const rounded = Math.round(noteNum);
    const cents = Math.round((noteNum - rounded) * 100);
    const octave = Math.floor((rounded + 57) / 12);
    const noteName = this.noteNames[(rounded + 9 + 120) % 12];

    return {
      name: noteName,
      octave: octave,
      cents: cents,
      full: `${noteName}${octave}`
    };
  }

  // Convert frequency to MIDI note number
  frequencyToMidi(frequency) {
    return Math.round(69 + 12 * Math.log2(frequency / 440));
  }

  // Get octave category for visual mapping
  getOctave(frequency) {
    for (const [name, range] of Object.entries(this.octaves)) {
      if (frequency >= range.min && frequency < range.max) {
        return { name, colorIndex: range.color, frequency };
      }
    }
    return { name: 'unknown', colorIndex: 3, frequency };
  }

  // Analyze frequency spectrum by octave bands
  analyzeOctaveBands(spectrum, sampleRate = 44100) {
    const bands = {};

    for (const [name, range] of Object.entries(this.octaves)) {
      const startBin = Math.floor((range.min * spectrum.length * 2) / sampleRate);
      const endBin = Math.floor((range.max * spectrum.length * 2) / sampleRate);

      let sum = 0;
      let count = 0;

      for (let i = startBin; i < endBin && i < spectrum.length; i++) {
        sum += spectrum[i];
        count++;
      }

      bands[name] = {
        energy: count > 0 ? sum / count : 0,
        colorIndex: range.colorIndex,
        range: range
      };
    }

    return bands;
  }

  // Get harmonic series for a fundamental frequency
  getHarmonics(fundamental, maxHarmonics = 8) {
    const harmonics = [];
    for (let i = 1; i <= maxHarmonics; i++) {
      harmonics.push({
        frequency: fundamental * i,
        harmonic: i,
        note: this.frequencyToNote(fundamental * i)
      });
    }
    return harmonics;
  }

  // Map pitch to color index (chromatic mapping)
  pitchToColorIndex(pitch) {
    if (!pitch || !pitch.note) return 3; // Default to middle color

    const noteIndex = this.noteNames.indexOf(pitch.note.name);
    return Math.floor((noteIndex / 12) * FallColors.palette.length);
  }

  // Create smooth color transitions based on pitch
  getPitchColor(pitch, audioFeatures, alpha = 1) {
    if (!pitch) return FallColors.getColor(3, alpha);

    const colorIndex = this.pitchToColorIndex(pitch);
    return FallColors.getAudioColor(colorIndex, audioFeatures, alpha);
  }

  // Get color based on frequency range (octave-based)
  getOctaveColor(frequency, audioFeatures, alpha = 1) {
    const octave = this.getOctave(frequency);
    return FallColors.getAudioColor(octave.colorIndex, audioFeatures, alpha);
  }

  // Detect melodic movement (pitch changes over time)
  analyzeMelodicContour(pitchHistory) {
    if (pitchHistory.length < 2) return { direction: 'stable', interval: 0 };

    const current = pitchHistory[pitchHistory.length - 1];
    const previous = pitchHistory[pitchHistory.length - 2];

    if (!current || !previous) return { direction: 'stable', interval: 0 };

    const interval = current.midiNote - previous.midiNote;

    return {
      direction: interval > 0 ? 'ascending' : interval < 0 ? 'descending' : 'stable',
      interval: Math.abs(interval),
      semitones: interval
    };
  }

  // Detect rhythmic patterns (onset detection)
  detectOnset(currentRMS, previousRMS, threshold = 0.1) {
    const delta = currentRMS - previousRMS;
    return delta > threshold;
  }

  // Map musical dynamics to visual intensity
  getDynamics(rms) {
    if (rms < 0.1) return { name: 'pp', intensity: 0.2, description: 'very soft' };
    if (rms < 0.2) return { name: 'p', intensity: 0.4, description: 'soft' };
    if (rms < 0.4) return { name: 'mp', intensity: 0.6, description: 'moderately soft' };
    if (rms < 0.6) return { name: 'mf', intensity: 0.7, description: 'moderately loud' };
    if (rms < 0.8) return { name: 'f', intensity: 0.85, description: 'loud' };
    return { name: 'ff', intensity: 1.0, description: 'very loud' };
  }

  // Create visual effects based on chord detection (simplified)
  detectChordQuality(spectrum, pitch) {
    if (!pitch) return { quality: 'unknown', color: 3 };

    // Simplified chord detection based on harmonic content
    const harmonics = this.getHarmonics(pitch.frequency, 6);
    let hasThird = false;
    let hasFifth = false;

    // Check for presence of major/minor third and fifth
    // This is simplified - real chord detection is more complex

    return {
      quality: hasThird && hasFifth ? 'major' : 'minor',
      color: hasThird ? 1 : 5,
      harmonicity: 0.5
    };
  }
}
