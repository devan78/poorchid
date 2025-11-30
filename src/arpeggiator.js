/**
 * Arpeggiator - Handles arpeggiated playback of chords
 * Supports multiple patterns, note divisions, and sync to BPM
 */
export class Arpeggiator {
  constructor(audioContext, callbacks = {}) {
    this.ctx = audioContext;
    this.onNoteOn = callbacks.onNoteOn || (() => {});
    this.onNoteOff = callbacks.onNoteOff || (() => {});
    
    // Timing
    this.bpm = 120;
    this.division = '1/8'; // Note division
    this.swingAmount = 0; // 0-99, swing feel
    
    // Pattern
    this.pattern = 'up'; // up, down, updown, random
    this.octaveRange = 1; // How many octaves to span (1-3)
    
    // State
    this.isRunning = false;
    this.currentNotes = [];
    this.currentIndex = 0;
    this.direction = 1; // 1 = up, -1 = down (for updown pattern)
    this.lastPlayedNote = null;
    
    // Scheduling
    this.nextNoteTime = 0;
    this.schedulerInterval = null;
    this.lookahead = 25; // ms to look ahead for scheduling
    this.scheduleAheadTime = 0.1; // seconds to schedule ahead
    
    // Note divisions in beats
    this.divisions = {
      '1/1': 4,
      '1/2': 2,
      '1/4': 1,
      '1/8': 0.5,
      '1/16': 0.25,
      '1/32': 0.125,
      '1/4T': 1 / 1.5,    // Triplet
      '1/8T': 0.5 / 1.5,
      '1/16T': 0.25 / 1.5,
      '1/4D': 1.5,        // Dotted
      '1/8D': 0.75,
      '1/16D': 0.375
    };
    
    this.divisionOrder = [
      '1/1', '1/2', '1/4', '1/8', '1/16', '1/32',
      '1/4T', '1/8T', '1/16T',
      '1/4D', '1/8D', '1/16D'
    ];
  }
  
  /**
   * Set the BPM
   */
  setBpm(bpm) {
    this.bpm = Math.max(20, Math.min(300, bpm));
  }
  
  /**
   * Set the note division
   */
  setDivision(division) {
    if (this.divisions[division] !== undefined) {
      this.division = division;
    }
  }
  
  /**
   * Cycle to next division
   */
  cycleDivision(direction = 1) {
    const currentIndex = this.divisionOrder.indexOf(this.division);
    const nextIndex = (currentIndex + direction + this.divisionOrder.length) % this.divisionOrder.length;
    this.division = this.divisionOrder[nextIndex];
    return this.division;
  }
  
  /**
   * Set the arp pattern
   */
  setPattern(pattern) {
    const validPatterns = ['up', 'down', 'updown', 'downup', 'random', 'order'];
    if (validPatterns.includes(pattern)) {
      this.pattern = pattern;
      this.currentIndex = 0;
      this.direction = pattern === 'down' || pattern === 'downup' ? -1 : 1;
    }
  }
  
  /**
   * Cycle through patterns
   */
  cyclePattern() {
    const patterns = ['up', 'down', 'updown', 'random'];
    const currentIndex = patterns.indexOf(this.pattern);
    const nextIndex = (currentIndex + 1) % patterns.length;
    this.setPattern(patterns[nextIndex]);
    return this.pattern;
  }
  
  /**
   * Set the notes to arpeggiate
   */
  setNotes(notes) {
    // Sort notes for consistent ordering
    this.currentNotes = [...notes].sort((a, b) => a - b);
    
    // Expand with octaves if needed
    if (this.octaveRange > 1) {
      const expanded = [...this.currentNotes];
      for (let oct = 1; oct < this.octaveRange; oct++) {
        this.currentNotes.forEach(note => {
          expanded.push(note + (oct * 12));
        });
      }
      this.currentNotes = expanded;
    }
    
    // Reset index if needed
    if (this.currentIndex >= this.currentNotes.length) {
      this.currentIndex = 0;
    }
  }
  
