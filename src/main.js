import { AudioEngine } from './audio-engine';
import { ChordLogic } from './chord-logic';
import { VoicingEngine } from './voicing-engine';
import { MidiHandler } from './midi-handler';
import { Looper } from './looper';
import { Arpeggiator, Strummer } from './arpeggiator';
import { PoorchidState } from './state';
import { PoorchidUI } from './ui';
import { 
  KEY_MAP, 
  EXTENSION_KEY_MAP, 
  TYPE_KEY_MAP, 
  VOICING_KEY_MAP,
  MIDI_NOTE_MIN,
  MIDI_NOTE_MAX,
  MIDI_REFERENCE_OCTAVE,
  MIDI_EXTENSION_MAP
} from './constants';

export class PoorchidApp {
  constructor() {
    this.audio = new AudioEngine();
    this.logic = new ChordLogic();
    this.voicing = new VoicingEngine();
    this.stateManager = new PoorchidState();
    
    this.midi = new MidiHandler({
      onNoteOn: (note, vel) => this.handleMidiNoteOn(note, vel),
      onNoteOff: (note) => this.handleMidiNoteOff(note),
      onControlChange: (cc, val) => this.handleMidiControlChange(cc, val),
      onPitchBend: (lsb, msb) => this.handleMidiPitchBend(lsb, msb),
      onConnection: (name, connected) => this.stateManager.setMidiConnected(connected)
    });
    
    this.looper = new Looper(this.audio.ctx, {
      onPlay: (note, vel) => this.audio.playNote(note),
      onStop: (note) => this.stopNoteFromLooper(note),
      onProgress: (progress) => this.updateLoopProgress(progress)
    });

    // Initialize arpeggiator with dedicated monophonic voice
    this.arpeggiator = new Arpeggiator(this.audio.ctx, {
      onNoteOn: (note, vel) => this.audio.playArpNote(note, vel),
      onNoteOff: (note) => {} // Arp voice handles its own note-off via legato
    });
    
    // Strummer uses regular voices but tracks them
    this.strumVoices = new Map();
    this.strummer = new Strummer({
      onNoteOn: (note, vel) => {
        const voice = this.audio.playNote(note, vel / 127);
        this.strumVoices.set(note, voice);
      },
      onNoteOff: (note) => {
        const voice = this.strumVoices.get(note);
        if (voice) {
          this.audio.stopNote(voice);
          this.strumVoices.delete(note);
        }
      }
    });

    this.currentRecordedNotes = new Set();

    // Bound event handlers for cleanup
    this._boundKeyDown = (e) => this.handleKeyDown(e);
    this._boundKeyUp = (e) => this.handleKeyUp(e);

    // Initialize UI with Actions
    const container = document.querySelector('#synth-interface');
    this.ui = new PoorchidUI(container, {
      togglePower: () => this.stateManager.setPower(!this.stateManager.get('powered')),
      setChordType: (type) => this.stateManager.setChordType(type),
      toggleExtension: (ext) => this.stateManager.toggleExtension(ext),
      setRoot: (note) => this.stateManager.setRoot(note),
      setVoicing: (val) => this.stateManager.setVoicingCenter(val),
      setFilter: (val) => this.stateManager.setFilterCutoff(val),
      setBassVoicing: (val) => this.stateManager.setBassVoicing(val),
      setBassVolume: (val) => this.stateManager.setBassVolume(val),
      setVolume: (val) => this.stateManager.setVolume(val),
      toggleBass: () => this.stateManager.toggleBass(),
      cycleBassMode: () => this.stateManager.cycleBassMode(),
      cyclePatch: (direction) => this.stateManager.cyclePatch(direction),
      toggleKey: () => this.stateManager.toggleKey(),
      cycleKeyRoot: (direction) => this.stateManager.cycleKeyRoot(direction),
      cycleKeyScale: () => this.stateManager.cycleKeyScale(),
      // Performance mode actions
      cyclePerformMode: () => this.stateManager.cyclePerformMode(),
      cycleArpPattern: () => this.stateManager.cycleArpPattern(),
      setPerformValue: (value) => this.setPerformValue(value),
      // BPM actions
      setBpm: (bpm) => this.stateManager.setBpm(bpm),
      tapTempo: () => this.tapTempo(),
      toggleMetronome: () => this.stateManager.toggleMetronome(),
      // Looper actions
      toggleLoopRecord: () => this.toggleLoopRecord(),
      toggleLoopPlay: () => this.toggleLoopPlay(),
      undoLoop: () => {
        this.looper.undo();
        this.stateManager.setLooperState(this.looper.state);
      }
    });

    this.init();
  }

