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
}
