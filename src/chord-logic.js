export class ChordLogic {
  constructor() {
    this.baseOctave = 4; // Middle C starts at C4
    this.noteMap = {
      'C': 0, 'C#': 1, 'Db': 1,
      'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4,
      'F': 5, 'F#': 6, 'Gb': 6,
      'G': 7, 'G#': 8, 'Ab': 8,
      'A': 9, 'A#': 10, 'Bb': 10,
      'B': 11
    };

    this.intervals = {
      'major': [0, 4, 7],
      'minor': [0, 3, 7],
      'suspended': [0, 5, 7], // Sus4
      'diminished': [0, 3, 6]
    };

    this.extensionIntervals = {
      '6': 9,      // Major 6th
      '7': 10,     // Minor 7th
      'maj7': 11,  // Major 7th
      '9': 14      // Major 9th (octave + 2)
    };

    this.reverseNoteMap = [
      'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
    ];

    // Scale intervals for key lock feature
    this.scaleIntervals = {
      'major': [0, 2, 4, 5, 7, 9, 11],      // W-W-H-W-W-W-H
      'minor': [0, 2, 3, 5, 7, 8, 10],      // Natural minor
      'dorian': [0, 2, 3, 5, 7, 9, 10],     // Minor with raised 6th
      'phrygian': [0, 1, 3, 5, 7, 8, 10],   // Minor with lowered 2nd
      'lydian': [0, 2, 4, 6, 7, 9, 11],     // Major with raised 4th
      'mixolydian': [0, 2, 4, 5, 7, 9, 10], // Major with lowered 7th
      'locrian': [0, 1, 3, 5, 6, 8, 10]     // Diminished scale
    };
  }

  getMidiRoot(noteName) {
    const semitone = this.noteMap[noteName];
    if (semitone === undefined) throw new Error(`Invalid note name: ${noteName}`);
    // MIDI note 60 is C4
    return 60 + semitone;
  }

  getNoteName(midiNumber) {
    return this.reverseNoteMap[midiNumber % 12];
  }

  getNotes(rootName, type = 'major', extensions = []) {
    const rootMidi = this.getMidiRoot(rootName);
    const baseIntervals = this.intervals[type] || this.intervals['major'];
    
    // Start with base triad
    let notes = baseIntervals.map(interval => rootMidi + interval);

    // Add extensions
    extensions.forEach(ext => {
      if (this.extensionIntervals[ext]) {
        notes.push(rootMidi + this.extensionIntervals[ext]);
      }
    });

    return notes.sort((a, b) => a - b);
  }

  /**
   * Get the scale notes for a given key and scale type
   * @param {string} keyRoot - The root note of the key (C, C#, D, etc.)
   * @param {string} scaleType - The scale type (major, minor, dorian, etc.)
   * @returns {number[]} Array of semitone offsets in the scale (0-11)
   */
  getScaleNotes(keyRoot, scaleType = 'major') {
    const rootSemitone = this.noteMap[keyRoot] || 0;
    const intervals = this.scaleIntervals[scaleType] || this.scaleIntervals['major'];
    return intervals.map(interval => (rootSemitone + interval) % 12);
  }

  /**
   * Quantize a note to the nearest note in the scale
   * @param {number} midiNote - The MIDI note number to quantize
   * @param {string} keyRoot - The root note of the key
   * @param {string} scaleType - The scale type
   * @returns {number} The quantized MIDI note number
   */
  quantizeToScale(midiNote, keyRoot, scaleType = 'major') {
    const scaleNotes = this.getScaleNotes(keyRoot, scaleType);
    const noteSemitone = midiNote % 12;
    const octave = Math.floor(midiNote / 12);
    
    // Check if note is already in scale
    if (scaleNotes.includes(noteSemitone)) {
      return midiNote;
    }
    
    // Find nearest scale note
    let minDistance = 12;
    let nearestSemitone = noteSemitone;
    
    for (const scaleSemitone of scaleNotes) {
      // Calculate distance considering octave wrapping
      const dist1 = Math.abs(noteSemitone - scaleSemitone);
      const dist2 = 12 - dist1; // Wrap around distance
      const distance = Math.min(dist1, dist2);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestSemitone = scaleSemitone;
      }
    }
    
    // Reconstruct the MIDI note
    let result = octave * 12 + nearestSemitone;
    
    // Handle edge case where quantization crosses octave boundary
    if (nearestSemitone > noteSemitone && nearestSemitone - noteSemitone > 6) {
      result -= 12; // Go to lower octave
    } else if (noteSemitone > nearestSemitone && noteSemitone - nearestSemitone > 6) {
      result += 12; // Go to higher octave
    }
    
    return result;
  }

  /**
   * Quantize a chord root to the key, returning the nearest valid root
   * @param {string} rootName - The original root note name
   * @param {string} keyRoot - The key to quantize to
   * @param {string} scaleType - The scale type
   * @returns {string} The quantized root note name
   */
  quantizeRoot(rootName, keyRoot, scaleType = 'major') {
    const midiNote = this.getMidiRoot(rootName);
    const quantized = this.quantizeToScale(midiNote, keyRoot, scaleType);
    return this.getNoteName(quantized);
  }

  /**
   * Get diatonic chord quality for a note within a key/scale.
   * Returns one of the core chord types understood by the app.
   */
  getDiatonicChordType(rootName, keyRoot, scaleType = 'major') {
    const scale = this.scaleIntervals[scaleType] || this.scaleIntervals['major'];
    const rootSemitone = this.noteMap[rootName];
    const keySemitone = this.noteMap[keyRoot] || 0;
    if (rootSemitone === undefined) return 'major';

    // Determine scale degree index
    const offset = (rootSemitone - keySemitone + 12) % 12;
    const degreeIndex = scale.indexOf(offset);
    if (degreeIndex === -1) return 'major';

    // Ionian triad qualities rotated for modal scales
    const ionianQualities = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'];
    const modeRotation = ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian'];
    const rotationIndex = modeRotation.indexOf(scaleType);
    const shift = rotationIndex === -1 ? 0 : rotationIndex;

    const rotated = [
      ...ionianQualities.slice(shift),
      ...ionianQualities.slice(0, shift)
    ];

    return rotated[degreeIndex] || 'major';
  }
}
