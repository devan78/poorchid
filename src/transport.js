/**
 * Transport - shared timing primitives for Poorchid's performance engines.
 *
 * `LookaheadClock` factors out the "tale of two clocks" scheduling loop that was
 * previously duplicated in the arpeggiator, pattern player and beat engine: a
 * setTimeout pump that, on each wakeup, schedules every step whose audio time
 * falls inside a short lookahead window. The client supplies a `stepFn(time)`
 * that schedules whatever should happen at `time` and returns the duration (in
 * seconds) until the next step. Step durations may vary between calls (e.g. arp
 * divisions), so the client owns them.
 *
 * Two kinds of clients:
 *  - Audio-time clients (drums, metronome clicks) build Web Audio nodes and
 *    schedule them precisely with `node.start(time)`.
 *  - Immediate-playback clients (the monophonic arp/pattern voices, whose patch
 *    voices always start at `ctx.currentTime`) cannot pre-schedule, so they use
 *    `dispatchAt(time, fn)` to fire the trigger at the right wall-clock moment
 *    instead of bunching every lookahead-window step together at once.
 */
export const LOOKAHEAD_MS = 25;        // how often the scheduler pump wakes up
export const SCHEDULE_AHEAD_S = 0.1;   // how far ahead to schedule each wakeup

export class LookaheadClock {
  constructor(audioContext, { lookahead = LOOKAHEAD_MS, scheduleAhead = SCHEDULE_AHEAD_S } = {}) {
    this.ctx = audioContext;
    this.lookahead = lookahead;
    this.scheduleAhead = scheduleAhead;
    this.running = false;
    this.nextTime = 0;
    this.stepFn = null;
    this._timer = null;
  }

  /**
   * Start pumping. `stepFn(time)` is called once per step with the step's audio
   * time and must return the seconds until the following step.
   */
  start(startTime, stepFn) {
    this.stepFn = stepFn;
    this.nextTime = startTime != null ? startTime : this.ctx.currentTime;
    this.running = true;
    this._pump();
  }

  _pump() {
    if (!this.running) return;
    while (this.nextTime < this.ctx.currentTime + this.scheduleAhead) {
      const duration = this.stepFn(this.nextTime);
      // Guard against a zero/invalid duration spinning the loop forever.
      if (!(duration > 0)) { this.stop(); return; }
      this.nextTime += duration;
    }
    this._timer = setTimeout(() => this._pump(), this.lookahead);
  }

  stop() {
    this.running = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }
}

/**
 * Schedule `fn` to run at audio time `time` using wall-clock dispatch.
 * Returns the timer id so the caller can cancel it. Used by immediate-playback
 * engines that can't hand a future time to the Web Audio graph directly.
 */
export function dispatchAt(ctx, time, fn) {
  const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
  return setTimeout(fn, delayMs);
}

/**
 * Metronome - a standalone click track driven by a LookaheadClock.
 * Clicks on quarter notes, accenting the first of every four.
 */
export class Metronome {
  constructor(audioContext, onClick) {
    this.ctx = audioContext;
    this.onClick = onClick || (() => {});
    this.bpm = 120;
    this.beat = 0;
    this.running = false;
    this.clock = new LookaheadClock(audioContext);
  }

  setBpm(bpm) {
    this.bpm = bpm;
  }

  start(startTime = null) {
    if (this.running) return;
    this.running = true;
    this.beat = 0;
    this.clock.start(startTime, (time) => {
      this.onClick(time, this.beat % 4 === 0);
      this.beat = (this.beat + 1) % 4;
      return 60 / this.bpm; // quarter-note spacing
    });
  }

  stop() {
    this.running = false;
    this.clock.stop();
  }
}
