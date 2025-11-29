import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PoorchidState } from '../src/state';

describe('PoorchidState', () => {
  let state;
  let listener;

  beforeEach(() => {
    state = new PoorchidState();
    listener = vi.fn();
    state.subscribe(listener);
  });

  describe('Bass functionality', () => {
    it('should have bass disabled by default', () => {
      expect(state.get('bassEnabled')).toBe(false);
    });

    it('should have default bass mode as chords', () => {
      expect(state.get('bassMode')).toBe('chords');
    });

    it('should have default bass voicing of 0', () => {
      expect(state.get('bassVoicing')).toBe(0);
    });

    it('should have default bass volume of 60', () => {
      expect(state.get('bassVolume')).toBe(60);
    });

    it('should toggle bass enabled', () => {
      expect(state.get('bassEnabled')).toBe(false);
      state.toggleBass();
      expect(state.get('bassEnabled')).toBe(true);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ bassEnabled: true }),
        ['bassEnabled']
      );
      
      state.toggleBass();
      expect(state.get('bassEnabled')).toBe(false);
    });

    it('should set bass enabled directly', () => {
      state.setBassEnabled(true);
      expect(state.get('bassEnabled')).toBe(true);
      
      state.setBassEnabled(false);
      expect(state.get('bassEnabled')).toBe(false);
    });

    it('should cycle through bass modes', () => {
      expect(state.get('bassMode')).toBe('chords');
      
      state.cycleBassMode();
      expect(state.get('bassMode')).toBe('unison');
      
      state.cycleBassMode();
      expect(state.get('bassMode')).toBe('single');
      
      state.cycleBassMode();
      expect(state.get('bassMode')).toBe('solo');
      
      state.cycleBassMode();
      expect(state.get('bassMode')).toBe('chords'); // Wraps around
    });

    it('should only accept valid bass modes', () => {
      state.setBassMode('unison');
      expect(state.get('bassMode')).toBe('unison');
      
      state.setBassMode('invalid-mode');
      expect(state.get('bassMode')).toBe('unison'); // Unchanged
    });

    it('should clamp bass voicing to valid range', () => {
      state.setBassVoicing(-30);
      expect(state.get('bassVoicing')).toBe(-24); // Clamped to min
      
      state.setBassVoicing(30);
      expect(state.get('bassVoicing')).toBe(24); // Clamped to max
      
      state.setBassVoicing(-12);
      expect(state.get('bassVoicing')).toBe(-12); // Within range
    });

    it('should clamp bass volume to 0-99 range', () => {
      state.setBassVolume(-10);
      expect(state.get('bassVolume')).toBe(0); // Clamped to min
      
      state.setBassVolume(150);
      expect(state.get('bassVolume')).toBe(99); // Clamped to max
      
      state.setBassVolume(50);
      expect(state.get('bassVolume')).toBe(50); // Within range
    });

    it('should notify listeners on bass state changes', () => {
      listener.mockClear();
      
      state.setBassEnabled(true);
      expect(listener).toHaveBeenCalledWith(
        expect.any(Object),
        ['bassEnabled']
      );

      listener.mockClear();
      state.setBassMode('solo');
      expect(listener).toHaveBeenCalledWith(
        expect.any(Object),
        ['bassMode']
      );

      listener.mockClear();
      state.setBassVoicing(12);
      expect(listener).toHaveBeenCalledWith(
        expect.any(Object),
        ['bassVoicing']
      );

      listener.mockClear();
      state.setBassVolume(80);
      expect(listener).toHaveBeenCalledWith(
        expect.any(Object),
        ['bassVolume']
      );
    });

    it('should not notify if value unchanged', () => {
      state.setBassEnabled(true);
      listener.mockClear();
      
      state.setBassEnabled(true); // Same value
      expect(listener).not.toHaveBeenCalled();

      state.setBassMode('unison');
      listener.mockClear();
      
      state.setBassMode('unison'); // Same value
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Basic state operations', () => {
    it('should set power state', () => {
      state.setPower(false);
      expect(state.get('powered')).toBe(false);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ powered: false }),
        ['powered']
      );
    });

    it('should set root note', () => {
      state.setRoot('D');
      expect(state.get('root')).toBe('D');
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ root: 'D' }),
        ['root']
      );
    });

    it('should set chord type', () => {
      state.setChordType('minor');
      expect(state.get('type')).toBe('minor');
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'minor' }),
        ['type']
      );
    });

    it('should toggle extensions', () => {
      state.toggleExtension('7');
      expect(state.get('extensions').has('7')).toBe(true);
      
      state.toggleExtension('7');
      expect(state.get('extensions').has('7')).toBe(false);
    });
  });
});