  /**
   * Get the next note based on current pattern
   */
  getNextNote() {
    if (this.currentNotes.length === 0) return null;
    
    let note;
    
    switch (this.pattern) {
      case 'up':
        note = this.currentNotes[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.currentNotes.length;
        break;
        
      case 'down':
        const downIndex = this.currentNotes.length - 1 - this.currentIndex;
        note = this.currentNotes[downIndex];
        this.currentIndex = (this.currentIndex + 1) % this.currentNotes.length;
        break;
        
      case 'updown':
      case 'downup':
        note = this.currentNotes[this.currentIndex];
        this.currentIndex += this.direction;
        
        // Bounce at ends
        if (this.currentIndex >= this.currentNotes.length - 1) {
          this.currentIndex = this.currentNotes.length - 1;
          this.direction = -1;
        } else if (this.currentIndex <= 0) {
          this.currentIndex = 0;
          this.direction = 1;
        }
        break;
        
      case 'random':
        const randomIndex = Math.floor(Math.random() * this.currentNotes.length);
        note = this.currentNotes[randomIndex];
        break;
        
      case 'order':
        // Play in the order they were added (for held notes)
        note = this.currentNotes[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.currentNotes.length;
        break;
        
      default:
        note = this.currentNotes[0];
    }
    
    return note;
  }
  
  /**
   * Get the duration of one step in seconds
   */
  getStepDuration() {
    const beatsPerStep = this.divisions[this.division] || 0.5;
    const secondsPerBeat = 60 / this.bpm;
    return beatsPerStep * secondsPerBeat;
  }
  
  /**
   * Schedule the next note
   */
  scheduleNote(time) {
    // Stop the previous note
    if (this.lastPlayedNote !== null) {
      this.onNoteOff(this.lastPlayedNote);
    }
    
    const note = this.getNextNote();
    if (note !== null) {
      // Calculate note duration (slightly less than step to avoid overlap)
      const stepDuration = this.getStepDuration();
      const noteDuration = stepDuration * 0.9;
      
      this.onNoteOn(note, 100, time);
      this.lastPlayedNote = note;
      
      // Schedule note off
      setTimeout(() => {
        if (this.lastPlayedNote === note) {
          this.onNoteOff(note);
          this.lastPlayedNote = null;
        }
      }, noteDuration * 1000);
    }
  }
  
  /**
   * Main scheduler loop
   */
  scheduler() {
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.nextNoteTime);
      this.nextNoteTime += this.getStepDuration();
    }
  }
  
  /**
   * Start the arpeggiator
   */
  start(notes = []) {
    if (notes.length > 0) {
      this.setNotes(notes);
    }
    
    if (this.currentNotes.length === 0) return;
    
    this.isRunning = true;
    this.currentIndex = 0;
    this.direction = this.pattern === 'down' || this.pattern === 'downup' ? -1 : 1;
    this.nextNoteTime = this.ctx.currentTime;
    
    // Start scheduler
    if (!this.schedulerInterval) {
      this.schedulerInterval = setInterval(() => this.scheduler(), this.lookahead);
    }
  }
  
  /**
   * Stop the arpeggiator
   */
  stop() {
    this.isRunning = false;
    
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    
    // Stop any playing note
    if (this.lastPlayedNote !== null) {
      this.onNoteOff(this.lastPlayedNote);
      this.lastPlayedNote = null;
    }
  }
  
  /**
   * Update notes while running
   */
  updateNotes(notes) {
    this.setNotes(notes);
  }
  
  /**
   * Tap tempo - call this repeatedly to set BPM from taps
   */
  tapTempo() {
    const now = performance.now();
    
    if (!this._tapTimes) {
      this._tapTimes = [];
    }
    
    // Reset if more than 2 seconds since last tap
    if (this._tapTimes.length > 0 && now - this._tapTimes[this._tapTimes.length - 1] > 2000) {
      this._tapTimes = [];
    }
    
    this._tapTimes.push(now);
    
    // Keep last 4 taps
    if (this._tapTimes.length > 4) {
      this._tapTimes.shift();
    }
    
    // Calculate average BPM from intervals
    if (this._tapTimes.length >= 2) {
      let totalInterval = 0;
      for (let i = 1; i < this._tapTimes.length; i++) {
        totalInterval += this._tapTimes[i] - this._tapTimes[i - 1];
      }
      const avgInterval = totalInterval / (this._tapTimes.length - 1);
      const newBpm = Math.round(60000 / avgInterval);
      this.setBpm(newBpm);
      return this.bpm;
    }
    
    return this.bpm;
  }
}

