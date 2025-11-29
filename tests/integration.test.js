import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PoorchidApp } from '../src/main';

// Mock AudioEngine
vi.mock('../src/audio-engine', () => {
  return {
    AudioEngine: vi.fn().mockImplementation(() => ({
      resume: vi.fn(),
      playChord: vi.fn(),
      stopAll: vi.fn(),
      playBass: vi.fn(),
      stopBass: vi.fn(),
      setBassVolume: vi.fn(),
      setFilterCutoff: vi.fn()
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
    expect(container.querySelector('#power-btn')).toBeTruthy();
    expect(container.querySelector('.keyboard')).toBeTruthy();
  });

  it('should toggle power', () => {
    const btn = container.querySelector('#power-btn');
    // Starts powered on by default now
    expect(app.state.powered).toBe(true);
    
    btn.click();
    expect(app.state.powered).toBe(false);
    expect(app.audio.stopAll).toHaveBeenCalled();
    
    btn.click();
    expect(app.state.powered).toBe(true);
    expect(app.audio.resume).toHaveBeenCalled();
  });

  it('should change chord type', () => {
    const minorBtn = container.querySelector('button[data-type="minor"]');
    minorBtn.click();
    expect(app.state.type).toBe('minor');
    expect(minorBtn.classList.contains('active')).toBe(true);
  });

  it('should change root note', () => {
    const dKey = container.querySelector('.key[data-note="D"]');
    dKey.click();
    expect(app.state.root).toBe('D');
    // Keys no longer show persistent active state - only transient pressed state while held
  });

  it('should toggle extensions', () => {
    const ext7 = container.querySelector('button[data-ext="7"]');
    ext7.click();
    expect(app.state.extensions.has('7')).toBe(true);
    
    ext7.click();
    expect(app.state.extensions.has('7')).toBe(false);
  });

  it('should update voicing', () => {
    const dial = container.querySelector('#voicing-dial');
    dial.value = 72;
    dial.dispatchEvent(new Event('input', { bubbles: true }));
    
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
});
