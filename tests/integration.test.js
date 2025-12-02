import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PoorchidApp } from '../src/main';

// Mock AudioEngine
vi.mock('../src/audio-engine', () => {
  return {
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
  };
});

describe('PoorchidApp Integration', () => {
  let app;
  let container;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="synth-interface"></div>';
    container = document.getElementById('synth-interface');
    
    app = new PoorchidApp();
  });

  it('should render UI', () => {
    expect(container.querySelector('.encoder[data-encoder="volume"]')).toBeTruthy();
    expect(container.querySelector('.keyboard')).toBeTruthy();
  });

  it('should toggle power', () => {
    // Test power toggling through state directly (encoders handle power)
    expect(app.state.powered).toBe(true);
    
    app.stateManager.setPower(false);
    expect(app.state.powered).toBe(false);
    expect(app.audio.stopAll).toHaveBeenCalled();
    
    app.stateManager.setPower(true);
    expect(app.state.powered).toBe(true);
    expect(app.audio.resume).toHaveBeenCalled();
  });

  it('should change chord type', () => {
    app.stateManager.setChordType('minor');
    expect(app.state.type).toBe('minor');
  });

  it('should change root note', () => {
    const dKey = container.querySelector('.key[data-note="D"]');
    dKey.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(app.state.root).toBe('D');
    dKey.dispatchEvent(new Event('pointerup', { bubbles: true }));
  });

  it('should toggle extensions', () => {
    app.stateManager.setExtension('7', true);
    expect(app.state.extensions.has('7')).toBe(true);
    
    app.stateManager.setExtension('7', false);
    expect(app.state.extensions.has('7')).toBe(false);
  });

  it('should update voicing', () => {
    app.stateManager.setVoicingCenter(72);
    expect(app.state.voicingCenter).toBe(72);
  });

  it('should handle computer keyboard input', () => {
    app.state.powered = true;
    
    // Press 'H' (mapped to C)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    
    expect(app.state.root).toBe('C');
    expect(app.audio.playChord).toHaveBeenCalled();
    
    // Release 'H'
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'h' }));
    expect(app.audio.stopAll).toHaveBeenCalled();
  });

  it('should toggle extensions via keyboard (momentary)', () => {
    app.state.powered = true;
    // Simulate a held note so that changing extension triggers play
    app.state.activeMidiNotes.add(60); 
    app.state.isPlaying = true; // Simulate playing state
    
    // Press 'W' (mapped to '7')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    
    expect(app.state.extensions.has('7')).toBe(true);
    expect(app.audio.playChord).toHaveBeenCalled();
    
    // Release 'W'
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
    expect(app.state.extensions.has('7')).toBe(false);
  });

  it('should respect MIDI octave', () => {
    // C3 (48)
    app.handleMidiNoteOn(48, 100);
    
    // Expect playChord to be called
    expect(app.audio.playChord).toHaveBeenCalled();
    
    // Get the notes passed to playChord
    const calledArgs = app.audio.playChord.mock.calls[0][0];
    
    // Default C4 (60) major: [60, 64, 67]
    // C3 (48) major: [48, 52, 55]
    // With octave tracking, the voicing center should shift down to 48
    // So the resulting notes should be centered around 48
    const avg = calledArgs.reduce((a, b) => a + b, 0) / calledArgs.length;
    
    // Should be significantly lower than C4 (60)
    expect(avg).toBeLessThan(55); 
  });
});
