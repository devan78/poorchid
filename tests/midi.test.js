import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PoorchidApp } from '../src/main';

// Mock dependencies
vi.mock('../src/audio-engine', () => ({
  AudioEngine: vi.fn().mockImplementation(() => ({
    resume: vi.fn(),
    playChord: vi.fn(),
    stopAll: vi.fn(),
    playBass: vi.fn(),
    stopBass: vi.fn(),
    setBassVolume: vi.fn(),
    setVolume: vi.fn(),
    setFilterCutoff: vi.fn(),
    setPatch: vi.fn()
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
    // Pitch Bend Max (16383) -> Voicing 84
    // LSB = 127 (0x7F), MSB = 127 (0x7F) -> 16383
    app.midi.triggerPitchBend(127, 127);
    
    expect(app.state.voicingCenter).toBe(84);
    
    // Pitch Bend Min (0) -> Voicing 36
    app.midi.triggerPitchBend(0, 0);
    expect(app.state.voicingCenter).toBe(36);
    
    // Pitch Bend Center (8192) -> Voicing 60
    // 8192 = 0x2000. LSB = 0, MSB = 64 (0x40)
    app.midi.triggerPitchBend(0, 64);
    expect(app.state.voicingCenter).toBe(60);
  });
  
  it('should handle Keyboard Split (Extensions vs Root)', () => {
    // Note < 60 (e.g. 48 - C3) -> Extension '6'
    app.midi.triggerNoteOn(48, 100);
    expect(app.state.extensions.has('6')).toBe(true);
    
    // Release Extension
    app.midi.triggerNoteOff(48);
    expect(app.state.extensions.has('6')).toBe(false);
    
    // Note >= 60 (e.g. 62 - D) -> Root
    app.midi.triggerNoteOn(62, 100);
    expect(app.state.root).toBe('D');
  });
});
