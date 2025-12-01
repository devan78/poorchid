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
      loopLength: 'free', // free, 1, 2, 4, 8, 16
      loopProgress: 0,
      loopBarsRecorded: 0,
      loopMenu: 'play', // play, overdub, undo, clear, stop
      isPlaying: false,
      bassEnabled: false, // Bass on/off toggle (click Bass dial)
      bassMode: 'chords', // direct, chords, unison, single, solo
      bassVoicing: 0, // Octave offset: -2 to +2 (semitones -24 to +24)
      bassVolume: 60, // 0-99 independent volume
      volume: 70, // Master volume 0-99
      flavourEnabled: true, // Hidden master flavour chain
      currentPatch: DEFAULT_PATCH, // Current sound patch
      keyEnabled: false, // Key lock mode on/off
      keyRoot: 'C', // Current key root (C, C#, D, etc.)
      keyScale: 'major', // Scale type (major, minor, dorian, etc.)
      keyAutoChords: true, // When key mode is on, auto-select diatonic chord types
      // Performance mode
      performMode: 'direct', // direct, arp, strum, pattern
      arpPattern: 'up', // up, down, updown, random
      arpDivision: '1/8', // Note division
      arpOctave: 1, // 1-3 octaves
      strumSpeed: 50, // 0-99
      rhythmPattern: 'straight', // Pattern mode: straight, offbeat, pulse, tresillo, clave, shuffle, waltz, funk
      playstyle: 'advanced', // simple, advanced, free
      // BPM
      bpm: 120, // 20-300
      metronomeOn: false,
      // Beat Engine
      beatEnabled: false, // Is the beat engine active?
      beatPattern: 'rock', // Current beat pattern
      // FX System
      currentEffect: 'direct', // Currently selected effect for editing (includes 'direct' for bypass)
      fxLocked: false, // Lock FX settings when changing sounds
      // Effect levels (0-99 each)
      fxLevels: {
        reverb: 0,
        delay: 0,
        chorus: 0,
        phaser: 0,
        flanger: 0,
        drive: 0,
        tremolo: 0,
        ensemble: 0
      },
      recording: false,
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
    const validModes = ['direct', 'chords', 'unison', 'single', 'solo'];
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

  setLoopProgress(progress) {
    this.state.loopProgress = progress;
    // Don't notify for progress to avoid full re-renders, UI handles it directly via requestAnimationFrame usually
    // But here we might want to notify if we use it for text
    this.notify(['loopProgress']);
  }

  setLoopBarsRecorded(bars) {
    if (this.state.loopBarsRecorded !== bars) {
      this.state.loopBarsRecorded = bars;
      this.notify(['loopBarsRecorded']);
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
    const modes = ['direct', 'chords', 'unison', 'single', 'solo'];
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

  setKeyAutoChords(enabled) {
    if (this.state.keyAutoChords !== enabled) {
      this.state.keyAutoChords = enabled;
      this.notify(['keyAutoChords']);
    }
  }

  toggleKeyAutoChords() {
    this.setKeyAutoChords(!this.state.keyAutoChords);
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
    const validModes = ['direct', 'arp', 'strum', 'strum2', 'slop', 'harp', 'pattern'];
    if (validModes.includes(mode) && this.state.performMode !== mode) {
      this.state.performMode = mode;
      this.notify(['performMode']);
    }
  }

  cyclePerformMode() {
    const modes = ['direct', 'arp', 'strum', 'strum2', 'slop', 'harp', 'pattern'];
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
    const validDivisions = [
      '1/1', '1/2', '1/4', '1/8', '1/16', '1/32',
      '1/4T', '1/8T', '1/16T',
      '1/4D', '1/8D', '1/16D'
    ];
    if (validDivisions.includes(division) && this.state.arpDivision !== division) {
      this.state.arpDivision = division;
      this.notify(['arpDivision']);
    }
  }

  cycleArpDivision() {
    const divisions = [
      '1/1', '1/2', '1/4', '1/8', '1/16', '1/32',
      '1/4T', '1/8T', '1/16T',
      '1/4D', '1/8D', '1/16D'
    ];
    const currentIndex = divisions.indexOf(this.state.arpDivision);
    const nextIndex = (currentIndex + 1) % divisions.length;
    this.setArpDivision(divisions[nextIndex]);
    return this.state.arpDivision;
  }

  setArpOctave(octave) {
    const oct = Math.max(1, Math.min(3, parseInt(octave)));
    if (this.state.arpOctave !== oct) {
      this.state.arpOctave = oct;
      this.notify(['arpOctave']);
    }
  }

  cycleArpOctave() {
    let next = this.state.arpOctave + 1;
    if (next > 3) next = 1;
    this.setArpOctave(next);
    return this.state.arpOctave;
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

  setPlaystyle(style) {
    const valid = ['simple', 'advanced', 'free'];
    if (valid.includes(style) && this.state.playstyle !== style) {
      this.state.playstyle = style;
      this.notify(['playstyle']);
    }
  }

  cyclePlaystyle(direction = 1) {
    const order = ['simple', 'advanced', 'free'];
    const idx = order.indexOf(this.state.playstyle);
    const next = (idx + direction + order.length) % order.length;
    this.setPlaystyle(order[next]);
    return this.state.playstyle;
  }

  // FX methods
  static FX_TYPES = ['direct', 'reverb', 'delay', 'chorus', 'phaser', 'flanger', 'drive', 'tremolo', 'ensemble'];

  setCurrentEffect(effect) {
    if (PoorchidState.FX_TYPES.includes(effect) && this.state.currentEffect !== effect) {
      this.state.currentEffect = effect;
      this.notify(['currentEffect']);
    }
  }

  cycleCurrentEffect(direction = 1) {
    const effects = PoorchidState.FX_TYPES;
    const currentIndex = effects.indexOf(this.state.currentEffect);
    const nextIndex = (currentIndex + direction + effects.length) % effects.length;
    this.setCurrentEffect(effects[nextIndex]);
    return this.state.currentEffect;
  }

  setFxLevel(effect, level) {
    if (!PoorchidState.FX_TYPES.includes(effect)) return;
    const clamped = Math.max(0, Math.min(99, level));
    if (this.state.fxLevels[effect] !== clamped) {
      this.state.fxLevels[effect] = clamped;
      this.notify(['fxLevels', effect]);
    }
  }

  adjustFxLevel(effect, delta) {
    const current = this.state.fxLevels[effect] || 0;
    this.setFxLevel(effect, current + delta);
  }

  getFxLevel(effect) {
    return this.state.fxLevels[effect] || 0;
  }

  toggleFxLock() {
    this.state.fxLocked = !this.state.fxLocked;
    this.notify(['fxLocked']);
    return this.state.fxLocked;
  }

  setFxLocked(locked) {
    if (this.state.fxLocked !== locked) {
      this.state.fxLocked = locked;
      this.notify(['fxLocked']);
    }
  }

  // Flavour chain
  setFlavourEnabled(enabled) {
    if (this.state.flavourEnabled !== enabled) {
      this.state.flavourEnabled = enabled;
      this.notify(['flavourEnabled']);
    }
  }

  toggleFlavour() {
    this.setFlavourEnabled(!this.state.flavourEnabled);
  }

  // Master recorder
  setRecording(active) {
    if (this.state.recording !== active) {
      this.state.recording = active;
      this.notify(['recording']);
    }
  }

  toggleRecording() {
    this.setRecording(!this.state.recording);
  }

  setLoopLength(length) {
    const validLengths = ['free', 1, 2, 4, 8, 16];
    if (validLengths.includes(length) && this.state.loopLength !== length) {
      this.state.loopLength = length;
      this.notify(['loopLength']);
    }
  }

  cycleLoopLength(direction = 1) {
    const lengths = ['free', 1, 2, 4, 8, 16];
    const currentIndex = lengths.indexOf(this.state.loopLength);
    const nextIndex = (currentIndex + direction + lengths.length) % lengths.length;
    this.setLoopLength(lengths[nextIndex]);
    return this.state.loopLength;
  }

  setLoopMenu(item) {
    const validItems = ['play', 'overdub', 'undo', 'clear', 'stop'];
    if (validItems.includes(item) && this.state.loopMenu !== item) {
      this.state.loopMenu = item;
      this.notify(['loopMenu']);
    }
  }

  cycleLoopMenu(direction = 1) {
    const items = ['play', 'overdub', 'undo', 'clear', 'stop'];
    const currentIndex = items.indexOf(this.state.loopMenu);
    const nextIndex = (currentIndex + direction + items.length) % items.length;
    this.setLoopMenu(items[nextIndex]);
    return this.state.loopMenu;
  }

  setBeatEnabled(enabled) {
    if (this.state.beatEnabled !== enabled) {
      this.state.beatEnabled = enabled;
      this.notify(['beatEnabled']);
    }
  }

  setBeatPattern(pattern) {
    if (this.state.beatPattern !== pattern) {
      this.state.beatPattern = pattern;
      this.notify(['beatPattern']);
    }
  }

  cycleBeatPattern(direction = 1) {
    const patterns = ['rock', 'house', 'hiphop', 'techno'];
    const currentIndex = patterns.indexOf(this.state.beatPattern);
    const nextIndex = (currentIndex + direction + patterns.length) % patterns.length;
    this.setBeatPattern(patterns[nextIndex]);
    return this.state.beatPattern;
  }
}
