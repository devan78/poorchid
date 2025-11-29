export function midiToFreq(midiNote) {
  if (!Number.isFinite(midiNote) || midiNote < 0 || midiNote > 127) {
    return 440; // Default to A4 for invalid notes
  }
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}
