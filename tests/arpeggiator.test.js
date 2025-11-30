import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Arpeggiator, Strummer, PatternPlayer } from '../src/arpeggiator';

describe('Arpeggiator', () => {
  let arp;
  let mockCtx;
  let onNoteOn;
  let onNoteOff;

  beforeEach(() => {
    mockCtx = {
      currentTime: 0
    };
    onNoteOn = vi.fn();
    onNoteOff = vi.fn();
    arp = new Arpeggiator(mockCtx, { onNoteOn, onNoteOff });
  });

  afterEach(() => {
    arp.stop();
  });

  describe('BPM', () => {
    it('should have default BPM of 120', () => {
      expect(arp.bpm).toBe(120);
    });

    it('should set BPM within valid range', () => {
      arp.setBpm(140);
      expect(arp.bpm).toBe(140);
    });

    it('should clamp BPM to minimum 20', () => {
      arp.setBpm(10);
      expect(arp.bpm).toBe(20);
    });

    it('should clamp BPM to maximum 300', () => {
      arp.setBpm(400);
      expect(arp.bpm).toBe(300);
    });
  });

  describe('Division', () => {
    it('should have default division of 1/8', () => {
      expect(arp.division).toBe('1/8');
    });

    it('should set valid divisions', () => {
      arp.setDivision('1/16');
      expect(arp.division).toBe('1/16');
    });

    it('should ignore invalid divisions', () => {
      arp.setDivision('invalid');
      expect(arp.division).toBe('1/8');
    });

    it('should cycle through divisions', () => {
      expect(arp.division).toBe('1/8');
      arp.cycleDivision(1);
      expect(arp.division).toBe('1/16');
      arp.cycleDivision(-1);
      expect(arp.division).toBe('1/8');
    });
  });

  describe('Pattern', () => {
    it('should have default pattern of up', () => {
      expect(arp.pattern).toBe('up');
    });

    it('should set valid patterns', () => {
      arp.setPattern('down');
      expect(arp.pattern).toBe('down');
    });

    it('should cycle through patterns', () => {
      expect(arp.pattern).toBe('up');
      arp.cyclePattern();
      expect(arp.pattern).toBe('down');
      arp.cyclePattern();
      expect(arp.pattern).toBe('updown');
      arp.cyclePattern();
      expect(arp.pattern).toBe('random');
      arp.cyclePattern();
      expect(arp.pattern).toBe('up'); // Wraps around
    });
  });

  describe('Notes', () => {
    it('should set and sort notes', () => {
      arp.setNotes([67, 60, 64]); // G, C, E
      expect(arp.currentNotes).toEqual([60, 64, 67]); // Sorted
    });

    it('should get next note in up pattern', () => {
      arp.setNotes([60, 64, 67]);
      arp.setPattern('up');
      
      expect(arp.getNextNote()).toBe(60);
      expect(arp.getNextNote()).toBe(64);
      expect(arp.getNextNote()).toBe(67);
      expect(arp.getNextNote()).toBe(60); // Wraps
    });

    it('should get next note in down pattern', () => {
      arp.setNotes([60, 64, 67]);
      arp.setPattern('down');
      
      expect(arp.getNextNote()).toBe(67);
      expect(arp.getNextNote()).toBe(64);
      expect(arp.getNextNote()).toBe(60);
      expect(arp.getNextNote()).toBe(67); // Wraps
    });
  });

  describe('Step Duration', () => {
    it('should calculate correct step duration for 1/8 notes at 120 BPM', () => {
      arp.setBpm(120);
      arp.setDivision('1/8');
      // 120 BPM = 2 beats per second, 1/8 = 0.5 beats = 0.25 seconds
      expect(arp.getStepDuration()).toBe(0.25);
    });

    it('should calculate correct step duration for 1/4 notes at 120 BPM', () => {
      arp.setBpm(120);
      arp.setDivision('1/4');
      // 120 BPM = 2 beats per second, 1/4 = 1 beat = 0.5 seconds
      expect(arp.getStepDuration()).toBe(0.5);
    });
  });

  describe('Tap Tempo', () => {
    it('should return current BPM after first tap', () => {
      const bpm = arp.tapTempo();
      expect(bpm).toBe(120); // Returns default BPM on first tap
    });
  });
});

