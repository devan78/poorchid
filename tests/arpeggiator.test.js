import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Arpeggiator, Strummer } from '../src/arpeggiator';

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
  });
});
