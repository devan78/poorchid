import { PATCHES } from './patch-manager.js';

export class PoorchidUI {
  constructor(container, actions) {
    this.container = container;
    this.actions = actions;
    this.encoderRotations = {}; // Track rotation angles per encoder
    this.attachEvents();
  }

  mount(state) {
    this.container.innerHTML = `
      <!-- ROW 1: Configuration & Display -->
      <div class="config-row">
        <!-- Left Encoders -->
        <div class="encoder-group left-encoders">
          <div class="encoder yellow" data-encoder="sound">
            <div class="encoder-knob">
              <div class="encoder-indicator"></div>
            </div>
            <span class="encoder-label">Sound</span>
          </div>
          <div class="encoder yellow ${state.performMode !== 'direct' ? 'active' : ''}" data-encoder="perform" title="Click to cycle mode, rotate for division/speed, hold for pattern">
            <div class="encoder-knob">
              <div class="encoder-indicator"></div>
            </div>
            <span class="encoder-label">Perform</span>
          </div>
          <div class="encoder yellow" data-encoder="fx">
            <div class="encoder-knob">
              <div class="encoder-indicator"></div>
            </div>
            <span class="encoder-label">FX</span>
          </div>
          <div class="encoder charcoal ${state.keyEnabled ? 'active' : ''}" data-encoder="key" title="Click to toggle key lock, rotate to select key">
            <div class="encoder-knob">
              <div class="encoder-indicator"></div>
            </div>
            <span class="encoder-label">Key</span>
          </div>
        </div>

        <!-- OLED Display -->
        <div class="oled-display">
          <div class="oled-screen">
            <div class="oled-header">
              <span>POORCHID</span>
              <span class="oled-volume" data-volume="${state.volume}">VOL ${state.volume}</span>
            </div>
            <div class="oled-content">
              <div class="oled-patch-name">${this.getPatchDisplayName(state.currentPatch)}</div>
              <div class="oled-main-text">${state.root} ${state.type}</div>
              <div class="oled-sub-text">${state.extensions.size > 0 ? Array.from(state.extensions).join(' ') : 'No extensions'}</div>
            </div>
            <div class="oled-info-row">
              <span class="oled-key-mode ${state.keyEnabled ? 'active' : ''}">KEY: ${state.keyEnabled ? state.keyRoot + ' ' + state.keyScale.toUpperCase().slice(0, 3) : 'OFF'}</span>
              <span class="oled-bass-mode ${state.bassEnabled ? 'active' : ''}">${state.bassEnabled ? state.bassMode.toUpperCase() : ''}</span>
            </div>
            <div class="oled-info-row">
              <span class="oled-perform-mode ${state.performMode !== 'direct' ? 'active' : ''}">${this.getPerformModeDisplay(state)}</span>
              <span class="oled-bpm">${state.bpm} BPM</span>
            </div>
            <div class="oled-status">
              <span class="status-item ${state.powered ? 'active' : ''}">PWR</span>
              <span class="status-item ${state.midiConnected ? 'active' : ''}">MIDI</span>
              <span class="status-item ${state.looperState !== 'idle' ? 'active' : ''}">LOOP</span>
            </div>
          </div>
        </div>

        <!-- Right Encoders -->
        <div class="encoder-group right-encoders">
          <div class="encoder red ${state.bassEnabled ? 'active' : ''}" data-encoder="bass" title="Click to toggle bass, hold for mode">
            <div class="encoder-knob">
              <div class="encoder-indicator"></div>
            </div>
            <span class="encoder-label">Bass</span>
          </div>
          <div class="encoder charcoal" data-encoder="loop">
            <div class="encoder-knob">
              <div class="encoder-indicator"></div>
            </div>
            <span class="encoder-label">Loop</span>
          </div>
          <div class="encoder charcoal" data-encoder="bpm">
            <div class="encoder-knob">
              <div class="encoder-indicator"></div>
            </div>
            <span class="encoder-label">BPM</span>
          </div>
          <div class="encoder charcoal" data-encoder="options">
            <div class="encoder-knob">
              <div class="encoder-indicator"></div>
            </div>
            <span class="encoder-label">Options</span>
          </div>
          <div class="encoder charcoal" data-encoder="volume">
            <div class="encoder-knob" style="transform: rotate(${(state.volume / 99) * 270 - 135}deg)">
              <div class="encoder-indicator"></div>
            </div>
            <span class="encoder-label">Volume</span>
          </div>
        </div>
      </div>

      <!-- ROW 2: Performance Controls -->
      <div class="performance-row">
        <!-- Left: Chord Type & Extensions -->
        <div class="performance-controls">
          <div class="button-grid">
            <div class="button-row">
              <button class="perf-btn" data-type="diminished" id="btn-dim">Dim</button>
              <button class="perf-btn" data-type="minor" id="btn-min">Min</button>
              <button class="perf-btn" data-type="major" id="btn-maj">Maj</button>
              <button class="perf-btn" data-type="suspended" id="btn-sus">Sus</button>
            </div>
            <div class="button-row">
              <button class="perf-btn" data-ext="6" id="btn-6">6</button>
              <button class="perf-btn" data-ext="7" id="btn-m7">m7</button>
              <button class="perf-btn" data-ext="maj7" id="btn-M7">M7</button>
              <button class="perf-btn" data-ext="9" id="btn-9">9</button>
            </div>
          </div>

          <!-- Voicing & Bass Dials -->
          <div class="dial-stack">
            <div class="stacked-dial voicing-dial">
              <div class="dial-knob" id="voicing-knob" data-value="60">
                <div class="dial-indicator"></div>
              </div>
              <span class="dial-label">Voicing</span>
            </div>
            <div class="stacked-dial bass-dial">
              <div class="dial-knob small" id="bass-knob" data-value="0">
                <div class="dial-indicator"></div>
              </div>
              <span class="dial-label">Bass</span>
            </div>
          </div>
        </div>

        <!-- Right: Keyboard -->
        <div class="keyboard" id="keyboard">
          <!-- Keys generated dynamically -->
        </div>
      </div>
    `;

    this.renderKeyboard(state.root);
  }

