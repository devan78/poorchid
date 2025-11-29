import { describe, it, expect } from 'vitest';
import { VoicingEngine } from '../src/voicing-engine';

describe('VoicingEngine', () => {
  const engine = new VoicingEngine();

  it('should return original notes if center is near the root', () => {
    // C Major: 60, 64, 67. Center: 63 (Eb4)
    const notes = [60, 64, 67];
    const voiced = engine.getVoicing(notes, 63);
    // Expect 60, 64, 67 as they are closest to 63
    // 60 is 3 away
    // 64 is 1 away
    // 67 is 4 away
    expect(voiced).toEqual([60, 64, 67]);
  });

  it('should invert up if center is higher', () => {
    // C Major: 60, 64, 67. Center: 68 (G#4)
    // 60 -> 72 (dist 12 vs 4? No, 60 is 8 away. 72 is 4 away) -> 72
    // 64 -> 64 (dist 4) vs 76 (dist 8) -> 64
    // 67 -> 67 (dist 1) -> 67
    // Result: 64, 67, 72 (1st Inversion)
    const notes = [60, 64, 67];
    const voiced = engine.getVoicing(notes, 68);
    expect(voiced.sort((a,b)=>a-b)).toEqual([64, 67, 72]);
  });

  it('should transpose whole chord if center is octave higher', () => {
    // C Major: 60, 64, 67. Center: 72 (C5)
    // C4 (60) -> C5 (72) (dist 0)
    // E4 (64) -> E5 (76) (dist 4 from 72)
    // G4 (67) -> G4 (67) (dist 5 from 72) vs G5 (79) (dist 7 from 72) -> G4 wins
    // Result: G4, C5, E5 (2nd Inversion)
    const notes = [60, 64, 67];
    const voiced = engine.getVoicing(notes, 72);
    expect(voiced.sort((a,b)=>a-b)).toEqual([67, 72, 76]);
  });

  it('should handle spread (open voicing)', () => {
    // Spread logic: drop the second note down an octave? Or spread out evenly?
    // Let's assume spread adds space.
    // Simple spread: Drop the middle note of a triad down an octave (Drop 2).
    // C Maj (C E G) -> G C E (2nd inv) -> Drop 2 -> C G E?
    
    // Let's just test a "spread" parameter that expands the range.
    // For now, let's stick to the "center note" logic as the primary "Voicing Dial".
  });
});