  get state() {
    return this.stateManager.state;
  }

  async init() {
    // Initial Render
    this.ui.mount(this.stateManager.state);
    
    // Apply initial audio settings
    this.audio.setVolume(this.stateManager.state.volume);
    this.audio.setBassVolume(this.stateManager.state.bassVolume);
    this.audio.setFilterCutoff(this.stateManager.state.filterCutoff);
    
    // Subscribe to State Changes
    this.stateManager.subscribe((state, changedProps) => {
      this.ui.update(state);
      this.handleStateChange(state, changedProps);
    });

    // Global Events
    window.addEventListener('keydown', this._boundKeyDown);
    window.addEventListener('keyup', this._boundKeyUp);

    await this.midi.init();
  }

  destroy() {
    // Remove global event listeners
    window.removeEventListener('keydown', this._boundKeyDown);
    window.removeEventListener('keyup', this._boundKeyUp);
    
    // Clean up subsystems
    this.midi.destroy();
    this.looper.stop();
    this.audio.stopAll();
  }

  // Helper: Set key pressed state
  setKeyPressed(noteName, pressed) {
    const keyEl = document.querySelector(`.key[data-note="${noteName}"]`);
    if (keyEl) {
      keyEl.classList.toggle('pressed', pressed);
    }
  }

  handleStateChange(state, changedProps) {
    // Audio Parameter Updates
    if (changedProps.includes('filterCutoff')) {
      this.audio.setFilterCutoff(state.filterCutoff);
    }
    if (changedProps.includes('bassVolume')) {
      this.audio.setBassVolume(state.bassVolume);
    }
    if (changedProps.includes('volume')) {
      this.audio.setVolume(state.volume);
    }
    if (changedProps.includes('currentPatch')) {
      this.audio.setPatch(state.currentPatch);
    }

    // Arpeggiator parameter updates
    if (changedProps.includes('bpm')) {
      this.arpeggiator.setBpm(state.bpm);
    }
    if (changedProps.includes('arpPattern')) {
      this.arpeggiator.setPattern(state.arpPattern);
    }
    if (changedProps.includes('arpDivision')) {
      this.arpeggiator.setDivision(state.arpDivision);
    }
    if (changedProps.includes('strumSpeed')) {
      this.strummer.setSpeed(state.strumSpeed);
    }
    
    // Performance mode change
    if (changedProps.includes('performMode')) {
      // Stop arpeggiator when switching modes
      if (state.performMode !== 'arp') {
        this.arpeggiator.stop();
      }
      // Release strummer when switching modes
      if (state.performMode !== 'strum') {
        this.strummer.release();
      }
    }

    // Power Handling
    if (changedProps.includes('powered')) {
      if (state.powered) {
        this.audio.resume();
      } else {
        this.audio.stopAll();
        this.arpeggiator.stop();
        this.strummer.release();
        this.stateManager.setIsPlaying(false);
      }
    }

    // Bass toggle: stop bass if disabled
    if (changedProps.includes('bassEnabled') && !state.bassEnabled) {
      this.audio.stopBass();
    }

    // Musical Updates (Re-trigger if playing)
    const retriggerProps = ['type', 'extensions', 'voicingCenter', 'bassMode', 'bassVoicing', 'bassEnabled'];
    
    if (state.powered) {
      if (changedProps.includes('root')) {
        this.playCurrentChord();
      } else if (state.isPlaying && changedProps.some(p => retriggerProps.includes(p))) {
        this.playCurrentChord();
      }
    }
  }

