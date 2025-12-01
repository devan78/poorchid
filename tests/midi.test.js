import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PoorchidApp } from '../src/main';

// Mock dependencies
vi.mock('../src/audio-engine', () => ({
  AudioEngine: vi.fn().mockImplementation(() => ({
    ctx: {
      createGain: vi.fn(() => ({ 
        gain: { value: 0 }, 
        connect: vi.fn() 
      })),
      createOscillator: vi.fn(() => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        frequency: { value: 0 }
      })),
      currentTime: 0
    },
    resume: vi.fn(),
    playChord: vi.fn(),
    stopAll: vi.fn(),
    playBass: vi.fn(),
    stopBass: vi.fn(),
    setBassVolume: vi.fn(),
    setVolume: vi.fn(),
    setFilterCutoff: vi.fn(),
    setPatch: vi.fn(),
    setFxLevels: vi.fn(),
    setFxBpm: vi.fn(),
    setFxBypass: vi.fn(),
    setFlavourEnabled: vi.fn(),
    playNote: vi.fn(),
    stopNote: vi.fn(),
    playArpNote: vi.fn(),
    playClick: vi.fn(),
    activeOscillators: new Map(),
    masterGain: { gain: { value: 0 }, connect: vi.fn() }
  }))
}));

vi.mock('../src/midi-handler', () => ({
  MidiHandler: vi.fn().mockImplementation(({ onNoteOn, onNoteOff, onControlChange, onPitchBend }) => ({
    init: vi.fn(),
    // Helper to trigger callbacks manually in tests
    triggerNoteOn: (note, vel) => onNoteOn(note, vel),
    triggerNoteOff: (note) => onNoteOff(note),
    triggerControlChange: (cc, val) => onControlChange(cc, val),
    triggerPitchBend: (lsb, msb) => onPitchBend(lsb, msb)
  }))
}));

describe('MIDI Integration', () => {
  let app;
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="synth-interface"></div>';
    container = document.getElementById('synth-interface');
    app = new PoorchidApp();
    app.state.powered = true; // Simulate power on
  });

  it('should handle MIDI Note On', () => {
    // Middle C (60) -> 'C'
    app.midi.triggerNoteOn(60, 100);
    
    expect(app.state.root).toBe('C');
    expect(app.state.activeMidiNotes.has(60)).toBe(true);
    expect(app.audio.playChord).toHaveBeenCalled();
  });

  it('should handle MIDI Note Off (Last Note Priority)', () => {
    // Press C (60)
    app.midi.triggerNoteOn(60, 100);
    expect(app.state.root).toBe('C');

    // Press D (62)
    app.midi.triggerNoteOn(62, 100);
    expect(app.state.root).toBe('D');
    expect(app.state.activeMidiNotes.size).toBe(2);

    // Release D
    app.midi.triggerNoteOff(62);
    expect(app.state.activeMidiNotes.size).toBe(1);
    // Should revert to C
    expect(app.state.root).toBe('C');
    
    // Release C
    app.midi.triggerNoteOff(60);
    expect(app.state.activeMidiNotes.size).toBe(0);
    expect(app.audio.stopAll).toHaveBeenCalled();
  });

  it('should handle MIDI Control Change (Mod Wheel -> Filter)', () => {
    // CC 1 (Mod Wheel) with value 127 (Max)
    app.midi.triggerControlChange(1, 127);
    
    // Should set filter to max (10000)
    expect(app.audio.setFilterCutoff).toHaveBeenCalledWith(10000);
    
    // CC 1 with value 0 (Min)
    app.midi.triggerControlChange(1, 0);
    expect(app.audio.setFilterCutoff).toHaveBeenCalledWith(100);
  });

  it('should handle MIDI Pitch Bend (Pitch Ribbon -> Voicing)', () => {
    // Pitch bend is currently ignored to keep voicing stable
    const initialVoicing = app.state.voicingCenter;
    
    // Pitch Bend Max (16383)
    app.midi.triggerPitchBend(127, 127);
    
    expect(app.state.voicingCenter).toBe(initialVoicing);
  });
  
  it('should handle Keyboard Split (Extensions vs Root)', () => {
    // Low notes (C0=12) trigger extensions
    app.midi.triggerNoteOn(12, 100);
    expect(app.state.extensions.has('6')).toBe(true);
    
    // Release Extension
    app.midi.triggerNoteOff(12);
    expect(app.state.extensions.has('6')).toBe(false);
    
    // Full keyboard range works for root notes (any octave)
    app.midi.triggerNoteOn(62, 100); // D4
    expect(app.state.root).toBe('D');
    
    app.midi.triggerNoteOff(62);
    app.midi.triggerNoteOn(38, 100); // D2
    expect(app.state.root).toBe('D');
  });
});
