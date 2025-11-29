export const KEY_MAP = {
  'h': 'C', 'u': 'C#',
  'j': 'D', 'i': 'D#',
  'k': 'E',
  'l': 'F', 'o': 'F#',
  ';': 'G', 'p': 'G#',
  '\'': 'A', '[': 'A#',
  ']': 'B'
};

// MIDI note ranges
export const MIDI_NOTE_MIN = 21;  // A0 (lowest piano key)
export const MIDI_NOTE_MAX = 108; // C8 (highest piano key)
export const MIDI_REFERENCE_OCTAVE = 60; // C4 - reference point for voicing offset

// MIDI notes that trigger chord extensions (mapped to low octave C0-F0)
// These are checked BEFORE the main keyboard range
export const MIDI_EXTENSION_MAP = {
  12: '6',    // C0
  14: '7',    // D0
  16: 'maj7', // E0
  17: '9'     // F0
};

export const EXTENSION_KEY_MAP = {
  'q': '6',
  'w': '7',
  'e': 'maj7',
  'r': '9'
};

export const TYPE_KEY_MAP = {
  'a': 'major',
  's': 'minor',
  'd': 'suspended',
  'f': 'diminished'
};

export const VOICING_KEY_MAP = {
  'ArrowUp': 1,
  'ArrowDown': -1
};
