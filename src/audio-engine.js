import { midiToFreq } from './utils';
import { PATCHES, DEFAULT_PATCH } from './patch-manager';
import { FXChain } from './effects.js';

export class AudioEngine {
  constructor() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.error('Web Audio API not supported:', e);
      this.ctx = null;
      return;
    }
    
    this.currentPatch = PATCHES[DEFAULT_PATCH];
    this.patchId = DEFAULT_PATCH;
    
    // === AUDIO CHAIN ===
    // Voices -> FX Chain -> Master Filter -> Compressor -> Master Output
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;

    // Secret flavour chain (glue + tone)
    this.flavourEnabled = true;
    this.flavourInput = this.ctx.createGain();
    this.flavourOutput = this.ctx.createGain();
    this.flavourBypassGain = this.ctx.createGain();
    this.flavourBypassGain.gain.value = 0;

    this.flavourHighpass = this.ctx.createBiquadFilter();
    this.flavourHighpass.type = 'highpass';
    this.flavourHighpass.frequency.value = 24;
    this.flavourHighpass.Q.value = 0.55;

    this.flavourLowShelf = this.ctx.createBiquadFilter();
    this.flavourLowShelf.type = 'lowshelf';
    this.flavourLowShelf.frequency.value = 90;
    this.flavourLowShelf.gain.value = 0.35;

    this.flavourHighShelf = this.ctx.createBiquadFilter();
    this.flavourHighShelf.type = 'highshelf';
    this.flavourHighShelf.frequency.value = 11000;
    this.flavourHighShelf.gain.value = 0.4;

    this.flavourDryGain = this.ctx.createGain();
    this.flavourDryGain.gain.value = 0.9;

    this.flavourWetGain = this.ctx.createGain();
    this.flavourWetGain.gain.value = 0.1;

    this.flavourMix = this.ctx.createGain();

    this.flavourSaturation = this.ctx.createWaveShaper();
    this.flavourSaturation.curve = this.createSaturationCurve(0.08);
    this.flavourSaturation.oversample = '4x';

    this.flavourLimiter = this.ctx.createDynamicsCompressor();
    this.flavourLimiter.threshold.value = -0.5;
    this.flavourLimiter.ratio.value = 1.8;
    this.flavourLimiter.knee.value = 14;
    this.flavourLimiter.attack.value = 0.005;
    this.flavourLimiter.release.value = 0.25;

    this.flavourTrim = this.ctx.createGain();
    this.flavourTrim.gain.value = 0.95;

    // Compressor (gentle, glue-like)
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.ratio.value = 3;
    this.compressor.knee.value = 10;
    this.compressor.attack.value = 0.03;
    this.compressor.release.value = 0.25;

    // Master Filter (warm, can be modulated)
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 3000;
    this.masterFilter.Q.value = 0.7;
    
    // FX Chain (controllable effects)
    this.fxChain = new FXChain(this.ctx);
    
    // Input stage (where voices connect)
    this.voiceInput = this.ctx.createGain();
    this.voiceInput.gain.value = 1;
    
    // === CONNECT THE CHAIN ===
    // Voice -> FX Chain -> Filter -> Compressor -> Master
    this.voiceInput.connect(this.fxChain.input);
    this.fxChain.connect(this.masterFilter);
    this.masterFilter.connect(this.compressor);
    this.compressor.connect(this.flavourInput);
    this.compressor.connect(this.flavourBypassGain);

    this.flavourInput.connect(this.flavourHighpass);
    this.flavourHighpass.connect(this.flavourLowShelf);
    this.flavourLowShelf.connect(this.flavourHighShelf);
    this.flavourHighShelf.connect(this.flavourSaturation);
    this.flavourHighShelf.connect(this.flavourDryGain);

    this.flavourSaturation.connect(this.flavourWetGain);
    this.flavourWetGain.connect(this.flavourMix);
    this.flavourDryGain.connect(this.flavourMix);

    this.flavourMix.connect(this.flavourLimiter);
    this.flavourLimiter.connect(this.flavourTrim);
    this.flavourTrim.connect(this.flavourOutput);

    this.flavourOutput.connect(this.masterGain);
    this.flavourBypassGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    // Recorder tap point (post-master)
    this.recordDestination = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.recordDestination);
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.setFlavourEnabled(this.flavourEnabled);
    
    // Global Drift LFO (Tape wobble - enhanced)
    this.driftLFO = this.ctx.createOscillator();
    this.driftLFO.frequency.value = 0.4;
    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.value = 8;
    this.driftLFO.connect(this.driftGain);
    this.driftLFO.start();

    this.activeOscillators = new Map();
    this.liveVoices = new Map();

    // Bass Engine
    this.bassGain = this.ctx.createGain();
    this.bassGain.gain.value = 0.6;
    this.bassGain.connect(this.compressor); // Bass bypasses FX
    this.bassVoice = null;
  }

  // FX Control Methods
  setFxLevel(effectName, level) {
    if (this.fxChain) {
      this.fxChain.setLevel(effectName, level);
    }
  }

  setFxLevels(levels) {
    if (this.fxChain) {
      this.fxChain.setLevels(levels);
    }
  }

  setFxBpm(bpm) {
    if (this.fxChain) {
      this.fxChain.setBpm(bpm);
    }
  }

  setFxBypass(bypass) {
    if (this.fxChain) {
      this.fxChain.setBypass(bypass);
    }
  }

  setFlavourEnabled(enabled) {
    this.flavourEnabled = !!enabled;
    if (!this.flavourOutput || !this.flavourBypassGain) return;
    const now = this.ctx.currentTime;
    const on = this.flavourEnabled ? 1 : 0;
    const off = this.flavourEnabled ? 0 : 1;
    this.flavourOutput.gain.setTargetAtTime(on, now, 0.02);
    this.flavourBypassGain.gain.setTargetAtTime(off, now, 0.02);
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setPatch(patchId) {
    if (PATCHES[patchId]) {
      this.currentPatch = PATCHES[patchId];
      this.patchId = patchId;
      return true;
    }
    return false;
  }

  getPatchId() {
    return this.patchId;
  }

  playNote(midiNote, velocity = 0.8, time = 0) {
    const freq = midiToFreq(midiNote);
    
    // Use patch if available, otherwise fallback to legacy synth
    if (this.currentPatch && this.currentPatch.createVoice) {
      const patchVoice = this.currentPatch.createVoice(this.ctx, freq, velocity);
      
      // Connect to psychedelic effects chain
      patchVoice.output.connect(this.voiceInput);
      
      const voice = { 
        patchVoice, 
        note: midiNote,
        // Legacy compatibility
        osc: null,
        gain: patchVoice.output
      };
      
      if (!this.activeOscillators.has(midiNote)) {
        this.activeOscillators.set(midiNote, new Set());
      }
      this.activeOscillators.get(midiNote).add(voice);
      
      return voice;
    }
    
    // === LEGACY FALLBACK (sawtooth pad) ===
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Use Sawtooth for richer harmonics, filtered down for warmth
    osc.type = 'sawtooth'; 
    osc.frequency.value = freq;

    // Apply Global Drift
    this.driftGain.connect(osc.detune);

    // Apply Per-Voice Random Detune (Analog instability)
    const randomDetune = (Math.random() * 10) - 5; // +/- 5 cents
    osc.detune.value = randomDetune;

    // Envelope (Softer, pad-like ADSR)
    const now = this.ctx.currentTime + time;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.1); // Slower Attack
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.4); // Decay to Sustain

    osc.connect(gain);
    gain.connect(this.voiceInput); // Connect to effects chain

    osc.start(now);

    const voice = { osc, gain, note: midiNote };
    
    if (!this.activeOscillators.has(midiNote)) {
      this.activeOscillators.set(midiNote, new Set());
    }
    this.activeOscillators.get(midiNote).add(voice);

    return voice;
  }

  stopNote(voice, time = 0) {
    if (!voice) return;

    // Handle patch voices
    if (voice.patchVoice && voice.patchVoice.release) {
      voice.patchVoice.release(time);
      
      const voices = this.activeOscillators.get(voice.note);
      if (voices) {
        voices.delete(voice);
        if (voices.size === 0) {
          this.activeOscillators.delete(voice.note);
        }
      }
      return;
    }

    // Legacy voice handling
    if (!voice.osc) return;
    
    const now = this.ctx.currentTime + time;
    // Release
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    voice.osc.stop(now + 0.2);
    
    // Cleanup
    setTimeout(() => {
      voice.osc.disconnect();
      voice.gain.disconnect();
    }, 250); // Slightly longer than release

    const voices = this.activeOscillators.get(voice.note);
    if (voices) {
      voices.delete(voice);
      if (voices.size === 0) {
        this.activeOscillators.delete(voice.note);
      }
    }
  }

  playBass(midiNote, time = 0) {
    // Monophonic: Stop existing bass note
    if (this.bassVoice) {
      this.stopBass(time);
    }

    const freq = midiToFreq(midiNote);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Bass Sound Design: Square wave filtered down
    osc.type = 'square';
    osc.frequency.value = freq;

    // Bass Filter
    filter.type = 'lowpass';
    filter.frequency.value = 320; // Deep bass
    filter.Q.value = 1.2; // Softer resonance

    // Envelope (Punchy)
    const now = this.ctx.currentTime + time;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.55, now + 0.03); // Slightly slower, lower peak
    gain.gain.exponentialRampToValueAtTime(0.38, now + 0.22); // Decay
    gain.gain.setValueAtTime(0.38, now + 0.22); // Sustain

    // Filter Envelope (Wow effect)
    filter.frequency.setValueAtTime(340, now);
    filter.frequency.exponentialRampToValueAtTime(190, now + 0.24);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bassGain);

    osc.start(now);

    this.bassVoice = { osc, gain, filter, note: midiNote };
  }

  stopBass(time = 0) {
    if (!this.bassVoice) return;

    const voice = this.bassVoice;
    const now = this.ctx.currentTime + time;

    // Release
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); // Short release

    voice.osc.stop(now + 0.1);

    setTimeout(() => {
      voice.osc.disconnect();
      voice.gain.disconnect();
      voice.filter.disconnect();
    }, 150);

    this.bassVoice = null;
  }

  setBassVolume(val) {
    // val is 0-100
    const gain = val / 100;
    this.bassGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.1);
  }

  playChord(notes) {
    this.resume();
    // Stop live notes not in the new chord
    for (const [note, voice] of this.liveVoices) {
      if (!notes.includes(note)) {
        this.stopNote(voice);
        this.liveVoices.delete(note);
      }
    }

    // Play new notes
    notes.forEach(note => {
      if (!this.liveVoices.has(note)) {
        const voice = this.playNote(note);
        this.liveVoices.set(note, voice);
      }
    });
  }

  stopAll() {
    this.stopBass();
    this.stopArpNote(); // Stop arp voice
    // Stop all active oscillators
    for (const voices of this.activeOscillators.values()) {
      for (const voice of voices) {
        this.stopNote(voice);
      }
    }
    this.liveVoices.clear();
    this.activeOscillators.clear();
  }

  // === ARPEGGIATOR VOICE (Monophonic, uses current patch) ===
  playArpNote(midiNote, velocity = 80) {
    const now = this.ctx.currentTime;
    
    // Stop previous arp note with quick release
    if (this.arpVoice) {
      if (this.arpVoice.patchVoice && this.arpVoice.patchVoice.release) {
        this.arpVoice.patchVoice.release(0);
      } else if (this.arpVoice.gain) {
        this.arpVoice.gain.gain.cancelScheduledValues(now);
        this.arpVoice.gain.gain.setValueAtTime(this.arpVoice.gain.gain.value, now);
        this.arpVoice.gain.gain.linearRampToValueAtTime(0, now + 0.01);
        if (this.arpVoice.osc) {
          this.arpVoice.osc.stop(now + 0.02);
        }
      }
      this.arpVoice = null;
    }
    
    // Create new voice using current patch (same as playNote)
    const freq = midiToFreq(midiNote);
    const vel = velocity / 127;
    
    if (this.currentPatch && this.currentPatch.createVoice) {
      const patchVoice = this.currentPatch.createVoice(this.ctx, freq, vel);
      patchVoice.output.connect(this.voiceInput);
      
      this.arpVoice = {
        patchVoice,
        note: midiNote
      };
      return this.arpVoice;
    }
    
    // Legacy fallback
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    this.driftGain.connect(osc.detune);
    osc.detune.value = (Math.random() * 10) - 5;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3 * vel, now + 0.015);
    
    osc.connect(gain);
    gain.connect(this.voiceInput);
    osc.start(now);
    
    this.arpVoice = { osc, gain, note: midiNote };
    return this.arpVoice;
  }
  
  stopArpNote() {
    if (!this.arpVoice) return;
    
    const now = this.ctx.currentTime;
    const voice = this.arpVoice;
    
    // Handle patch voices
    if (voice.patchVoice && voice.patchVoice.release) {
      voice.patchVoice.release(0);
      this.arpVoice = null;
      return;
    }
    
    // Legacy voice cleanup
    if (voice.gain) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    }
    
    if (voice.osc) {
      voice.osc.stop(now + 0.1);
      setTimeout(() => {
        try {
          voice.osc.disconnect();
          if (voice.gain) voice.gain.disconnect();
        } catch (e) {}
      }, 150);
    }
    
    this.arpVoice = null;
  }

  setFilterCutoff(freq) {
    if (this.masterFilter) {
      // Clamp frequency to safe range
      const safeFreq = Math.max(20, Math.min(20000, freq));
      this.masterFilter.frequency.setTargetAtTime(safeFreq, this.ctx.currentTime, 0.1);
    }
  }

  setVolume(val) {
    // Exponential curve for more natural volume control (0-99 range)
    const gain = Math.pow(val / 99, 2);
    this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.02);
  }

  isRecordingSupported() {
    return typeof MediaRecorder !== 'undefined' && !!this.recordDestination;
  }

  startRecording() {
    if (!this.isRecordingSupported() || this.isRecording) return false;
    try {
      this.resume();
      this.recordedChunks = [];
      const options = {};
      const preferred = 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported(preferred)) {
        options.mimeType = preferred;
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm';
      }
      this.mediaRecorder = new MediaRecorder(this.recordDestination.stream, options);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };
      this.mediaRecorder.start();
      this.isRecording = true;
      return true;
    } catch (e) {
      console.error('Failed to start recording', e);
      this.mediaRecorder = null;
      this.isRecording = false;
      return false;
    }
  }

  async stopRecording() {
    if (!this.mediaRecorder || !this.isRecording) return null;
    return new Promise((resolve) => {
      const recorder = this.mediaRecorder;
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.mediaRecorder = null;
        this.isRecording = false;
        this.recordedChunks = [];
        resolve(blob);
      };
      recorder.stop();
    });
  }

  createSaturationCurve(amount = 1) {
    const k = Math.max(0.01, amount) * 12;
    const samples = 1024;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  playClick(time, isAccent) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.frequency.value = isAccent ? 1200 : 800;
    osc.type = 'square';
    
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    
    osc.start(time);
    osc.stop(time + 0.05);
  }
}
