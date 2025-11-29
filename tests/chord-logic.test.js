import { describe, it, expect } from 'vitest';
import { ChordLogic } from '../src/chord-logic';

describe('ChordLogic', () => {
  const logic = new ChordLogic();

  describe('Basic Triads', () => {
    it('should generate a C Major chord', () => {
      // C4 Major: C4 (60), E4 (64), G4 (67)
      const notes = logic.getNotes('C', 'major');
      expect(notes).toEqual([60, 64, 67]);
    });

    it('should generate a C Minor chord', () => {
      // C4 Minor: C4 (60), Eb4 (63), G4 (67)
      const notes = logic.getNotes('C', 'minor');
      expect(notes).toEqual([60, 63, 67]);
    });

    it('should generate a C Suspended chord (Sus4)', () => {
      // C4 Sus4: C4 (60), F4 (65), G4 (67)
      const notes = logic.getNotes('C', 'suspended');
      expect(notes).toEqual([60, 65, 67]);
    });

    it('should generate a C Diminished chord', () => {
      // C4 Dim: C4 (60), Eb4 (63), Gb4 (66)
      const notes = logic.getNotes('C', 'diminished');
      expect(notes).toEqual([60, 63, 66]);
    });
  });

  describe('Root Notes', () => {
    it('should handle sharps correctly (C#)', () => {
      // C#4 Major: C#4 (61), F4 (65), G#4 (68)
      const notes = logic.getNotes('C#', 'major');
      expect(notes).toEqual([61, 65, 68]);
    });

    it('should handle wrapping to next octave if needed (B)', () => {
      // B4 Major: B4 (71), D#5 (75), F#5 (78)
      const notes = logic.getNotes('B', 'major');
      expect(notes).toEqual([71, 75, 78]);
    });
  });

  describe('Extensions', () => {
    it('should add a 6th', () => {
      // C Major 6: C E G A (69)
      const notes = logic.getNotes('C', 'major', ['6']);
      expect(notes).toContain(69);
      expect(notes.length).toBe(4);
    });

    it('should add a minor 7th', () => {
      // C Major 7 (Dom7): C E G Bb (70)
      const notes = logic.getNotes('C', 'major', ['7']);
      expect(notes).toContain(70);
    });

    it('should add a Major 7th', () => {
      // C Major Maj7: C E G B (71)
      const notes = logic.getNotes('C', 'major', ['maj7']);
      expect(notes).toContain(71);
    });

    it('should add a 9th', () => {
      // C Major 9: C E G D (74) - usually added on top
      const notes = logic.getNotes('C', 'major', ['9']);
      expect(notes).toContain(74);
    });

    it('should handle multiple extensions', () => {
      // C Major 7 + 9: C E G Bb D
      const notes = logic.getNotes('C', 'major', ['7', '9']);
      expect(notes).toContain(70);
      expect(notes).toContain(74);
      expect(notes.length).toBe(5);
    });
  });
});
