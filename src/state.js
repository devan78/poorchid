import { DEFAULT_PATCH, getAdjacentPatch } from './patch-manager.js';

export class PoorchidState {
  constructor(initialState = {}) {
    this.state = {
      powered: true,
      root: 'C',
      type: 'major',
      extensions: new Set(),
      voicingCenter: 60, // Middle C
      filterCutoff: 2500, // Default warm cutoff
      midiConnected: false,
      activeMidiNotes: new Set(),
      looperState: 'idle', // idle, recording, playing, overdubbing
      isPlaying: false,
      bassEnabled: false, // Bass on/off toggle (click Bass dial)
      bassMode: 'chords', // chords, unison, single, solo
      bassVoicing: 0, // Octave offset: -2 to +2 (semitones -24 to +24)
      bassVolume: 60, // 0-99 independent volume
      volume: 70, // Master volume 0-99
      currentPatch: DEFAULT_PATCH, // Current sound patch
      keyEnabled: false, // Key lock mode on/off
      keyRoot: 'C', // Current key root (C, C#, D, etc.)
      keyScale: 'major', // Scale type (major, minor, dorian, etc.)
      // Performance mode
      performMode: 'direct', // direct, arp, strum, pattern
      arpPattern: 'up', // up, down, updown, random
      arpDivision: '1/8', // Note division
      strumSpeed: 50, // 0-99
      rhythmPattern: 'straight', // Pattern mode: straight, offbeat, pulse, tresillo, clave, shuffle, waltz, funk
      // BPM
      bpm: 120, // 20-300
      metronomeOn: false,
      ...initialState
    };
    
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(changedProps = []) {
    this.listeners.forEach(listener => listener(this.state, changedProps));
  }

  // Getters
  get(key) {
    return this.state[key];
  }

  // Actions
  setPower(powered) {
    if (this.state.powered !== powered) {
      this.state.powered = powered;
      this.notify(['powered']);
    }
  }

  setRoot(root) {
    if (this.state.root !== root) {
      this.state.root = root;
      this.notify(['root']);
    }
  }

  setChordType(type) {
    if (this.state.type !== type) {
      this.state.type = type;
      this.notify(['type']);
    }
  }

  toggleExtension(ext) {
    const newExtensions = new Set(this.state.extensions);
    if (newExtensions.has(ext)) {
      newExtensions.delete(ext);
    } else {
      newExtensions.add(ext);
    }
    this.state.extensions = newExtensions;
    this.notify(['extensions']);
  }

  setExtension(ext, active) {
    const hasExt = this.state.extensions.has(ext);
    
    // Only update if actually changing
    if (active && !hasExt) {
      const newExtensions = new Set(this.state.extensions);
      newExtensions.add(ext);
      this.state.extensions = newExtensions;
      this.notify(['extensions']);
    } else if (!active && hasExt) {
      const newExtensions = new Set(this.state.extensions);
      newExtensions.delete(ext);
      this.state.extensions = newExtensions;
      this.notify(['extensions']);
    }
  }

  setVoicingCenter(val) {
    if (this.state.voicingCenter !== val) {
      this.state.voicingCenter = val;
      this.notify(['voicingCenter']);
    }
  }

  setFilterCutoff(val) {
    if (this.state.filterCutoff !== val) {
      this.state.filterCutoff = val;
      this.notify(['filterCutoff']);
    }
  }

  setBassVoicing(val) {
    // Clamp to valid range (-24 to +24 semitones, representing octave shifts)
    const clamped = Math.max(-24, Math.min(24, val));
    if (this.state.bassVoicing !== clamped) {
      this.state.bassVoicing = clamped;
      this.notify(['bassVoicing']);
    }
  }

  setBassVolume(val) {
    // Clamp to 0-99 range per Orchid spec
    const clamped = Math.max(0, Math.min(99, val));
    if (this.state.bassVolume !== clamped) {
      this.state.bassVolume = clamped;
      this.notify(['bassVolume']);
    }
  }

  setVolume(val) {
    // Master volume 0-99
    const clamped = Math.max(0, Math.min(99, val));
    if (this.state.volume !== clamped) {
      this.state.volume = clamped;
      this.notify(['volume']);
    }
  }

  setBassMode(mode) {
    const validModes = ['chords', 'unison', 'single', 'solo'];
    if (validModes.includes(mode) && this.state.bassMode !== mode) {
      this.state.bassMode = mode;
      this.notify(['bassMode']);
    }
  }

  setBassEnabled(enabled) {
    if (this.state.bassEnabled !== enabled) {
      this.state.bassEnabled = enabled;
      this.notify(['bassEnabled']);
    }
  }

  toggleBass() {
    const wasEnabled = this.state.bassEnabled;
    this.setBassEnabled(!wasEnabled);
    // When first enabling bass, set volume to 10 (10% of 0-99 range)
    if (!wasEnabled && this.state.bassEnabled) {
      this.setBassVolume(10);
    }
  }

  setLooperState(state) {
    if (this.state.looperState !== state) {
      this.state.looperState = state;
      this.notify(['looperState']);
    }
  }

  setMidiConnected(connected) {
    if (this.state.midiConnected !== connected) {
      this.state.midiConnected = connected;
      this.notify(['midiConnected']);
    }
  }
  
  setIsPlaying(playing) {
    if (this.state.isPlaying !== playing) {
      this.state.isPlaying = playing;
      this.notify(['isPlaying']);
    }
  }

  cycleBassMode() {
    const modes = ['chords', 'unison', 'single', 'solo'];
    const currentIndex = modes.indexOf(this.state.bassMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.setBassMode(modes[nextIndex]);
  }

  setPatch(patchId) {
    if (this.state.currentPatch !== patchId) {
      this.state.currentPatch = patchId;
      this.notify(['currentPatch']);
    }
  }

  cyclePatch(direction = 1) {
    const nextPatch = getAdjacentPatch(this.state.currentPatch, direction);
    this.setPatch(nextPatch);
    return nextPatch;
  }

  // Key mode methods
  setKeyEnabled(enabled) {
    if (this.state.keyEnabled !== enabled) {
      this.state.keyEnabled = enabled;
      this.notify(['keyEnabled']);
    }
  }

  toggleKey() {
    this.setKeyEnabled(!this.state.keyEnabled);
  }

  setKeyRoot(root) {
    const validRoots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    if (validRoots.includes(root) && this.state.keyRoot !== root) {
      this.state.keyRoot = root;
      this.notify(['keyRoot']);
    }
  }

  cycleKeyRoot(direction = 1) {
    const roots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const currentIndex = roots.indexOf(this.state.keyRoot);
    const nextIndex = (currentIndex + direction + roots.length) % roots.length;
    this.setKeyRoot(roots[nextIndex]);
  }

  setKeyScale(scale) {
    const validScales = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'];
    if (validScales.includes(scale) && this.state.keyScale !== scale) {
      this.state.keyScale = scale;
      this.notify(['keyScale']);
    }
  }

  cycleKeyScale() {
    const scales = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'];
    const currentIndex = scales.indexOf(this.state.keyScale);
    const nextIndex = (currentIndex + 1) % scales.length;
    this.setKeyScale(scales[nextIndex]);
  }

  // Performance mode methods
  setPerformMode(mode) {
    const validModes = ['direct', 'arp', 'strum', 'pattern'];
    if (validModes.includes(mode) && this.state.performMode !== mode) {
      this.state.performMode = mode;
      this.notify(['performMode']);
    }
  }

  cyclePerformMode() {
    const modes = ['direct', 'arp', 'strum', 'pattern'];
    const currentIndex = modes.indexOf(this.state.performMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.setPerformMode(modes[nextIndex]);
    return this.state.performMode;
  }

  setArpPattern(pattern) {
    const validPatterns = ['up', 'down', 'updown', 'random'];
    if (validPatterns.includes(pattern) && this.state.arpPattern !== pattern) {
      this.state.arpPattern = pattern;
      this.notify(['arpPattern']);
    }
  }

  cycleArpPattern() {
    const patterns = ['up', 'down', 'updown', 'random'];
    const currentIndex = patterns.indexOf(this.state.arpPattern);
    const nextIndex = (currentIndex + 1) % patterns.length;
    this.setArpPattern(patterns[nextIndex]);
    return this.state.arpPattern;
  }

  setArpDivision(division) {
    const validDivisions = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T'];
    if (validDivisions.includes(division) && this.state.arpDivision !== division) {
      this.state.arpDivision = division;
      this.notify(['arpDivision']);
    }
  }

  cycleArpDivision(direction = 1) {
    const divisions = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T'];
    const currentIndex = divisions.indexOf(this.state.arpDivision);
    const nextIndex = (currentIndex + direction + divisions.length) % divisions.length;
    this.setArpDivision(divisions[nextIndex]);
    return this.state.arpDivision;
  }

  setStrumSpeed(speed) {
    const clamped = Math.max(0, Math.min(99, speed));
    if (this.state.strumSpeed !== clamped) {
      this.state.strumSpeed = clamped;
      this.notify(['strumSpeed']);
    }
  }

  setRhythmPattern(pattern) {
    const validPatterns = ['straight', 'offbeat', 'pulse', 'tresillo', 'clave', 'shuffle', 'waltz', 'funk'];
    if (validPatterns.includes(pattern) && this.state.rhythmPattern !== pattern) {
      this.state.rhythmPattern = pattern;
      this.notify(['rhythmPattern']);
    }
  }

  cycleRhythmPattern(direction = 1) {
    const patterns = ['straight', 'offbeat', 'pulse', 'tresillo', 'clave', 'shuffle', 'waltz', 'funk'];
    const currentIndex = patterns.indexOf(this.state.rhythmPattern);
    const nextIndex = (currentIndex + direction + patterns.length) % patterns.length;
    this.setRhythmPattern(patterns[nextIndex]);
    return this.state.rhythmPattern;
  }

  // BPM methods
  setBpm(bpm) {
    const clamped = Math.max(20, Math.min(300, bpm));
    if (this.state.bpm !== clamped) {
      this.state.bpm = clamped;
      this.notify(['bpm']);
    }
  }

  adjustBpm(delta) {
    this.setBpm(this.state.bpm + delta);
  }

  toggleMetronome() {
    this.state.metronomeOn = !this.state.metronomeOn;
    this.notify(['metronomeOn']);
  }
}
