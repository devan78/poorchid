export const KEY_MAP = {
  'h': 'C', 'u': 'C#',
  'j': 'D', 'i': 'D#',
  'k': 'E',
  'l': 'F', 'o': 'F#',
  ';': 'G', 'p': 'G#',
  '\'': 'A', '[': 'A#',
  ']': 'B'
};

// MIDI note ranges for single octave keyboard
export const MIDI_OCTAVE_START = 60; // C4
export const MIDI_OCTAVE_END = 71;   // B4

// MIDI notes that trigger chord extensions (one octave below)
export const MIDI_EXTENSION_MAP = {
  48: '6',
  50: '7',
  52: 'maj7',
  53: '9'
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
  'z': -12, // Down octave
  'x': 12   // Up octave
};
