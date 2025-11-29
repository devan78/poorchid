import { midiToFreq } from './utils';

export class AudioEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Master Chain: Filter -> Compressor -> Master Gain -> Destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.4; // Boosted slightly for warmth

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.05;
    this.compressor.release.value = 0.2;

    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 2500; // Warm cutoff
    this.masterFilter.Q.value = 0.5; // Gentle resonance

    // Connect Chain
    this.masterFilter.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    
    // Global Drift LFO (Tape wobble simulation)
    this.driftLFO = this.ctx.createOscillator();
    this.driftLFO.frequency.value = 0.5; // Slow drift (0.5Hz)
    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.value = 15; // +/- 15 cents
    this.driftLFO.connect(this.driftGain);
    this.driftLFO.start();

    this.activeOscillators = new Map(); // Map<midiNote, Set<voice>>
    this.liveVoices = new Map(); // Map<midiNote, voice> for the live player

    // Bass Engine
    this.bassGain = this.ctx.createGain();
    this.bassGain.gain.value = 0.6; // Default bass volume
    this.bassGain.connect(this.compressor); // Route bass through compressor
    this.bassVoice = null;
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playNote(midiNote, time = 0) {
    const freq = midiToFreq(midiNote);
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
    gain.connect(this.masterFilter); // Connect to Filter instead of Master

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
