import { describe, it, expect } from 'vitest';
import { ChordLogic } from '../src/chord-logic';

describe('ChordLogic diatonic chord typing', () => {
  const logic = new ChordLogic();

  it('assigns major scale triad qualities', () => {
    expect(logic.getDiatonicChordType('C', 'C', 'major')).toBe('major'); // I
    expect(logic.getDiatonicChordType('D', 'C', 'major')).toBe('minor'); // ii
    expect(logic.getDiatonicChordType('E', 'C', 'major')).toBe('minor'); // iii
    expect(logic.getDiatonicChordType('F', 'C', 'major')).toBe('major'); // IV
    expect(logic.getDiatonicChordType('G', 'C', 'major')).toBe('major'); // V
    expect(logic.getDiatonicChordType('A', 'C', 'major')).toBe('minor'); // vi
    expect(logic.getDiatonicChordType('B', 'C', 'major')).toBe('diminished'); // vii°
  });

  it('rotates qualities for modal scales (dorian)', () => {
    // D dorian relative to C major (rotate left by 1)
    expect(logic.getDiatonicChordType('D', 'D', 'dorian')).toBe('minor'); // i (rotated ii from major)
    expect(logic.getDiatonicChordType('E', 'D', 'dorian')).toBe('minor'); // ii
    expect(logic.getDiatonicChordType('F', 'D', 'dorian')).toBe('major'); // III
    expect(logic.getDiatonicChordType('G', 'D', 'dorian')).toBe('major'); // IV
    expect(logic.getDiatonicChordType('A', 'D', 'dorian')).toBe('minor'); // v
    expect(logic.getDiatonicChordType('B', 'D', 'dorian')).toBe('diminished'); // vi°
    expect(logic.getDiatonicChordType('C', 'D', 'dorian')).toBe('major'); // VII
  });
});
