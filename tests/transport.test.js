import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LookaheadClock, Metronome, dispatchAt } from '../src/transport';

describe('LookaheadClock', () => {
  let ctx;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = { currentTime: 0 };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules every step inside the lookahead window on start', () => {
    const clock = new LookaheadClock(ctx, { lookahead: 25, scheduleAhead: 0.1 });
    const times = [];
    // Fixed 0.05s steps: window [0, 0.1) fits times 0 and 0.05.
    clock.start(0, (time) => { times.push(time); return 0.05; });

    expect(times).toEqual([0, 0.05]);
    expect(clock.nextTime).toBeCloseTo(0.1, 6);

    clock.stop();
  });

  it('advances on each pump as the audio clock moves forward', () => {
    const clock = new LookaheadClock(ctx, { lookahead: 25, scheduleAhead: 0.1 });
    const times = [];
    clock.start(0, (time) => { times.push(time); return 0.05; });
    expect(times.length).toBe(2);

    // Move the audio clock forward and let the pump fire again.
    ctx.currentTime = 0.1;
    vi.advanceTimersByTime(25);
    expect(times.length).toBe(4);
    expect(times[2]).toBeCloseTo(0.1, 6);
    expect(times[3]).toBeCloseTo(0.15, 6);

    clock.stop();
  });

  it('stops pumping after stop()', () => {
    const clock = new LookaheadClock(ctx, { lookahead: 25, scheduleAhead: 0.1 });
    let calls = 0;
    clock.start(0, () => { calls++; return 0.05; });
    const after = calls;
    clock.stop();

    ctx.currentTime = 1.0;
    vi.advanceTimersByTime(100);
    expect(calls).toBe(after);
    expect(clock.running).toBe(false);
  });

  it('halts instead of spinning on a non-positive duration', () => {
    const clock = new LookaheadClock(ctx, { lookahead: 25, scheduleAhead: 0.1 });
    let calls = 0;
    clock.start(0, () => { calls++; return 0; });
    expect(calls).toBe(1);        // fired once, then bailed
    expect(clock.running).toBe(false);
  });
});

describe('dispatchAt', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires at the target audio time (relative to now)', () => {
    const ctx = { currentTime: 0 };
    const fn = vi.fn();
    dispatchAt(ctx, 0.2, fn); // ~200ms in the future
    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2); // cover setTimeout's integer-ms truncation
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('Metronome', () => {
  let ctx;
  let onClick;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = { currentTime: 0 };
    onClick = vi.fn();
  });

  afterEach(() => vi.useRealTimers());

  it('accents the first click and spaces by quarter note', () => {
    const metro = new Metronome(ctx, onClick);
    metro.setBpm(120); // quarter note = 0.5s
    metro.start(0);

    // Window [0, 0.1): only the downbeat at t=0 fits.
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(0, true);
    expect(metro.clock.nextTime).toBeCloseTo(0.5, 6);

    metro.stop();
    expect(metro.running).toBe(false);
  });

  it('does not double-start', () => {
    const metro = new Metronome(ctx, onClick);
    metro.start(0);
    const first = onClick.mock.calls.length;
    metro.start(0); // ignored while running
    expect(onClick.mock.calls.length).toBe(first);
    metro.stop();
  });
});
