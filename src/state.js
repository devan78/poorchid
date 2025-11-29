import { DEFAULT_PATCH, getAdjacentPatch, PATCH_ORDER } from './patch-manager.js';

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
      currentPatch: DEFAULT_PATCH, // Current sound patch
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
    this.setBassEnabled(!this.state.bassEnabled);
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
}
