export class VoicingEngine {
  /**
   * Adjusts the octave of each note to be closest to the centerNote.
   * @param {number[]} notes - Array of MIDI note numbers
   * @param {number} centerNote - The target center pitch (MIDI number)
   * @returns {number[]} - Array of voiced MIDI notes
   */
  getVoicing(notes, centerNote) {
    return notes.map(note => {
      // Normalize note to 0-11 range (chromatic class)
      const chroma = note % 12;
      
      // Find the octave of this chroma closest to centerNote
      // centerNote = 12 * octave + chroma_center
      // We want 12 * x + chroma approx centerNote
      // 12 * x approx centerNote - chroma
      // x approx (centerNote - chroma) / 12
      
      const approxOctave = Math.round((centerNote - chroma) / 12);
      const candidate = chroma + (approxOctave * 12);
      
      return candidate;
    }).sort((a, b) => a - b);
  }
}