/**
 * PatternPlayer - Plays chord notes in pre-determined rhythmic patterns
 * Unlike arpeggiator, patterns maintain consistent timing regardless of note count
 */
export class PatternPlayer {
  constructor(audioContext, callbacks = {}) {
    this.ctx = audioContext;
    this.onNoteOn = callbacks.onNoteOn || (() => {});
    this.onNoteOff = callbacks.onNoteOff || (() => {});
    
    // Timing
    this.bpm = 120;
    
    // Predefined rhythm patterns (1 = note, 0 = rest)
    // Each pattern is 16 steps at 1/16th note resolution
    this.patterns = {
      'straight': [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],  // Straight 8ths
      'offbeat':  [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],  // Offbeat 8ths
      'pulse':    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],  // Quarter notes
      'tresillo': [1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0],  // 3-3-2 tresillo
      'clave':    [1,0,0,1,0,0,1,0,0,0,1,0,1,0,0,0],  // Son clave
      'shuffle':  [1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,0],  // Shuffle feel
      'waltz':    [1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],  // 3/4 feel (12 steps used)
      'funk':     [1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0],  // Funky syncopation
    };
    
    this.patternOrder = ['straight', 'offbeat', 'pulse', 'tresillo', 'clave', 'shuffle', 'waltz', 'funk'];
    this.currentPatternName = 'straight';
    
    // State
    this.isRunning = false;
    this.currentNotes = [];
    this.stepIndex = 0;
    this.noteIndex = 0; // Which chord note to play next
    this.lastPlayedNote = null;
    
    // Scheduling
    this.nextStepTime = 0;
    this.schedulerInterval = null;
    this.lookahead = 25; // ms
    this.scheduleAheadTime = 0.1; // seconds
  }
  
  /**
   * Set the BPM
   */
  setBpm(bpm) {
    this.bpm = Math.max(20, Math.min(300, bpm));
  }
  
  /**
   * Get current pattern
   */
  get pattern() {
    return this.patterns[this.currentPatternName];
  }
  
  /**
   * Set pattern by name
   */
  setPattern(name) {
    if (this.patterns[name]) {
      this.currentPatternName = name;
      this.stepIndex = 0;
      this.noteIndex = 0;
    }
  }
  
  /**
   * Cycle to next pattern
   */
  cyclePattern(direction = 1) {
    const currentIdx = this.patternOrder.indexOf(this.currentPatternName);
    const nextIdx = (currentIdx + direction + this.patternOrder.length) % this.patternOrder.length;
    this.setPattern(this.patternOrder[nextIdx]);
    return this.currentPatternName;
  }
  
  /**
   * Get pattern display name
   */
  getPatternDisplayName() {
    const names = {
      'straight': 'STRAIGHT',
      'offbeat': 'OFFBEAT',
      'pulse': 'PULSE',
      'tresillo': 'TRESILLO',
      'clave': 'CLAVE',
      'shuffle': 'SHUFFLE',
      'waltz': 'WALTZ',
      'funk': 'FUNK'
    };
    return names[this.currentPatternName] || this.currentPatternName.toUpperCase();
  }
  
  /**
   * Set the notes to pattern through
   */
  setNotes(notes) {
    this.currentNotes = [...notes].sort((a, b) => a - b);
    // Don't reset noteIndex - allows smooth chord changes
  }
  
  /**
   * Get step duration (1/16th note)
   */
  getStepDuration() {
    // Each step is a 1/16th note
    const secondsPerBeat = 60 / this.bpm;
    return secondsPerBeat / 4; // 1/16th = 1/4 of a beat
  }
  
  /**
   * Get the next note from the chord (cycles through)
   */
  getNextChordNote() {
    if (this.currentNotes.length === 0) return null;
    const note = this.currentNotes[this.noteIndex % this.currentNotes.length];
    this.noteIndex = (this.noteIndex + 1) % this.currentNotes.length;
    return note;
  }
  
  /**
   * Schedule the next step
   */
  scheduleStep(time) {
    const pattern = this.pattern;
    const shouldPlay = pattern[this.stepIndex] === 1;
    
    // Stop previous note
    if (this.lastPlayedNote !== null) {
      this.onNoteOff(this.lastPlayedNote);
      this.lastPlayedNote = null;
    }
    
    if (shouldPlay && this.currentNotes.length > 0) {
      const note = this.getNextChordNote();
      if (note !== null) {
        // Slight velocity variation for humanization
        const velocity = 90 + Math.floor(Math.random() * 20);
        this.onNoteOn(note, velocity, time);
        this.lastPlayedNote = note;
        
        // Schedule note off before next step
        const stepDuration = this.getStepDuration();
        setTimeout(() => {
          if (this.lastPlayedNote === note) {
            this.onNoteOff(note);
            this.lastPlayedNote = null;
          }
        }, stepDuration * 0.8 * 1000);
      }
    }
    
    // Advance step
    this.stepIndex = (this.stepIndex + 1) % pattern.length;
  }
  
  /**
   * Main scheduler loop
   */
  scheduler() {
    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleStep(this.nextStepTime);
      this.nextStepTime += this.getStepDuration();
    }
  }
  
  /**
   * Start the pattern player
   */
  start(notes = []) {
    if (notes.length > 0) {
      this.setNotes(notes);
    }
    
    if (this.currentNotes.length === 0) return;
    
    this.isRunning = true;
    this.stepIndex = 0;
    this.noteIndex = 0;
    this.nextStepTime = this.ctx.currentTime;
    
    if (!this.schedulerInterval) {
      this.schedulerInterval = setInterval(() => this.scheduler(), this.lookahead);
    }
  }
  
  /**
   * Stop the pattern player
   */
  stop() {
    this.isRunning = false;
    
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    
    if (this.lastPlayedNote !== null) {
      this.onNoteOff(this.lastPlayedNote);
      this.lastPlayedNote = null;
    }
  }
  
  /**
   * Update notes while running
   */
  updateNotes(notes) {
    this.setNotes(notes);
  }
}

