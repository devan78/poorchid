export class Looper {
  constructor(audioContext, callbacks) {
    this.context = audioContext;
    this.callbacks = callbacks; // { onPlay, onStop }
    
    this.state = 'idle'; // idle, recording, playing, overdubbing
    this.layers = []; // Array of { events: [] }
    this.currentLayerIndex = -1;
    this.activeNotes = new Set(); // Track notes currently playing during loop
    
    this.startTime = 0;
    this.loopDuration = 0;
    this.loopStartContextTime = 0;
    
    this.playbackInterval = null;
    this.lastTickTime = 0;
  }

  record() {
    if (this.state === 'idle') {
      this.state = 'recording';
      this.startTime = this.context.currentTime;
      this.layers = [{ events: [] }];
      this.currentLayerIndex = 0;
    }
  }

  play() {
    if (this.state === 'recording') {
      // Finish recording, set loop duration (minimum 100ms to prevent timing issues)
      this.loopDuration = Math.max(this.context.currentTime - this.startTime, 0.1);
      this.state = 'playing';
      this.startPlayback();
    } else if (this.state === 'overdubbing') {
      this.state = 'playing';
    } else if (this.state === 'idle' && this.layers.length > 0) {
      this.state = 'playing';
      this.startPlayback();
    } else if (this.state === 'playing') {
      // Already playing, maybe stop? Or re-trigger?
      // For now, do nothing or stop
      this.stop();
    }
  }

  overdub() {
    if (this.state === 'playing') {
      this.state = 'overdubbing';
      this.layers.push({ events: [] });
      this.currentLayerIndex = this.layers.length - 1;
    }
  }

  stop() {
    this.state = 'idle';
    if (this.playbackInterval) {
      cancelAnimationFrame(this.playbackInterval);
      this.playbackInterval = null;
    }
    // Stop all active loop notes to avoid hanging voices
    this.activeNotes.forEach(note => {
      if (this.callbacks.onStop) this.callbacks.onStop(note);
    });
    this.activeNotes.clear();
    this.lastTickTime = 0;
  }

  undo() {
    if (this.layers.length > 1) {
      this.layers.pop();
      this.currentLayerIndex = this.layers.length - 1;
    } else if (this.layers.length === 1) {
      // Clear the base layer but keep it? Or remove it?
      this.layers = [];
      this.stop();
    }
  }

  addEvent(event) {
    if (this.state !== 'recording' && this.state !== 'overdubbing') return;

    const relativeTime = (this.context.currentTime - this.startTime) % (this.loopDuration || Infinity);
    
    // If we are recording the first layer, loopDuration is Infinity/Unknown yet.
    // relativeTime is just time since start.
    
    this.layers[this.currentLayerIndex].events.push({
      ...event,
      time: relativeTime
    });
  }

  startPlayback() {
    this.loopStartContextTime = this.context.currentTime;
    this.lastTickTime = -Number.EPSILON; // Allow events at time 0 to fire on first tick
    
    const tick = () => {
      if (this.state !== 'playing' && this.state !== 'overdubbing') return;

      const currentContextTime = this.context.currentTime;
      const timeSinceStart = currentContextTime - this.loopStartContextTime;
      const currentLoopTime = timeSinceStart % this.loopDuration;

      // Handle loop wrap-around
      if (currentLoopTime < this.lastTickTime) {
        // Process events from lastTickTime to end of loop
        this.tick(this.loopDuration);
        this.lastTickTime = -0.01; // Reset slightly before 0 to catch 0 events
      }

      if (this.callbacks.onProgress) {
        this.callbacks.onProgress(currentLoopTime / this.loopDuration);
      }

      this.tick(currentLoopTime);
      
      this.lastTickTime = currentLoopTime;
      this.playbackInterval = requestAnimationFrame(tick);
    };

    this.playbackInterval = requestAnimationFrame(tick);
  }

  tick(currentLoopTime) {
    // Check all layers for events between lastTickTime and currentLoopTime
    this.layers.forEach(layer => {
      layer.events.forEach(event => {
        if (event.time > this.lastTickTime && event.time <= currentLoopTime) {
          this.triggerEvent(event);
        }
      });
    });
  }

  triggerEvent(event) {
    if (event.type === 'noteOn') {
      this.callbacks.onPlay(event.note, event.velocity);
      this.activeNotes.add(event.note);
    } else if (event.type === 'noteOff') {
      this.callbacks.onStop(event.note);
      this.activeNotes.delete(event.note);
    }
  }
}