describe('Strummer', () => {
  let strummer;
  let onNoteOn;
  let onNoteOff;

  beforeEach(() => {
    onNoteOn = vi.fn();
    onNoteOff = vi.fn();
    strummer = new Strummer({ onNoteOn, onNoteOff });
  });

  describe('Speed', () => {
    it('should have default strum time of 50ms', () => {
      expect(strummer.strumTime).toBe(50);
    });

    it('should set strum speed', () => {
      strummer.setSpeed(99); // Max speed = 0ms (fastest)
      expect(strummer.strumTime).toBe(0);
      
      strummer.setSpeed(0); // Min speed = 200ms (slowest)
      expect(strummer.strumTime).toBe(200);
    });
  });

  describe('Direction', () => {
    it('should have default direction of down', () => {
      expect(strummer.direction).toBe('down');
    });

    it('should toggle direction', () => {
      strummer.toggleDirection();
      expect(strummer.direction).toBe('up');
      strummer.toggleDirection();
      expect(strummer.direction).toBe('down');
    });
  });

  describe('Strum', () => {
    it('should track active notes during strum', () => {
      vi.useFakeTimers();
      
      strummer.setSpeed(99); // Max speed - all notes at once
      strummer.strum([60, 64, 67]);
      
      // Run all pending timers (even 0ms ones)
      vi.runAllTimers();
      
      // All notes should have played
      expect(onNoteOn).toHaveBeenCalledTimes(3);
      expect(strummer.activeNotes.size).toBe(3);
      
      vi.useRealTimers();
    });

    it('should release all notes', () => {
      strummer.activeNotes.add(60);
      strummer.activeNotes.add(64);
      strummer.activeNotes.add(67);
      
      strummer.release();
      
      expect(onNoteOff).toHaveBeenCalledTimes(3);
      expect(strummer.activeNotes.size).toBe(0);
    });

    it('clears pending timers on new strum', () => {
      vi.useFakeTimers();

      strummer.setSpeed(0); // slow, long delays
      strummer.strum([60, 64, 67]);
      expect(strummer.pendingTimers.length).toBeGreaterThan(0);

      // Trigger another strum immediately
      strummer.strum([65, 69, 72]);
      // Pending timers should have been cleared and replaced
      expect(strummer.pendingTimers.length).toBeGreaterThan(0);
      vi.runAllTimers();
      expect(onNoteOn).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });
  });
});

describe('PatternPlayer', () => {
  let pattern;
  let mockCtx;
  let onNoteOn;
  let onNoteOff;

  beforeEach(() => {
    mockCtx = {
      currentTime: 0
    };
    onNoteOn = vi.fn();
    onNoteOff = vi.fn();
    pattern = new PatternPlayer(mockCtx, { onNoteOn, onNoteOff });
  });

  afterEach(() => {
    pattern.stop();
  });

  describe('BPM', () => {
    it('should have default BPM of 120', () => {
      expect(pattern.bpm).toBe(120);
    });

    it('should set BPM within valid range', () => {
      pattern.setBpm(140);
      expect(pattern.bpm).toBe(140);
    });

    it('should clamp BPM to minimum 20', () => {
      pattern.setBpm(10);
      expect(pattern.bpm).toBe(20);
    });

    it('should clamp BPM to maximum 300', () => {
      pattern.setBpm(400);
      expect(pattern.bpm).toBe(300);
    });
  });

  describe('Patterns', () => {
    it('should have default pattern of straight', () => {
      expect(pattern.currentPatternName).toBe('straight');
    });

    it('should have 8 predefined patterns', () => {
      expect(pattern.patternOrder.length).toBe(8);
      expect(pattern.patternOrder).toContain('tresillo');
      expect(pattern.patternOrder).toContain('clave');
    });

    it('should set valid patterns', () => {
      pattern.setPattern('tresillo');
      expect(pattern.currentPatternName).toBe('tresillo');
    });

    it('should ignore invalid patterns', () => {
      pattern.setPattern('invalid');
      expect(pattern.currentPatternName).toBe('straight');
    });

    it('should cycle through patterns', () => {
      expect(pattern.currentPatternName).toBe('straight');
      pattern.cyclePattern(1);
      expect(pattern.currentPatternName).toBe('offbeat');
      pattern.cyclePattern(-1);
      expect(pattern.currentPatternName).toBe('straight');
    });

    it('should wrap around when cycling', () => {
      pattern.setPattern('funk'); // Last pattern
      pattern.cyclePattern(1);
      expect(pattern.currentPatternName).toBe('straight'); // Wraps to first
    });
  });

  describe('Notes', () => {
    it('should set and sort notes', () => {
      pattern.setNotes([67, 60, 64]);
      expect(pattern.currentNotes).toEqual([60, 64, 67]);
    });

    it('should cycle through chord notes', () => {
      pattern.setNotes([60, 64, 67]); // C major
      
      expect(pattern.getNextChordNote()).toBe(60);
      expect(pattern.getNextChordNote()).toBe(64);
      expect(pattern.getNextChordNote()).toBe(67);
      expect(pattern.getNextChordNote()).toBe(60); // Wraps
    });
  });

  describe('Step Duration', () => {
    it('should calculate step duration at 120 BPM', () => {
      pattern.setBpm(120);
      // 1/16th note at 120 BPM = 60/120/4 = 0.125 seconds
      expect(pattern.getStepDuration()).toBeCloseTo(0.125, 3);
    });

    it('should calculate step duration at 60 BPM', () => {
      pattern.setBpm(60);
      // 1/16th note at 60 BPM = 60/60/4 = 0.25 seconds
      expect(pattern.getStepDuration()).toBeCloseTo(0.25, 3);
    });
  });

  describe('Pattern Display', () => {
    it('should return display name for pattern', () => {
      expect(pattern.getPatternDisplayName()).toBe('STRAIGHT');
      pattern.setPattern('tresillo');
      expect(pattern.getPatternDisplayName()).toBe('TRESILLO');
    });
  });

  describe('Start/Stop', () => {
    it('should start and set isRunning', () => {
      pattern.start([60, 64, 67]);
      expect(pattern.isRunning).toBe(true);
      expect(pattern.currentNotes.length).toBe(3);
    });

    it('should stop and clear state', () => {
      pattern.start([60, 64, 67]);
      pattern.stop();
      expect(pattern.isRunning).toBe(false);
    });

    it('should not start with empty notes', () => {
      pattern.start([]);
      expect(pattern.isRunning).toBe(false);
    });
  });
});