/**
 * Strum - Plays chord notes with slight timing offsets
 */
export class Strummer {
  constructor(callbacks = {}) {
    this.onNoteOn = callbacks.onNoteOn || (() => {});
    this.onNoteOff = callbacks.onNoteOff || (() => {});
    
    this.strumTime = 50; // ms between notes (0-200)
    this.direction = 'down'; // down = low to high, up = high to low
    this.activeNotes = new Set();
    this.pendingTimers = [];
  }
  
  /**
   * Set strum speed (0-99: 0=slowest/200ms, 99=fastest/0ms)
   */
  setSpeed(speed) {
    // Invert: higher speed value = faster strum = less delay
    this.strumTime = ((99 - speed) / 99) * 200;
  }
  
  /**
   * Set strum direction
   */
  setDirection(dir) {
    if (dir === 'down' || dir === 'up') {
      this.direction = dir;
    }
  }
  
  /**
   * Toggle direction
   */
  toggleDirection() {
    this.direction = this.direction === 'down' ? 'up' : 'down';
    return this.direction;
  }
  
  /**
   * Strum a chord
   */
  strum(notes, velocity = 100) {
    this.clearPending();
    this.release();

    // Sort notes
    let sortedNotes = [...notes].sort((a, b) => a - b);
    
    // Reverse for up strum
    if (this.direction === 'up') {
      sortedNotes.reverse();
    }
    
    // Play each note with increasing delay
    sortedNotes.forEach((note, index) => {
      const delay = index * this.strumTime;
      
      const timer = setTimeout(() => {
        // Velocity can decrease slightly for later notes
        const noteVel = Math.max(60, velocity - (index * 5));
        this.onNoteOn(note, noteVel);
        this.activeNotes.add(note);
      }, delay);
      this.pendingTimers.push(timer);
    });
  }
  
  /**
   * Release all strummed notes
   */
  release() {
    this.clearPending();
    this.activeNotes.forEach(note => {
      this.onNoteOff(note);
    });
    this.activeNotes.clear();
  }

  clearPending() {
    this.pendingTimers.forEach(id => clearTimeout(id));
    this.pendingTimers = [];
  }
}