  playCurrentChord() {
    const state = this.stateManager.state;

    // 1. Get base notes
    const baseNotes = this.logic.getNotes(
      state.root, 
      state.type, 
      Array.from(state.extensions)
    );

    // 2. Apply voicing
    const voicedNotes = this.voicing.getVoicing(baseNotes, state.voicingCenter);

    // 3. Calculate bass note (root - 2 octaves + voicing offset)
    const rootMidi = this.logic.getMidiRoot(state.root);
    const bassNote = rootMidi - 24 + state.bassVoicing;

    // 4. Handle performance mode
    if (state.performMode === 'arp') {
      // Arpeggiator mode: update notes and start if not running
      this.arpeggiator.updateNotes(voicedNotes);
      if (!this.arpeggiator.isRunning) {
        this.arpeggiator.start(voicedNotes);
      }
      // Bass still plays normally in arp mode
      if (state.bassEnabled) {
        this.audio.playBass(bassNote);
      }
      this.stateManager.setIsPlaying(true);
      return;
    } else if (state.performMode === 'strum') {
      // Strum mode: play chord with strum effect
      this.strummer.release();
      this.strummer.strum(voicedNotes);
      if (state.bassEnabled) {
        this.audio.playBass(bassNote);
      }
      this.stateManager.setIsPlaying(true);
      return;
    }
    
    // Direct mode: play immediately (stop arp if running)
    if (this.arpeggiator.isRunning) {
      this.arpeggiator.stop();
    }

    // 5. Play based on bass mode
    if (!state.bassEnabled) {
      // Bass off: just play chords normally
      this.audio.playChord(voicedNotes);
      this.audio.stopBass();
    } else {
      // Bass enabled: behavior depends on mode
      switch (state.bassMode) {
        case 'solo':
          // Solo: Bass plays independently, no chords
          this.audio.playChord([]);
          this.audio.playBass(bassNote);
          break;
          
        case 'unison':
          // Unison: Bass matches the lowest note of the chord
          this.audio.playChord(voicedNotes);
          if (voicedNotes.length > 0) {
            const lowestNote = Math.min(...voicedNotes);
            this.audio.playBass(lowestNote - 12 + state.bassVoicing);
          }
          break;
          
        case 'single':
          // Single Notes: One bass note (root) per chord
          this.audio.playChord(voicedNotes);
          this.audio.playBass(bassNote);
          break;
          
        case 'chords':
        default:
          // Chords Only: Bass plays only when chords play (root note)
          this.audio.playChord(voicedNotes);
          if (voicedNotes.length > 0) {
            this.audio.playBass(bassNote);
          } else {
            this.audio.stopBass();
          }
          break;
      }
    }

    this.stateManager.setIsPlaying(true);
    
    // 5. Record to Looper if active
    if (this.looper.state === 'recording' || this.looper.state === 'overdubbing') {
      // Stop notes no longer playing
      for (const note of this.currentRecordedNotes) {
        if (!voicedNotes.includes(note)) {
          this.looper.addEvent({ type: 'noteOff', note });
          this.currentRecordedNotes.delete(note);
        }
      }
      
      // Start new notes
      for (const note of voicedNotes) {
        if (!this.currentRecordedNotes.has(note)) {
          this.looper.addEvent({ type: 'noteOn', note, velocity: 100 });
          this.currentRecordedNotes.add(note);
        }
      }
    }
  }

  toggleLoopRecord() {
    if (this.looper.state === 'idle') {
      this.looper.record();
    } else if (this.looper.state === 'recording') {
      this.looper.play();
    } else if (this.looper.state === 'playing') {
      this.looper.overdub();
    } else if (this.looper.state === 'overdubbing') {
      this.looper.play();
    }
    this.stateManager.setLooperState(this.looper.state);
  }

  toggleLoopPlay() {
    if (this.looper.state === 'playing' || this.looper.state === 'overdubbing') {
      this.looper.stop();
    } else {
      this.looper.play();
    }
    this.stateManager.setLooperState(this.looper.state);
  }

  stopNoteFromLooper(note) {
    const voices = this.audio.activeOscillators.get(note);
    if (voices) {
      Array.from(voices).forEach(voice => this.audio.stopNote(voice));
    }
  }

  updateLoopProgress(progress) {
    const reel = document.querySelector('.reel-progress');
    if (reel) {
      reel.style.strokeDashoffset = 1 - progress;
      const reelContainer = document.querySelector('.tape-reel svg');
      if (reelContainer) {
        reelContainer.style.transform = `rotate(${progress * 360}deg)`;
      }
    }
  }

  // --- MIDI Handling ---

  handleMidiNoteOn(note, vel) {
    if (!this.stateManager.get('powered')) return;
    
    // Extension triggers (low notes below the keyboard range)
    if (note < MIDI_NOTE_MIN) {
      const ext = MIDI_EXTENSION_MAP[note];
      if (ext) this.stateManager.setExtension(ext, true);
      return;
    }
    
    // Full keyboard range
    if (note > MIDI_NOTE_MAX) return;
    
    const noteName = this.logic.getNoteName(note);
    if (!noteName) return;

    this.stateManager.state.activeMidiNotes.add(note);
    const rootChanged = this.stateManager.get('root') !== noteName;
    this.stateManager.setRoot(noteName);
    
    // Adjust voicing center based on which octave was played
    // Playing higher shifts voicing up, playing lower shifts down
    const octaveOffset = note - MIDI_REFERENCE_OCTAVE;
    const currentVoicing = this.stateManager.get('voicingCenter');
    const targetVoicing = 60 + octaveOffset; // Center around the played octave
    // Smooth blend: move voicing towards the played octave
    const newVoicing = Math.max(36, Math.min(84, Math.round(currentVoicing * 0.3 + targetVoicing * 0.7)));
    this.stateManager.setVoicingCenter(newVoicing);
    
    // If root didn't change, we still need to trigger playback
    if (!rootChanged) {
      this.playCurrentChord();
    }
    
    this.setKeyPressed(noteName, true);
  }

