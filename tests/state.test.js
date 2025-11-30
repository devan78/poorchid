import { describe, it, expect } from 'vitest';
import { PoorchidState } from '../src/state';

describe('PoorchidState playstyle and key helpers', () => {
  it('cycles playstyle safely', () => {
    const state = new PoorchidState();
    expect(state.get('playstyle')).toBe('advanced');
    state.cyclePlaystyle(1);
    expect(state.get('playstyle')).toBe('free');
    state.cyclePlaystyle(1);
    expect(state.get('playstyle')).toBe('simple');
  });

  it('toggles key auto-chords', () => {
    const state = new PoorchidState();
    expect(state.get('keyAutoChords')).toBe(true);
    state.toggleKeyAutoChords();
    expect(state.get('keyAutoChords')).toBe(false);
    state.setKeyAutoChords(true);
    expect(state.get('keyAutoChords')).toBe(true);
  });
});
