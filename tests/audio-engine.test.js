import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioEngine } from '../src/audio-engine';

// Mock Web Audio API
const createGainMock = vi.fn(() => ({
  connect: vi.fn(),
  gain: {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    setTargetAtTime: vi.fn(),
  },
  disconnect: vi.fn(),
}));

const createOscillatorMock = vi.fn(() => ({
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  disconnect: vi.fn(),
  frequency: { 
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  },
  detune: { value: 0 },
  type: 'sine',
}));

const createBiquadFilterMock = vi.fn(() => ({
  connect: vi.fn(),
  frequency: { value: 0 },
  Q: { value: 0 },
  gain: { value: 0 },
  type: 'lowpass'
}));

const createDynamicsCompressorMock = vi.fn(() => ({
  connect: vi.fn(),
  threshold: { value: 0 },
  ratio: { value: 0 },
  knee: { value: 0 },
  attack: { value: 0 },
  release: { value: 0 }
}));

const createDelayMock = vi.fn(() => ({
  connect: vi.fn(),
  delayTime: { value: 0 },
}));

const createWaveShaperMock = vi.fn(() => ({
  connect: vi.fn(),
  curve: null,
  oversample: 'none',
}));

const createStereoPannerMock = vi.fn(() => ({
  connect: vi.fn(),
  pan: { value: 0 }
}));

const createConstantSourceMock = vi.fn(() => ({
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  offset: { value: 0 }
}));

const createMediaStreamDestinationMock = vi.fn(() => ({
  stream: {},
  connect: vi.fn()
}));

const audioContextMock = {
  createGain: createGainMock,
  createOscillator: createOscillatorMock,
  createBiquadFilter: createBiquadFilterMock,
  createDynamicsCompressor: createDynamicsCompressorMock,
  createDelay: createDelayMock,
  createWaveShaper: createWaveShaperMock,
  createStereoPanner: createStereoPannerMock,
  createConstantSource: createConstantSourceMock,
  createMediaStreamDestination: createMediaStreamDestinationMock,
  destination: {},
  currentTime: 0,
  state: 'suspended',
  resume: vi.fn(),
};

window.AudioContext = vi.fn(() => audioContextMock);
window.webkitAudioContext = window.AudioContext;

describe('AudioEngine', () => {
  let engine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new AudioEngine();
  });

  it('should initialize AudioContext', () => {
    expect(window.AudioContext).toHaveBeenCalled();
    expect(engine.ctx).toBeDefined();
  });

  it('should create master gain', () => {
    expect(createGainMock).toHaveBeenCalled();
    expect(engine.masterGain).toBeDefined();
    expect(engine.masterFilter).toBeDefined();
    expect(engine.compressor).toBeDefined();
  });

  it('should play a note', () => {
    engine.playNote(60); // Middle C
    expect(createOscillatorMock).toHaveBeenCalled();
    expect(engine.activeOscillators.has(60)).toBe(true);
  });

  it('should allow playing the same note twice (polyphony)', () => {
    // Each note now uses 3 oscillators (carrier, modulator, harmonic) in the EP patch
    // Plus 1 call from constructor (Drift LFO)
    engine.playNote(60);
    engine.playNote(60);
    // Just verify we can have 2 voices for the same note
    expect(engine.activeOscillators.get(60).size).toBe(2);
  });

  it('should stop a note', () => {
    const voice = engine.playNote(60);
    engine.stopNote(voice);
    // Note is removed from active map immediately (if it was the only voice)
    expect(engine.activeOscillators.has(60)).toBe(false);
  });

  it('should play a chord', () => {
    engine.playChord([60, 64, 67]);
    expect(engine.liveVoices.size).toBe(3);
    expect(engine.liveVoices.has(60)).toBe(true);
    expect(engine.liveVoices.has(64)).toBe(true);
    expect(engine.liveVoices.has(67)).toBe(true);
  });

  it('should update chord (stop old notes, play new ones)', () => {
    engine.playChord([60, 64, 67]); // C Major
    engine.playChord([60, 63, 67]); // C Minor (E -> Eb)
    
    // 64 should be stopped, 63 started. 60 and 67 stay playing?
    // My implementation stops notes not in new chord.
    // And plays new notes.
    // If 60 is in both, playNote(60) returns early.
    
    expect(engine.liveVoices.has(64)).toBe(false);
    expect(engine.liveVoices.has(63)).toBe(true);
    expect(engine.liveVoices.has(60)).toBe(true);
  });
});
