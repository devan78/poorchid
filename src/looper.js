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
    this.bpm = 120;
    this.bars = 0;
  }

  setBpm(bpm) {
    this.bpm = bpm;
  }

  record(fixedBars = 0, startTime = null) {
    if (this.state === 'idle') {
      this.state = 'recording';
      this.startTime = startTime || this.context.currentTime;
      this.layers = [{ events: [] }];
      this.currentLayerIndex = 0;
      this.bars = fixedBars;

      // Handle fixed length recording
      if (fixedBars > 0) {
        const beatDuration = 60 / this.bpm;
        const duration = fixedBars * 4 * beatDuration; // 4 beats per bar
        this.loopDuration = duration;
        
        // Schedule metronome
        if (this.callbacks.onMetronome) {
          for (let i = 0; i < fixedBars * 4; i++) {
             const time = this.startTime + (i * beatDuration);
             const isAccent = i % 4 === 0;
             this.callbacks.onMetronome(time, isAccent);
          }
        }

        // Start progress loop
        const progressLoop = () => {
            if (this.state !== 'recording') return;
            
            const now = this.context.currentTime;
            if (now < this.startTime) {
                 // Pre-roll or waiting
                 requestAnimationFrame(progressLoop);
                 return;
            }
            
            const elapsed = now - this.startTime;
            const progress = Math.min(1, elapsed / this.loopDuration);
            
            const totalBars = this.bars;
            const currentBar = Math.min(totalBars, Math.floor(progress * totalBars) + 1);

            if (this.callbacks.onProgress) {
                this.callbacks.onProgress(progress, currentBar, totalBars);
            }
            
            if (progress < 1) {
                requestAnimationFrame(progressLoop);
            }
        };
        requestAnimationFrame(progressLoop);

        // Auto-stop recording after duration
        const now = this.context.currentTime;
        const delay = ((this.startTime + this.loopDuration) - now) * 1000;

        setTimeout(() => {
          if (this.state === 'recording') {
            this.play(); // Switch to play mode
          }
        }, Math.max(0, delay));
      } else {
        this.loopDuration = 0; // Free mode
        this.bars = 0;
      }
    }
  }

  play(startTime = null) {
    if (this.state === 'recording') {
      // Finish recording
      if (this.loopDuration === 0) {
        // Free mode: snap to nearest beat
        const rawDuration = this.context.currentTime - this.startTime;
        const beatDuration = 60 / this.bpm;
        const beats = Math.round(rawDuration / beatDuration);
        const snappedBeats = Math.max(1, beats); // Minimum 1 beat
        this.loopDuration = snappedBeats * beatDuration;
      }
      // If fixed mode, loopDuration is already set
      
      this.state = 'playing';
      this.startPlayback(startTime);
    } else if (this.state === 'overdubbing') {
      this.state = 'playing';
    } else if (this.state === 'idle' && this.layers.length > 0) {
      this.state = 'playing';
      this.startPlayback(startTime);
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

  startPlayback(startTime = null) {
    const now = this.context.currentTime;
    const start = startTime || now;
    
    if (start > now) {
       setTimeout(() => {
           if (this.state === 'playing') { 
               this.startPlayback(start);
           }
       }, (start - now) * 1000);
       return;
    }

    this.loopStartContextTime = start;
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
        const totalBars = this.bars || Math.max(1, Math.round(this.loopDuration / (60/this.bpm * 4)));
        const currentBar = Math.floor((currentLoopTime / this.loopDuration) * totalBars) + 1;
        this.callbacks.onProgress(currentLoopTime / this.loopDuration, currentBar, totalBars);
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
