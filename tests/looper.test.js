import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Looper } from '../src/looper';

describe('Looper', () => {
  let looper;
  let mockCallbacks;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCallbacks = {
      onPlay: vi.fn(),
      onStop: vi.fn()
    };
    // Mock AudioContext time
    const mockAudioContext = {
      currentTime: 0
    };
    looper = new Looper(mockAudioContext, mockCallbacks);
  });

  it('should start in idle state', () => {
    expect(looper.state).toBe('idle');
  });

  it('should start recording', () => {
    looper.record();
    expect(looper.state).toBe('recording');
    expect(looper.startTime).toBe(0);
  });

  it('should record events', () => {
    looper.record();
    looper.addEvent({ type: 'noteOn', note: 60, velocity: 100 });
    
    vi.advanceTimersByTime(1000);
    looper.context.currentTime = 1.0;
    
    looper.addEvent({ type: 'noteOff', note: 60 });
    
    expect(looper.layers[0].events).toHaveLength(2);
    expect(looper.layers[0].events[0].time).toBe(0);
    expect(looper.layers[0].events[1].time).toBe(1.0);
  });

  it('should stop recording and start playing immediately', () => {
    looper.record();
    vi.advanceTimersByTime(4000); // 4 seconds loop
    looper.context.currentTime = 4.0;
    
    looper.play(); // Stop recording, start playing
    
    expect(looper.state).toBe('playing');
    expect(looper.loopDuration).toBe(4.0);
  });

  it('should trigger callbacks during playback', () => {
    // Record a note at 0.1s
    looper.record();
    vi.advanceTimersByTime(100);
    looper.context.currentTime = 0.1;
    looper.addEvent({ type: 'noteOn', note: 60, velocity: 100 });
    
    // Stop at 1s
    vi.advanceTimersByTime(900);
    looper.context.currentTime = 1.0;
    looper.play();

    // Reset mocks for playback phase
    mockCallbacks.onPlay.mockClear();

    // Advance time to 0.1s into the loop
    // We need to simulate the loop tick
    looper.tick(0.1); 
    
    expect(mockCallbacks.onPlay).toHaveBeenCalledWith(60, 100);
  });

  it('should support overdubbing', () => {
    looper.record();
    // ... record base layer ...
    looper.play();
    
    looper.overdub();
    expect(looper.state).toBe('overdubbing');
    expect(looper.layers).toHaveLength(2); // Base layer + new layer
  });

  it('should undo last layer', () => {
    looper.record();
    looper.play();
    looper.overdub(); // Layer 2
    looper.play(); // Commit Layer 2
    
    expect(looper.layers).toHaveLength(2);
    
    looper.undo();
    expect(looper.layers).toHaveLength(1);
  });
});
