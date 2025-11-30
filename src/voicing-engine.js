export class VoicingEngine {
  /**
   * Builds a voiced chord by inverting notes toward a target register.
   * Moves the lowest note up an octave or the highest note down to keep the stack
   * in a small window around the dial value, then gently recenters the whole chord.
   * @param {number[]} notes - Array of MIDI note numbers (ascending)
   * @param {number} centerNote - Target register from the voicing dial (MIDI number)
   * @returns {number[]} - Array of voiced MIDI notes (ascending)
   */
  getVoicing(notes, centerNote) {
    if (!notes || notes.length === 0) return [];
    const target = Math.max(24, Math.min(96, centerNote || 60)); // keep target sane
    const voiced = [...notes].sort((a, b) => a - b);

    // Pull the stack toward the target window by inverting extremes
    const window = 7; // ~ a fifth either side
    let guard = 0;
    while (guard < 24) { // prevent runaway loops
      const lowest = voiced[0];
      const highest = voiced[voiced.length - 1];
      if (lowest < target - window) {
        voiced[0] = lowest + 12;
        voiced.sort((a, b) => a - b);
      } else if (highest > target + window) {
        voiced[voiced.length - 1] = highest - 12;
        voiced.sort((a, b) => a - b);
      } else {
        break;
      }
      guard++;
    }

    // Nudge whole chord toward the dial position to avoid drift
    const avg = voiced.reduce((sum, n) => sum + n, 0) / voiced.length;
    const shiftOctaves = Math.round((target - avg) / 12);
    return voiced.map(n => n + shiftOctaves * 12).sort((a, b) => a - b);
  }
}
