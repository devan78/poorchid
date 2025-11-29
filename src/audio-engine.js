import { midiToFreq } from './utils';
import { PATCHES, DEFAULT_PATCH } from './patch-manager';

export class AudioEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.currentPatch = PATCHES[DEFAULT_PATCH];
    this.patchId = DEFAULT_PATCH;
    
    // === TAME IMPALA CHAIN ===
    // Voices -> Phaser -> Chorus -> Tape Saturation -> Filter -> Compressor -> Master
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;

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

    // Tape Saturation (waveshaper for warmth)
    this.tapeWaveshaper = this.ctx.createWaveShaper();
    this.tapeWaveshaper.curve = this.createTapeSaturationCurve(0.4);
    this.tapeWaveshaper.oversample = '2x';
    
    // Chorus effect (stereo widening, Tame Impala shimmer)
    this.chorusDelay = this.ctx.createDelay(0.05);
    this.chorusDelay.delayTime.value = 0.012;
    this.chorusLFO = this.ctx.createOscillator();
    this.chorusLFO.type = 'sine';
    this.chorusLFO.frequency.value = 0.8;
    this.chorusDepth = this.ctx.createGain();
    this.chorusDepth.gain.value = 0.003;
    this.chorusLFO.connect(this.chorusDepth);
    this.chorusDepth.connect(this.chorusDelay.delayTime);
    this.chorusLFO.start();
    
    this.chorusMix = this.ctx.createGain();
    this.chorusMix.gain.value = 0.4;
    
    this.chorusDry = this.ctx.createGain();
    this.chorusDry.gain.value = 0.7;
    
    // Phaser (the Kevin Parker secret sauce)
    this.phaserFilters = [];
    this.phaserLFO = this.ctx.createOscillator();
    this.phaserLFO.type = 'sine';
    this.phaserLFO.frequency.value = 0.3; // Slow, dreamy sweep
    this.phaserDepth = this.ctx.createGain();
    this.phaserDepth.gain.value = 800;
    this.phaserLFO.connect(this.phaserDepth);
    this.phaserLFO.start();
    
    // Create 4-stage phaser (allpass filters)
    this.phaserInput = this.ctx.createGain();
    this.phaserInput.gain.value = 1;
    let lastNode = this.phaserInput;
    
    for (let i = 0; i < 4; i++) {
      const allpass = this.ctx.createBiquadFilter();
      allpass.type = 'allpass';
      allpass.frequency.value = 1000;
      allpass.Q.value = 0.5;
      this.phaserDepth.connect(allpass.frequency);
      lastNode.connect(allpass);
      lastNode = allpass;
      this.phaserFilters.push(allpass);
    }
    
    // Phaser feedback
    this.phaserFeedback = this.ctx.createGain();
    this.phaserFeedback.gain.value = 0.4;
    lastNode.connect(this.phaserFeedback);
    this.phaserFeedback.connect(this.phaserFilters[0]);
    
    // Phaser wet/dry mix
    this.phaserWet = ctx => lastNode;
    this.phaserDry = this.ctx.createGain();
    this.phaserDry.gain.value = 0.6;
    this.phaserWetGain = this.ctx.createGain();
    this.phaserWetGain.gain.value = 0.5;
    lastNode.connect(this.phaserWetGain);
    
    // === CONNECT THE CHAIN ===
    // Input stage (where voices connect)
    this.voiceInput = this.ctx.createGain();
    this.voiceInput.gain.value = 1;
    
    // Voice -> Phaser
    this.voiceInput.connect(this.phaserInput);
    this.voiceInput.connect(this.phaserDry);
    
    // Phaser -> Chorus
    const phaserOut = this.ctx.createGain();
    this.phaserWetGain.connect(phaserOut);
    this.phaserDry.connect(phaserOut);
    
    phaserOut.connect(this.chorusDelay);
    phaserOut.connect(this.chorusDry);
    this.chorusDelay.connect(this.chorusMix);
    
    // Chorus -> Tape Saturation
    const chorusOut = this.ctx.createGain();
    this.chorusMix.connect(chorusOut);
    this.chorusDry.connect(chorusOut);
    chorusOut.connect(this.tapeWaveshaper);
    
    // Tape -> Filter -> Compressor -> Master
    this.tapeWaveshaper.connect(this.masterFilter);
    this.masterFilter.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    
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
    this.bassGain.connect(this.compressor); // Bass bypasses phaser/chorus
    this.bassVoice = null;
  }

  // Tape saturation curve - soft clipping for warmth
  createTapeSaturationCurve(amount) {
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Soft saturation formula
      curve[i] = (Math.PI + amount) * x / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();;
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
    filter.frequency.value = 400; // Deep bass
    filter.Q.value = 2; // Resonant punch

    // Envelope (Punchy)
    const now = this.ctx.currentTime + time;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.8, now + 0.02); // Fast Attack
    gain.gain.exponentialRampToValueAtTime(0.5, now + 0.2); // Decay
    gain.gain.setValueAtTime(0.5, now + 0.2); // Sustain

    // Filter Envelope (Wow effect)
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.2);

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
    // Stop all active oscillators
    for (const voices of this.activeOscillators.values()) {
      for (const voice of voices) {
        this.stopNote(voice);
      }
    }
    this.liveVoices.clear();
    this.activeOscillators.clear();
  }

  setFilterCutoff(freq) {
    if (this.masterFilter) {
      // Clamp frequency to safe range
      const safeFreq = Math.max(20, Math.min(20000, freq));
      this.masterFilter.frequency.setTargetAtTime(safeFreq, this.ctx.currentTime, 0.1);
    }
  }
}
