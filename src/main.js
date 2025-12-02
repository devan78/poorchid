import { AudioEngine } from './audio-engine';
import { ChordLogic } from './chord-logic';
import { VoicingEngine } from './voicing-engine';
import { MidiHandler } from './midi-handler';
import { Looper } from './looper';
import { BeatEngine } from './beat-engine';
import { Arpeggiator, Strummer, PatternPlayer } from './arpeggiator';
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
      onProgress: (progress, currentBar, totalBars) => this.updateLoopProgress(progress, currentBar, totalBars),
      onMetronome: (time, isAccent) => this.audio.playClick(time, isAccent)
    });

    this.beatEngine = new BeatEngine(this.audio.ctx);
    this.beatEngine.output.connect(this.audio.masterGain);

    // Initialize arpeggiator with dedicated monophonic voice
    this.arpeggiator = new Arpeggiator(this.audio.ctx, {
      onNoteOn: (note, vel) => this.audio.playArpNote(note, vel),
      onNoteOff: (note) => {} // Arp voice handles its own note-off via legato
    });
    
    // Pattern player uses same monophonic approach as arp
    this.patternPlayer = new PatternPlayer(this.audio.ctx, {
      onNoteOn: (note, vel) => this.audio.playArpNote(note, vel),
      onNoteOff: (note) => {} // Pattern voice handles its own note-off via legato
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
    this.heldChordType = null;
    this.playstyleForceSingle = false;
    this.playstyleOverrideType = null;

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
      toggleFlavour: () => this.stateManager.toggleFlavour(),
      toggleBass: () => this.stateManager.toggleBass(),
      cycleBassMode: () => this.stateManager.cycleBassMode(),
      cyclePatch: (direction) => this.stateManager.cyclePatch(direction),
      toggleRecording: () => this.toggleRecording(),
      toggleKey: () => this.stateManager.toggleKey(),
      toggleKeyAutoChords: () => this.stateManager.toggleKeyAutoChords(),
      cycleKeyRoot: (direction) => this.stateManager.cycleKeyRoot(direction),
      cycleKeyScale: () => this.stateManager.cycleKeyScale(),
      setPlaystyle: (style) => this.stateManager.setPlaystyle(style),
      cyclePlaystyle: () => this.stateManager.cyclePlaystyle(),
      pressChordType: (type) => this.handleChordTypePress(type),
      releaseChordType: (type) => this.handleChordTypeRelease(type),
      // Performance mode actions
      cyclePerformMode: () => this.stateManager.cyclePerformMode(),
      cycleArpPattern: () => this.stateManager.cycleArpPattern(),
      setPerformValue: (value) => this.setPerformValue(value),
      // BPM actions
      setBpm: (bpm) => this.stateManager.setBpm(bpm),
      tapTempo: () => this.tapTempo(),
      toggleMetronome: () => this.stateManager.toggleMetronome(),
      // Beat Engine actions
      toggleBeatEngine: () => {
        const enabled = !this.stateManager.get('beatEnabled');
        this.stateManager.setBeatEnabled(enabled);
      },
      cycleBeatPattern: (direction) => this.stateManager.cycleBeatPattern(direction),
      // FX actions
      cycleFxType: () => this.stateManager.cycleCurrentEffect(),
      setFxLevel: (effectName, level) => this.stateManager.setFxLevel(effectName, level),
      adjustFxLevel: (effectName, delta) => this.stateManager.adjustFxLevel(effectName, delta),
      toggleFxLock: () => this.stateManager.toggleFxLock(),
      // Looper actions
      toggleLoopRecord: () => this.toggleLoopRecord(),
      toggleLoopPlay: () => this.toggleLoopPlay(),
      loopRecord: () => {
        if (this.looper.state === 'idle') {
          const length = this.stateManager.state.loopLength === 'free' ? 0 : this.stateManager.state.loopLength;
          let startTime = null;
          if (this.stateManager.state.beatEnabled && length !== 0) {
             startTime = this.beatEngine.getNextBarTime();
          }
          this.looper.record(length, startTime);
        }
        this.stateManager.setLooperState(this.looper.state);
      },
      loopOverdub: () => {
        if (this.looper.state === 'playing') this.looper.overdub();
        this.stateManager.setLooperState(this.looper.state);
      },
      loopStop: () => {
        this.looper.stop();
        this.stateManager.setLooperState(this.looper.state);
      },
      loopClear: () => {
        this.looper.stop();
        this.looper.layers = [];
        this.stateManager.setLooperState(this.looper.state);
      },
      undoLoop: () => {
        this.looper.undo();
        this.stateManager.setLooperState(this.looper.state);
      },
      cycleLoopEncoder: (direction) => {
        if (this.looper.state === 'idle') {
          this.stateManager.cycleLoopLength(direction);
        } else {
          this.stateManager.cycleLoopMenu(direction);
        }
      },
      clickLoopEncoder: () => this.handleClickLoopEncoder()
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
    this.audio.setFxLevels(this.stateManager.state.fxLevels);
    this.audio.setFxBpm(this.stateManager.state.bpm);
    this.audio.setFxBypass(this.stateManager.state.currentEffect === 'direct');
    this.audio.setFlavourEnabled(this.stateManager.state.flavourEnabled);
    
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

  getPlaybackOptions() {
    const state = this.stateManager.state;
    const keyChordActive = state.keyEnabled && state.keyAutoChords;
    return {
      forceSingle: keyChordActive ? false : this.playstyleForceSingle,
      overrideType: keyChordActive ? null : this.playstyleOverrideType
    };
  }

  handleChordTypePress(type) {
    // If key mode is on and auto-chords are active, switch to manual so user choice sticks
    if (this.stateManager.get('keyEnabled') && this.stateManager.get('keyAutoChords')) {
      this.stateManager.setKeyAutoChords(false);
    }

    this.heldChordType = type;
    const playstyle = this.stateManager.get('playstyle');
    const hasHeldNotes = this.stateManager.state.activeMidiNotes.size > 0;

    if (playstyle === 'simple' && hasHeldNotes) {
      // Cannot change chord type mid-hold in simple mode
      return;
    }

    this.stateManager.setChordType(type);

    if ((playstyle === 'advanced' || playstyle === 'free') && hasHeldNotes) {
      this.playstyleForceSingle = false;
      this.playstyleOverrideType = type;
      this.playCurrentChord({ forceSingle: false, overrideType: type });
    }
  }

  handleChordTypeRelease(type) {
    if (this.heldChordType === type) {
      this.heldChordType = null;
    }

    const playstyle = this.stateManager.get('playstyle');
    const hasHeldNotes = this.stateManager.state.activeMidiNotes.size > 0;

    if (playstyle === 'free' && hasHeldNotes) {
      this.playstyleForceSingle = true;
      this.playstyleOverrideType = null;
      this.playCurrentChord({ forceSingle: true });
    }
  }

  handleStateChange(state, changedProps) {
    // State key validation
    const validKeys = [
      'powered','root','type','extensions','voicingCenter','filterCutoff','midiConnected','activeMidiNotes','looperState','isPlaying','bassEnabled','bassMode','bassVoicing','bassVolume','volume','flavourEnabled','currentPatch','keyEnabled','keyRoot','keyScale','keyAutoChords','performMode','arpPattern','arpDivision','arpOctave','strumSpeed','rhythmPattern','playstyle','bpm','metronomeOn','currentEffect','fxLocked','fxLevels','recording'
    ];
    for (const key of changedProps) {
      if (!validKeys.includes(key)) {
        console.warn(`[Poorchid] Unknown state key changed: '${key}'`);
      }
    }

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
    if (changedProps.includes('flavourEnabled')) {
      this.audio.setFlavourEnabled(state.flavourEnabled);
    }
    if (changedProps.includes('currentPatch')) {
      this.audio.setPatch(state.currentPatch);
    }

    // Arpeggiator parameter updates
    if (changedProps.includes('bpm')) {
      this.arpeggiator.setBpm(state.bpm);
      this.patternPlayer.setBpm(state.bpm);
      this.audio.setFxBpm(state.bpm);
      this.looper.setBpm(state.bpm);
    }
    if (changedProps.includes('arpPattern')) {
      this.arpeggiator.setPattern(state.arpPattern);
    }
    if (changedProps.includes('arpDivision')) {
      this.arpeggiator.setDivision(state.arpDivision);
    }
    if (changedProps.includes('arpOctave')) {
      this.arpeggiator.setOctaveRange(state.arpOctave);
    }
    if (changedProps.includes('strumSpeed')) {
      this.strummer.setSpeed(state.strumSpeed);
    }
    if (changedProps.includes('rhythmPattern')) {
      this.patternPlayer.setPattern(state.rhythmPattern);
    }
    
    // Performance mode change
    if (changedProps.includes('performMode')) {
      // Stop arpeggiator when switching modes
      if (state.performMode !== 'arp') {
        this.arpeggiator.stop();
      }
      // Stop pattern player when switching modes
      if (state.performMode !== 'pattern') {
        this.patternPlayer.stop();
      }
      
      // Handle Strummer modes
      const strumModes = ['strum', 'strum2', 'slop', 'harp'];
      if (!strumModes.includes(state.performMode)) {
        this.strummer.release();
      } else {
        this.strummer.setMode(state.performMode);
      }
    }
    
    // FX parameter updates
    if (changedProps.includes('fxLevels')) {
      this.audio.setFxLevels(state.fxLevels);
    }
    if (changedProps.includes('currentEffect')) {
      const bypass = state.currentEffect === 'direct';
      this.audio.setFxBypass(bypass);
      if (bypass) {
        // ensure FX lock is false when bypassed? keep as-is but levels remain
      }
    }
    if (changedProps.includes('fxLocked')) {
      // Optionally handle UI lock state
    }

    if (changedProps.includes('playstyle')) {
      if (state.playstyle === 'simple' && !this.heldChordType) {
        this.playstyleForceSingle = true;
        this.playstyleOverrideType = null;
      }
      if (state.isPlaying) {
        this.playCurrentChord(this.getPlaybackOptions());
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
    if (changedProps.includes('bassMode') && state.bassMode === 'direct') {
      this.audio.stopBass();
    }

    // Musical Updates (Re-trigger if playing)
    const retriggerProps = ['type', 'extensions', 'voicingCenter', 'bassMode', 'bassVoicing', 'bassEnabled', 'keyAutoChords'];
    
    if (state.powered) {
      if (changedProps.includes('root')) {
        this.playCurrentChord(this.getPlaybackOptions());
      } else if (state.isPlaying && changedProps.some(p => retriggerProps.includes(p))) {
        this.playCurrentChord(this.getPlaybackOptions());
      }
    }

    // Beat Engine Updates
    if (changedProps.includes('beatEnabled')) {
      if (state.beatEnabled) {
        this.beatEngine.start();
      } else {
        this.beatEngine.stop();
      }
    }
    if (changedProps.includes('beatPattern')) {
      this.beatEngine.setPattern(state.beatPattern);
    }
    if (changedProps.includes('bpm')) {
      this.beatEngine.setBpm(state.bpm);
    }
  }

  playCurrentChord(options = {}) {
    const state = this.stateManager.state;

    let root = state.root;
    let chordType = options.overrideType || state.type;
    let forceSingle = !!options.forceSingle;
    // Strum mode should always build chords; ignore single-note forcing here
    const strumModes = ['strum', 'strum2', 'slop', 'harp'];
    if (strumModes.includes(state.performMode)) {
      forceSingle = false;
    }

    // Key mode auto-chord (diatonic)
    if (state.keyEnabled && state.keyAutoChords) {
      root = this.logic.quantizeRoot(root, state.keyRoot, state.keyScale);
      chordType = this.logic.getDiatonicChordType(root, state.keyRoot, state.keyScale);
      forceSingle = false;
    }

    // 1. Get base notes
    const baseNotes = forceSingle
      ? [this.logic.getMidiRoot(root)]
      : this.logic.getNotes(
        root, 
        chordType, 
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
        let startTime = null;
        if (state.beatEnabled) {
           startTime = this.beatEngine.getNextNoteTime();
        }
        this.arpeggiator.start(voicedNotes, startTime);
      }
      // Bass still plays normally in arp mode
      if (state.bassEnabled) {
        this.audio.playBass(bassNote);
      }
      this.stateManager.setIsPlaying(true);
      return;
    } else if (['strum', 'strum2', 'slop', 'harp'].includes(state.performMode)) {
      // Strum mode: play chord with strum effect
      this.strummer.release();
      this.strummer.setMode(state.performMode);
      this.strummer.strum(voicedNotes);
      if (state.bassEnabled) {
        this.audio.playBass(bassNote);
      }
      this.stateManager.setIsPlaying(true);
      return;
    } else if (state.performMode === 'pattern') {
      // Pattern mode: play notes in rhythmic patterns synced to BPM
      this.patternPlayer.updateNotes(voicedNotes);
      if (!this.patternPlayer.isRunning) {
        let startTime = null;
        if (state.beatEnabled) {
           startTime = this.beatEngine.getNextNoteTime();
        }
        this.patternPlayer.start(voicedNotes, startTime);
      }
      // Bass still plays normally in pattern mode
      if (state.bassEnabled) {
        this.audio.playBass(bassNote);
      }
      this.stateManager.setIsPlaying(true);
      return;
    }
    
    // Direct mode: play immediately (stop arp/pattern if running)
    if (this.arpeggiator.isRunning) {
      this.arpeggiator.stop();
    }
    if (this.patternPlayer.isRunning) {
      this.patternPlayer.stop();
    }

    // 5. Play based on bass mode
    if (!state.bassEnabled) {
      // Bass off: just play chords normally
      this.audio.playChord(voicedNotes);
      this.audio.stopBass();
    } else {
      // Bass enabled: behavior depends on mode
      switch (state.bassMode) {
        case 'direct':
          this.audio.playChord(voicedNotes);
          this.audio.stopBass();
          break;
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

  handleClickLoopEncoder() {
    const state = this.stateManager.state;
    
    if (this.looper.state === 'idle') {
      // Start Recording
      const length = state.loopLength === 'free' ? 0 : state.loopLength;
      let startTime = null;
      if (state.beatEnabled && length !== 0) {
         startTime = this.beatEngine.getNextBarTime();
      }
      this.looper.record(length, startTime);
    } else if (this.looper.state === 'recording') {
      // Finish Recording (if free mode)
      this.looper.play();
    } else {
      // Execute Menu Action
      switch (state.loopMenu) {
        case 'play':
          if (this.looper.state !== 'playing') {
             let startTime = null;
             if (state.beatEnabled) startTime = this.beatEngine.getNextBarTime();
             this.looper.play(startTime);
          }
          break;
        case 'overdub':
          if (this.looper.state === 'playing') this.looper.overdub();
          else {
             let startTime = null;
             if (state.beatEnabled) startTime = this.beatEngine.getNextBarTime();
             this.looper.play(startTime); // Toggle back to play if overdubbing
          }
          break;
        case 'stop':
          this.looper.stop();
          break;
        case 'undo':
          this.looper.undo();
          break;
        case 'clear':
          this.looper.stop();
          this.looper.layers = [];
          break;
      }
    }
    this.stateManager.setLooperState(this.looper.state);
  }

  toggleLoopRecord() {
    if (this.looper.state === 'idle') {
      const length = this.stateManager.state.loopLength === 'free' ? 0 : this.stateManager.state.loopLength;
      let startTime = null;
      if (this.stateManager.state.beatEnabled && length !== 0) {
         startTime = this.beatEngine.getNextBarTime();
      }
      this.looper.record(length, startTime);
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
      let startTime = null;
      if (this.stateManager.state.beatEnabled) startTime = this.beatEngine.getNextBarTime();
      this.looper.play(startTime);
    }
    this.stateManager.setLooperState(this.looper.state);
  }

  async toggleRecording() {
    if (!this.audio.isRecordingSupported()) {
      alert('Recording is not supported in this browser.');
      return;
    }

    const isRecording = this.stateManager.get('recording');
    if (!isRecording) {
      const started = this.audio.startRecording();
      if (started) {
        this.stateManager.setRecording(true);
      } else {
        alert('Could not start recording.');
      }
    } else {
      this.stateManager.setRecording(false);
      const blob = await this.audio.stopRecording();
      if (blob) {
        this.saveRecording(blob);
      }
    }
  }

  saveRecording(blob) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = blob.type.includes('wav') ? 'wav' : (blob.type.includes('ogg') ? 'ogg' : 'webm');
    const filename = `poorchid-${timestamp}.${ext}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  stopNoteFromLooper(note) {
    const voices = this.audio.activeOscillators.get(note);
    if (voices) {
      Array.from(voices).forEach(voice => this.audio.stopNote(voice));
    }
  }

  updateLoopProgress(progress, currentBar, totalBars) {
    const reel = document.querySelector('.reel-progress');
    if (reel) {
      reel.style.strokeDashoffset = 1 - progress;
      const reelContainer = document.querySelector('.tape-reel svg');
      if (reelContainer) {
        reelContainer.style.transform = `rotate(${progress * 360}deg)`;
      }
    }
    
    if (currentBar !== undefined && totalBars !== undefined) {
      this.stateManager.setLoopBarsRecorded(`${currentBar}/${totalBars}`);
    }
  }

  // --- MIDI Handling ---

  handleMidiNoteOn(note, vel) {
    if (!this.stateManager.get('powered')) return;
    
    // Extension triggers (low notes below the keyboard range)
    const ext = MIDI_EXTENSION_MAP[note];
    if (ext) {
      this.stateManager.setExtension(ext, true);
      return;
    }

    const noteName = this.logic.getNoteName(note);
    if (!noteName) return;

    const playstyle = this.stateManager.get('playstyle');
    const keyChordActive = this.stateManager.get('keyEnabled') && this.stateManager.get('keyAutoChords');
    const chordHeld = !!this.heldChordType;

    let useChord = keyChordActive || (playstyle === 'simple' ? chordHeld : chordHeld);
    let overrideType = chordHeld ? this.heldChordType : null;

    // Free mode reverts when button released; advanced keeps chord once engaged via button
    if (!useChord && playstyle === 'advanced' && this.playstyleOverrideType && this.stateManager.state.activeMidiNotes.size > 0) {
      useChord = true;
      overrideType = this.playstyleOverrideType;
    }

    this.playstyleForceSingle = !useChord;
    this.playstyleOverrideType = useChord ? overrideType : null;

    if (useChord && overrideType) {
      this.stateManager.setChordType(overrideType);
    }

    this.stateManager.state.activeMidiNotes.add(note);
    const rootChanged = this.stateManager.get('root') !== noteName;
    this.stateManager.setRoot(noteName);
    
    // If root didn't change, we still need to trigger playback
    if (!rootChanged) {
      this.playCurrentChord(this.getPlaybackOptions());
    }
    
    this.setKeyPressed(noteName, true);
  }

  handleMidiNoteOff(note) {
    if (!this.stateManager.get('powered')) return;
    
    const ext = MIDI_EXTENSION_MAP[note];
    if (ext) {
      this.stateManager.setExtension(ext, false);
      return;
    }
    
    const noteName = this.logic.getNoteName(note);
    if (noteName) {
      this.setKeyPressed(noteName, false);
    }
    
    this.stateManager.state.activeMidiNotes.delete(note);
    
    if (this.stateManager.state.activeMidiNotes.size === 0) {
      this.audio.stopAll();
      this.arpeggiator.stop();
      this.patternPlayer.stop();
      this.strummer.release();
      this.stateManager.setIsPlaying(false);
      this.playstyleForceSingle = false;
      this.playstyleOverrideType = null;
      
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
    // Pitch strip ignored for voicing: keep dial-set position stable
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
      if (this.stateManager.get('keyEnabled') && this.stateManager.get('keyAutoChords')) {
        this.stateManager.setKeyAutoChords(false);
      }
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
   * - Pattern mode: maps to rhythm patterns (8 values)
   */
  setPerformValue(value) {
    const mode = this.stateManager.get('performMode');
    
    if (mode === 'arp') {
      // Map 0-99 to 9 divisions: 1/1, 1/2, 1/4, 1/8, 1/16, 1/32, 1/4T, 1/8T, 1/16T
      const divisions = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T'];
      const index = Math.min(8, Math.floor(value / 11)); // 0-10=0, 11-21=1, etc.
      this.stateManager.setArpDivision(divisions[index]);
    } else if (['strum', 'strum2', 'slop', 'harp'].includes(mode)) {
      this.stateManager.setStrumSpeed(value);
      this.strummer.setSpeed(value);
    } else if (mode === 'pattern') {
      // Map 0-99 to 8 rhythm patterns
      const patterns = ['straight', 'offbeat', 'pulse', 'tresillo', 'clave', 'shuffle', 'waltz', 'funk'];
      const index = Math.min(7, Math.floor(value / 12.5)); // 0-12=0, 13-25=1, etc.
      this.stateManager.setRhythmPattern(patterns[index]);
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
