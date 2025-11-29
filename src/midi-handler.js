export class MidiHandler {
  constructor(callbacks) {
    this.callbacks = callbacks || {};
    this.access = null;
    this.inputs = new Map();
  }

  async init() {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not supported in this browser.');
      return false;
    }

    try {
      this.access = await navigator.requestMIDIAccess();
      
      // Listen for connection changes
      this.access.onstatechange = (e) => this.handleStateChange(e);

      // Bind existing inputs
      for (const input of this.access.inputs.values()) {
        this.bindInput(input);
      }

      return true;
    } catch (err) {
      console.error('Web MIDI Access failed:', err);
      return false;
    }
  }

  bindInput(input) {
    if (this.inputs.has(input.id)) return;
    
    console.log(`MIDI Input Connected: ${input.name}`);
    input.onmidimessage = (msg) => this.handleMessage(msg);
    this.inputs.set(input.id, input);
    
    if (this.callbacks.onConnection) {
      this.callbacks.onConnection(input.name, true);
    }
  }

  handleStateChange(e) {
    const port = e.port;
    if (port.type === 'input') {
      if (port.state === 'connected') {
        this.bindInput(port);
      } else {
        this.inputs.delete(port.id);
        if (this.callbacks.onConnection) {
          this.callbacks.onConnection(port.name, false);
        }
      }
    }
  }

  handleMessage(msg) {
    const [status, data1, data2] = msg.data;
    const command = status & 0xF0;
    // const channel = status & 0x0F;

    switch (command) {
      case 0x90: // Note On
        if (data2 > 0) {
          if (this.callbacks.onNoteOn) this.callbacks.onNoteOn(data1, data2);
        } else {
          // Velocity 0 is often treated as Note Off
          if (this.callbacks.onNoteOff) this.callbacks.onNoteOff(data1);
        }
        break;
      case 0x80: // Note Off
        if (this.callbacks.onNoteOff) this.callbacks.onNoteOff(data1);
        break;
      case 0xB0: // Control Change
        if (this.callbacks.onControlChange) this.callbacks.onControlChange(data1, data2);
        break;
      case 0xE0: // Pitch Bend
        if (this.callbacks.onPitchBend) this.callbacks.onPitchBend(data1, data2);
        break;
    }
  }

  destroy() {
    // Remove message handlers from all inputs
    for (const input of this.inputs.values()) {
      input.onmidimessage = null;
    }
    this.inputs.clear();
    
    // Remove state change handler
    if (this.access) {
      this.access.onstatechange = null;
    }
  }
}