  handleMidiNoteOff(note) {
    if (!this.stateManager.get('powered')) return;
    
    if (note < MIDI_NOTE_MIN) {
      const ext = MIDI_EXTENSION_MAP[note];
      if (ext) this.stateManager.setExtension(ext, false);
      return;
    }
    
    // Full keyboard range
    if (note > MIDI_NOTE_MAX) return;
    
    const noteName = this.logic.getNoteName(note);
    if (noteName) {
      this.setKeyPressed(noteName, false);
    }
    
    this.stateManager.state.activeMidiNotes.delete(note);
    
    if (this.stateManager.state.activeMidiNotes.size === 0) {
      this.audio.stopAll();
      this.arpeggiator.stop();
      this.strummer.release();
      this.stateManager.setIsPlaying(false);
      
      if (this.currentRecordedNotes) {
        for (const n of this.currentRecordedNotes) {
          this.looper.addEvent({ type: 'noteOff', note: n });
        }
        this.currentRecordedNotes.clear();
      }
    } else {
      const noteName = this.logic.getNoteName(note);
      if (noteName === this.stateManager.get('root')) {
        if (this.stateManager.state.activeMidiNotes.size > 0) {
          const lastNote = Array.from(this.stateManager.state.activeMidiNotes).pop();
          const newRoot = this.logic.getNoteName(lastNote);
          this.stateManager.setRoot(newRoot);
        }
      }
    }
  }

  handleMidiControlChange(cc, val) {
    if (cc === 1) {
      const min = 100;
      const max = 10000;
      const cutoff = min * Math.pow(max / min, val / 127);
      this.stateManager.setFilterCutoff(Math.round(cutoff));
    }
  }

  handleMidiPitchBend(lsb, msb) {
    const val = (msb << 7) + lsb;
    const min = 36;
    const max = 84;
    const normalized = val / 16383;
    const voicing = min + (normalized * (max - min));
    this.stateManager.setVoicingCenter(Math.round(voicing));
  }

  // --- Keyboard Handling ---

  handleKeyDown(e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();

    const ext = EXTENSION_KEY_MAP[key];
    if (ext) {
      this.stateManager.setExtension(ext, true);
      return;
    }

    const type = TYPE_KEY_MAP[key];
    if (type) {
      this.stateManager.setChordType(type);
      return;
    }

    const voicingChange = VOICING_KEY_MAP[key];
    if (voicingChange) {
      const current = this.stateManager.get('voicingCenter');
      const newVal = Math.max(36, Math.min(84, current + voicingChange));
      this.stateManager.setVoicingCenter(newVal);
      return;
    }

    const noteName = KEY_MAP[key];
    if (noteName) {
      const midiNote = this.logic.getMidiRoot(noteName);
      this.handleMidiNoteOn(midiNote, 100);
    }
  }

  handleKeyUp(e) {
    const key = e.key.toLowerCase();

    const ext = EXTENSION_KEY_MAP[key];
    if (ext) {
      this.stateManager.setExtension(ext, false);
      return;
    }

    const noteName = KEY_MAP[key];
    if (noteName) {
      const midiNote = this.logic.getMidiRoot(noteName);
      this.handleMidiNoteOff(midiNote);
    }
  }

  /**
   * Set performance parameter value (0-99)
   * - Arp mode: maps to note divisions (9 values)
   * - Strum mode: direct strum speed
   */
  setPerformValue(value) {
    const mode = this.stateManager.get('performMode');
    
    if (mode === 'arp') {
      // Map 0-99 to 9 divisions: 1/1, 1/2, 1/4, 1/8, 1/16, 1/32, 1/4T, 1/8T, 1/16T
      const divisions = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T'];
      const index = Math.min(8, Math.floor(value / 11)); // 0-10=0, 11-21=1, etc.
      this.stateManager.setArpDivision(divisions[index]);
    } else if (mode === 'strum') {
      this.stateManager.setStrumSpeed(value);
      this.strummer.setSpeed(value);
    }
  }

  /**
   * Tap tempo - updates BPM based on tap intervals
   */
  tapTempo() {
    const newBpm = this.arpeggiator.tapTempo();
    this.stateManager.setBpm(newBpm);
  }
}

if (document.querySelector('#synth-interface')) {
  new PoorchidApp();
}
