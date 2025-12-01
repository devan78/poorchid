export class BeatEngine {
  constructor(audioContext) {
    this.context = audioContext;
    this.bpm = 120;
    this.isPlaying = false;
    this.currentBeat = 0;
    this.nextNoteTime = 0;
    this.timerID = null;
    this.lookahead = 25.0; // ms
    this.scheduleAheadTime = 0.1; // s
    
    this.patternName = 'rock';
    this.patterns = {
      'rock': {
        length: 16,
        kick:  [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hat:   [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
      },
      'house': {
        length: 16,
        kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hat:   [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]
      },
      'hiphop': {
        length: 16,
        kick:  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hat:   [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1]
      },
      'techno': {
        length: 16,
        kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        hat:   [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]
      }
    };

    // Master Gain for Drums
    this.output = this.context.createGain();
    this.output.gain.value = 0.6;
  }

  setBpm(bpm) {
    this.bpm = bpm;
  }

  setPattern(name) {
    if (this.patterns[name]) {
      this.patternName = name;
    }
  }

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentBeat = 0;
    this.nextNoteTime = this.context.currentTime + 0.05;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    if (this.timerID) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  scheduler() {
    while (this.nextNoteTime < this.context.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentBeat, this.nextNoteTime);
      this.nextNote();
    }
    if (this.isPlaying) {
      this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
    }
  }

  nextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += 0.25 * secondsPerBeat; // 16th notes
    this.currentBeat = (this.currentBeat + 1) % 16;
  }

  scheduleNote(beatNumber, time) {
    const pattern = this.patterns[this.patternName];
    if (!pattern) return;

    if (pattern.kick[beatNumber]) {
      this.playKick(time);
    }
    if (pattern.snare[beatNumber]) {
      this.playSnare(time);
    }
    if (pattern.hat[beatNumber]) {
      this.playHiHat(time);
    }
  }

  playKick(time) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.connect(gain);
    gain.connect(this.output);

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    osc.start(time);
    osc.stop(time + 0.5);
  }

  playSnare(time) {
    const noiseBuffer = this.createNoiseBuffer();
    const noise = this.context.createBufferSource();
    noise.buffer = noiseBuffer;
    
    const noiseFilter = this.context.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;
    
    const noiseEnvelope = this.context.createGain();
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseEnvelope);
    noiseEnvelope.connect(this.output);
    
    noiseEnvelope.gain.setValueAtTime(1, time);
    noiseEnvelope.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    
    noise.start(time);
    noise.stop(time + 0.2);

    // Tonal component
    const osc = this.context.createOscillator();
    const oscEnv = this.context.createGain();
    osc.type = 'triangle';
    osc.connect(oscEnv);
    oscEnv.connect(this.output);
    
    osc.frequency.setValueAtTime(250, time);
    oscEnv.gain.setValueAtTime(0.5, time);
    oscEnv.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    
    osc.start(time);
    osc.stop(time + 0.1);
  }

  playHiHat(time) {
    const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
    const bandpass = this.context.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 10000;

    const highpass = this.context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 7000;

    const gain = this.context.createGain();
    
    // Create a stack of oscillators for metallic sound
    ratios.forEach(ratio => {
      const osc = this.context.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 40 * ratio;
      osc.connect(bandpass);
      osc.start(time);
      osc.stop(time + 0.05);
    });

    bandpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(this.output);

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
  }

  createNoiseBuffer() {
    const bufferSize = this.context.sampleRate * 2; // 2 seconds
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  getNextNoteTime() {
    return this.isPlaying ? this.nextNoteTime : this.context.currentTime;
  }

  getNextBarTime() {
    if (!this.isPlaying) return this.context.currentTime;
    const stepsToNextBar = (16 - this.currentBeat) % 16;
    const secondsPerStep = (60.0 / this.bpm) * 0.25;
    return this.nextNoteTime + (stepsToNextBar * secondsPerStep);
  }
}
