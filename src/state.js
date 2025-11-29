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
      bassMode: 'chords', // chords, unison, single, solo
      bassVoicing: 0, // Semitone offset
      bassVolume: 60,
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
    if (this.state.bassVoicing !== val) {
      this.state.bassVoicing = val;
      this.notify(['bassVoicing']);
    }
  }

  setBassVolume(val) {
    if (this.state.bassVolume !== val) {
      this.state.bassVolume = val;
      this.notify(['bassVolume']);
    }
  }

  setBassMode(mode) {
    if (this.state.bassMode !== mode) {
      this.state.bassMode = mode;
      this.notify(['bassMode']);
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
}