  getPatchDisplayName(patchId) {
    const patch = PATCHES[patchId];
    return patch ? patch.name : patchId;
  }

  getPerformModeDisplay(state) {
    if (state.performMode === 'direct') {
      return 'DIRECT';
    } else if (state.performMode === 'arp') {
      return `ARP ${state.arpPattern.toUpperCase()} ${state.arpDivision}`;
    } else if (state.performMode === 'strum') {
      return `STRUM ${state.strumSpeed}`;
    } else if (state.performMode === 'pattern') {
      return 'PATTERN';
    }
    return state.performMode.toUpperCase();
  }

  update(state) {
    // OLED Display updates
    const oledPatch = this.container.querySelector('.oled-patch-name');
    if (oledPatch) {
      oledPatch.textContent = this.getPatchDisplayName(state.currentPatch);
    }

    const oledMain = this.container.querySelector('.oled-main-text');
    if (oledMain) {
      oledMain.textContent = `${state.root} ${state.type}`;
    }

    const oledSub = this.container.querySelector('.oled-sub-text');
    if (oledSub) {
      oledSub.textContent = state.extensions.size > 0 ? Array.from(state.extensions).join(' ') : 'No extensions';
    }

    // OLED Volume display (top right)
    const oledVolume = this.container.querySelector('.oled-volume');
    if (oledVolume) {
      oledVolume.textContent = `VOL ${state.volume}`;
      oledVolume.dataset.volume = state.volume;
    }

    // OLED Status indicators
    const pwrStatus = this.container.querySelector('.status-item:nth-child(1)');
    if (pwrStatus) {
      pwrStatus.classList.toggle('active', state.powered);
    }

    const midiStatus = this.container.querySelector('.status-item:nth-child(2)');
    if (midiStatus) {
      midiStatus.classList.toggle('active', state.midiConnected);
    }

    const loopStatus = this.container.querySelector('.status-item:nth-child(3)');
    if (loopStatus) {
      loopStatus.classList.toggle('active', state.looperState !== 'stopped');
    }

    // Bass mode display on OLED
    const bassModeDisplay = this.container.querySelector('.oled-bass-mode');
    if (bassModeDisplay) {
      bassModeDisplay.textContent = state.bassEnabled ? state.bassMode.toUpperCase() : '';
      bassModeDisplay.classList.toggle('active', state.bassEnabled);
    }

    // Key mode display on OLED
    const keyModeDisplay = this.container.querySelector('.oled-key-mode');
    if (keyModeDisplay) {
      keyModeDisplay.textContent = `KEY: ${state.keyEnabled ? state.keyRoot + ' ' + state.keyScale.toUpperCase().slice(0, 3) : 'OFF'}`;
      keyModeDisplay.classList.toggle('active', state.keyEnabled);
    }

    // Key encoder visual state
    const keyEncoder = this.container.querySelector('.encoder[data-encoder="key"]');
    if (keyEncoder) {
      keyEncoder.classList.toggle('active', state.keyEnabled);
    }

    // Perform mode display on OLED
    const performModeDisplay = this.container.querySelector('.oled-perform-mode');
    if (performModeDisplay) {
      performModeDisplay.textContent = this.getPerformModeDisplay(state);
      performModeDisplay.classList.toggle('active', state.performMode !== 'direct');
    }

    // BPM display on OLED
    const bpmDisplay = this.container.querySelector('.oled-bpm');
    if (bpmDisplay) {
      bpmDisplay.textContent = `${state.bpm} BPM`;
    }

    // Perform encoder visual state
    const performEncoder = this.container.querySelector('.encoder[data-encoder="perform"]');
    if (performEncoder) {
      performEncoder.classList.toggle('active', state.performMode !== 'direct');
    }

    // Bass encoder visual state (finite rotation for volume: 0 = -135°, 99 = +135°)
    const bassEncoder = this.container.querySelector('.encoder[data-encoder="bass"]');
    if (bassEncoder) {
      bassEncoder.classList.toggle('active', state.bassEnabled);
      const knob = bassEncoder.querySelector('.encoder-knob');
      if (knob) {
        const rotation = (state.bassVolume / 99) * 270 - 135;
        knob.style.transform = `rotate(${rotation}deg)`;
      }
      // Keep internal tracking in sync
      this._currentBassVolume = state.bassVolume;
    }

    // Volume encoder visual state (finite rotation: 0 = -135°, 99 = +135°)
    const volumeEncoder = this.container.querySelector('.encoder[data-encoder="volume"]');
    if (volumeEncoder) {
      const knob = volumeEncoder.querySelector('.encoder-knob');
      if (knob) {
        const rotation = (state.volume / 99) * 270 - 135;
        knob.style.transform = `rotate(${rotation}deg)`;
      }
      // Keep internal tracking in sync
      this._currentVolume = state.volume;
    }

    // Hidden controls (for keyboard shortcuts to still work)
    const pwrBtn = this.container.querySelector('#power-btn');
    if (pwrBtn) {
      if (state.powered) pwrBtn.classList.add('active');
      else pwrBtn.classList.remove('active');
      pwrBtn.textContent = state.powered ? 'PWR ON' : 'PWR OFF';
    }

    // MIDI Status
    const midiBadge = this.container.querySelector('#midi-status');
    if (midiBadge) {
      if (state.midiConnected) midiBadge.classList.add('connected');
      else midiBadge.classList.remove('connected');
    }

    // Types
    this.container.querySelectorAll('#type-controls button').forEach(btn => {
      if (btn.dataset.type === state.type) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Extensions (hidden controls)
    this.container.querySelectorAll('#ext-controls button').forEach(btn => {
      if (state.extensions.has(btn.dataset.ext)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Performance buttons - Chord Types
    this.container.querySelectorAll('.perf-btn[data-type]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === state.type);
    });

    // Performance buttons - Extensions
    this.container.querySelectorAll('.perf-btn[data-ext]').forEach(btn => {
      btn.classList.toggle('active', state.extensions.has(btn.dataset.ext));
    });

    // Keys - no persistent active state, only transient pressed state handled in main.js

    // Bass Mode
    const bassBtn = this.container.querySelector('#bass-mode-btn');
    if (bassBtn) {
      bassBtn.textContent = `BASS: ${state.bassMode.toUpperCase()}`;
    }

    // Looper Buttons
    const recBtn = this.container.querySelector('#loop-rec-btn');
    if (recBtn) {
      const isRec = state.looperState === 'recording' || state.looperState === 'overdubbing';
      if (isRec) recBtn.classList.add('active', 'recording');
      else recBtn.classList.remove('active', 'recording');
      recBtn.textContent = state.looperState === 'recording' ? 'REC' : (state.looperState === 'overdubbing' ? 'DUB' : 'REC');
    }

    const playBtn = this.container.querySelector('#loop-play-btn');
    if (playBtn) {
      if (state.looperState === 'playing') playBtn.classList.add('active');
      else playBtn.classList.remove('active');
      playBtn.textContent = state.looperState === 'playing' ? 'STOP' : 'PLAY';
    }

    // Sliders - Only update if not focused to avoid fighting user
    const updateSlider = (id, val) => {
      const el = this.container.querySelector(`#${id}`);
      if (el && document.activeElement !== el) {
        el.value = val;
      }
    };

    updateSlider('voicing-dial', state.voicingCenter);
    updateSlider('filter-dial', state.filterCutoff);
    updateSlider('bass-voicing-dial', state.bassVoicing);
    updateSlider('bass-vol-dial', state.bassVolume);
  }


  renderKeyboard(activeRoot) {
    const keys = [
      { note: 'C', type: 'white' },
      { note: 'C#', type: 'black' },
      { note: 'D', type: 'white' },
      { note: 'D#', type: 'black' },
      { note: 'E', type: 'white' },
      { note: 'F', type: 'white' },
      { note: 'F#', type: 'black' },
      { note: 'G', type: 'white' },
      { note: 'G#', type: 'black' },
      { note: 'A', type: 'white' },
      { note: 'A#', type: 'black' },
      { note: 'B', type: 'white' },
    ];

    const keyboardEl = document.getElementById('keyboard');
    if (keyboardEl) {
      keyboardEl.innerHTML = keys.map(k => `
        <div class="key ${k.type}" data-note="${k.note}"></div>
      `).join('');
    }
  }

  attachEvents() {
    // Track long-press for bass encoder
    let bassLongPressTimer = null;
    let bassWasLongPress = false;

    // Track long-press for key encoder
    let keyLongPressTimer = null;
    let keyWasLongPress = false;

    // Track long-press for perform encoder
    let performLongPressTimer = null;
    let performWasLongPress = false;

    // Track long-press for BPM encoder (tap tempo)
    let bpmLongPressTimer = null;
    let bpmWasLongPress = false;

    this.container.addEventListener('mousedown', (e) => {
      const bassEncoder = e.target.closest('.encoder[data-encoder="bass"]');
      if (bassEncoder) {
        bassWasLongPress = false;
        bassLongPressTimer = setTimeout(() => {
          bassWasLongPress = true;
          this.actions.cycleBassMode();
        }, 500); // 500ms for long press
      }

      const keyEncoder = e.target.closest('.encoder[data-encoder="key"]');
      if (keyEncoder) {
        keyWasLongPress = false;
        keyLongPressTimer = setTimeout(() => {
          keyWasLongPress = true;
          this.actions.cycleKeyScale();
        }, 500); // 500ms for long press = cycle scale type
      }

      const performEncoder = e.target.closest('.encoder[data-encoder="perform"]');
      if (performEncoder) {
        performWasLongPress = false;
        performLongPressTimer = setTimeout(() => {
          performWasLongPress = true;
          this.actions.cycleArpPattern(); // Long press = cycle arp pattern
        }, 500);
      }

      const bpmEncoder = e.target.closest('.encoder[data-encoder="bpm"]');
      if (bpmEncoder) {
        bpmWasLongPress = false;
        bpmLongPressTimer = setTimeout(() => {
          bpmWasLongPress = true;
          this.actions.toggleMetronome(); // Long press = toggle metronome
        }, 500);
      }
    });

    this.container.addEventListener('mouseup', (e) => {
      if (bassLongPressTimer) {
        clearTimeout(bassLongPressTimer);
        bassLongPressTimer = null;
      }
      if (keyLongPressTimer) {
        clearTimeout(keyLongPressTimer);
        keyLongPressTimer = null;
      }
      if (performLongPressTimer) {
        clearTimeout(performLongPressTimer);
        performLongPressTimer = null;
      }
      if (bpmLongPressTimer) {
        clearTimeout(bpmLongPressTimer);
        bpmLongPressTimer = null;
      }
    });

    this.container.addEventListener('mouseleave', (e) => {
      if (bassLongPressTimer) {
        clearTimeout(bassLongPressTimer);
        bassLongPressTimer = null;
      }
      if (keyLongPressTimer) {
        clearTimeout(keyLongPressTimer);
        keyLongPressTimer = null;
      }
      if (performLongPressTimer) {
        clearTimeout(performLongPressTimer);
        performLongPressTimer = null;
      }
      if (bpmLongPressTimer) {
        clearTimeout(bpmLongPressTimer);
        bpmLongPressTimer = null;
      }
    });

    this.container.addEventListener('click', (e) => {
      const target = e.target;

      // Key encoder click (short press = toggle key lock on/off)
      const keyEncoder = e.target.closest('.encoder[data-encoder="key"]');
      if (keyEncoder && !keyWasLongPress) {
        this.actions.toggleKey();
        return;
      }

      // Bass encoder click (short press = toggle on/off)
      const bassEncoder = e.target.closest('.encoder[data-encoder="bass"]');
      if (bassEncoder && !bassWasLongPress) {
        this.actions.toggleBass();
        return;
      }

      // Perform encoder click (short press = cycle perform mode)
      const performEncoder = e.target.closest('.encoder[data-encoder="perform"]');
      if (performEncoder && !performWasLongPress) {
        this.actions.cyclePerformMode();
        return;
      }

      // BPM encoder click (short press = tap tempo)
      const bpmEncoder = e.target.closest('.encoder[data-encoder="bpm"]');
      if (bpmEncoder && !bpmWasLongPress) {
        this.actions.tapTempo();
        return;
      }

      if (target.id === 'power-btn') this.actions.togglePower();
      
      if (target.closest('#type-controls button')) {
        const type = target.closest('button').dataset.type;
        this.actions.setChordType(type);
      }

      if (target.closest('#ext-controls button')) {
        const ext = target.closest('button').dataset.ext;
        this.actions.toggleExtension(ext);
      }

      // Performance buttons - chord type
      if (target.classList.contains('perf-btn') && target.dataset.type) {
        this.actions.setChordType(target.dataset.type);
      }

      // Performance buttons - extensions
      if (target.classList.contains('perf-btn') && target.dataset.ext) {
        this.actions.toggleExtension(target.dataset.ext);
      }

      if (target.classList.contains('key')) {
        const note = target.dataset.note;
        this.actions.setRoot(note);
      }

      if (target.id === 'loop-rec-btn') this.actions.toggleLoopRecord();
      if (target.id === 'loop-play-btn') this.actions.toggleLoopPlay();
      if (target.id === 'loop-undo-btn') this.actions.undoLoop();
      if (target.id === 'bass-mode-btn') this.actions.cycleBassMode();
    });

    this.container.addEventListener('input', (e) => {
      if (e.target.id === 'voicing-dial') this.actions.setVoicing(parseInt(e.target.value));
      if (e.target.id === 'filter-dial') this.actions.setFilter(parseInt(e.target.value));
      if (e.target.id === 'bass-voicing-dial') this.actions.setBassVoicing(parseInt(e.target.value));
      if (e.target.id === 'bass-vol-dial') this.actions.setBassVolume(parseInt(e.target.value));
    });

    // === ENCODER DRAG & WHEEL SYSTEM ===
    // Best practice: drag up = increase (clockwise), drag down = decrease (counter-clockwise)
    // Sensitivity: ~2px of movement per unit change
    
    let dragState = null; // { encoder, startY, startValue }
    
    // Helper to update encoder based on delta
    const updateEncoder = (encoderName, delta, encoder) => {
      // Volume encoder: finite rotation with hard stops at 0 and 99
      if (encoderName === 'volume') {
        if (this._currentVolume === undefined) this._currentVolume = 70;
        const newVolume = Math.max(0, Math.min(99, this._currentVolume + delta));
        
        if (newVolume !== this._currentVolume) {
          this._currentVolume = newVolume;
          this.actions.setVolume(this._currentVolume);
          
          // Map volume 0-99 to rotation -135 to +135 degrees (270° sweep)
          const rotation = (this._currentVolume / 99) * 270 - 135;
          const knob = encoder.querySelector('.encoder-knob');
          if (knob) {
            knob.style.transform = `rotate(${rotation}deg)`;
          }
        }
        return;
      }
      
      // Bass encoder: finite rotation for bass volume (0-99)
      if (encoderName === 'bass') {
        if (this._currentBassVolume === undefined) this._currentBassVolume = 60;
        const newVolume = Math.max(0, Math.min(99, this._currentBassVolume + delta));
        
        if (newVolume !== this._currentBassVolume) {
          this._currentBassVolume = newVolume;
          this.actions.setBassVolume(this._currentBassVolume);
          
          // Map volume 0-99 to rotation -135 to +135 degrees (270° sweep)
          const rotation = (this._currentBassVolume / 99) * 270 - 135;
          const knob = encoder.querySelector('.encoder-knob');
          if (knob) {
            knob.style.transform = `rotate(${rotation}deg)`;
          }
        }
        return;
      }
      
      // Perform encoder: finite rotation (0-99) for division/speed
      if (encoderName === 'perform') {
        if (this._currentPerformValue === undefined) this._currentPerformValue = 50;
        const newValue = Math.max(0, Math.min(99, this._currentPerformValue + delta));
        
        if (newValue !== this._currentPerformValue) {
          this._currentPerformValue = newValue;
          this.actions.setPerformValue(this._currentPerformValue);
          
          // Map 0-99 to rotation -135 to +135 degrees (270° sweep)
          const rotation = (this._currentPerformValue / 99) * 270 - 135;
          const knob = encoder.querySelector('.encoder-knob');
          if (knob) {
            knob.style.transform = `rotate(${rotation}deg)`;
          }
        }
        return;
      }
      
      // BPM encoder: finite rotation (20-300 BPM mapped to 0-99 arc)
      if (encoderName === 'bpm') {
        if (this._currentBpmValue === undefined) this._currentBpmValue = 36; // 120 BPM default
        const newValue = Math.max(0, Math.min(99, this._currentBpmValue + delta));
        
        if (newValue !== this._currentBpmValue) {
          this._currentBpmValue = newValue;
          // Map 0-99 to 20-300 BPM
          const bpm = Math.round(20 + (this._currentBpmValue / 99) * 280);
          this.actions.setBpm(bpm);
          
          // Map 0-99 to rotation -135 to +135 degrees (270° sweep)
          const rotation = (this._currentBpmValue / 99) * 270 - 135;
          const knob = encoder.querySelector('.encoder-knob');
          if (knob) {
            knob.style.transform = `rotate(${rotation}deg)`;
          }
        }
        return;
      }
      
      // Other encoders: infinite rotation
      if (!this.encoderRotations[encoderName]) {
        this.encoderRotations[encoderName] = 0;
      }
      this.encoderRotations[encoderName] += delta * 3; // 3 degrees per unit
      
      const knob = encoder.querySelector('.encoder-knob');
      if (knob) {
        knob.style.transform = `rotate(${this.encoderRotations[encoderName]}deg)`;
      }
      
      // Trigger actions for infinite encoders (on significant movement)
      if (Math.abs(delta) >= 1) {
        const direction = delta > 0 ? 1 : -1; // drag up = increase
        if (encoderName === 'sound') {
          this.actions.cyclePatch(-direction); // Inverted for patch cycling
        }
        if (encoderName === 'key') {
          this.actions.cycleKeyRoot(direction); // Rotate to change key
        }
      }
    };
    
    // Mouse down - start drag
    this.container.addEventListener('mousedown', (e) => {
      const encoder = e.target.closest('.encoder[data-encoder]');
      if (encoder) {
        const encoderName = encoder.dataset.encoder;
        
        e.preventDefault();
        encoder.classList.add('dragging');
        document.body.style.cursor = 'ns-resize';
        
        dragState = {
          encoder,
          encoderName,
          startY: e.clientY,
          lastY: e.clientY
        };
      }
    });
    
    // Mouse move - update while dragging
    document.addEventListener('mousemove', (e) => {
      if (!dragState) return;
      
      const deltaY = dragState.lastY - e.clientY; // Inverted: up = positive
      const sensitivity = 2; // pixels per unit
      const delta = deltaY / sensitivity;
      
      if (Math.abs(delta) >= 1) {
        updateEncoder(dragState.encoderName, delta, dragState.encoder);
        dragState.lastY = e.clientY;
      }
    });
    
    // Mouse up - end drag
    document.addEventListener('mouseup', () => {
      if (dragState) {
        dragState.encoder.classList.remove('dragging');
        document.body.style.cursor = '';
        dragState = null;
      }
    });
    
    // Mouse wheel - also works
    this.container.addEventListener('wheel', (e) => {
      const encoder = e.target.closest('.encoder[data-encoder]');
      if (encoder) {
        e.preventDefault();
        const encoderName = encoder.dataset.encoder;
        const delta = e.deltaY > 0 ? -5 : 5; // Scroll up = increase
        updateEncoder(encoderName, delta, encoder);
      }
    }, { passive: false });
  }
}
