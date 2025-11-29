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
          <div class="encoder yellow" data-encoder="perform">
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
          <div class="encoder charcoal" data-encoder="key">
            <div class="encoder-knob">
              <div class="encoder-indicator"></div>
            </div>
            <span class="encoder-label">Key</span>
          </div>
        </div>

        <!-- OLED Display -->
        <div class="oled-display">
          <div class="oled-screen">
            <div class="oled-header">POORCHID</div>
            <div class="oled-content">
              <div class="oled-patch-name">${this.getPatchDisplayName(state.currentPatch)}</div>
              <div class="oled-main-text">${state.root} ${state.type}</div>
              <div class="oled-sub-text">${state.extensions.size > 0 ? Array.from(state.extensions).join(' ') : 'No extensions'}</div>
            </div>
            <div class="oled-status">
              <span class="status-item ${state.powered ? 'active' : ''}">PWR</span>
              <span class="status-item ${state.midiConnected ? 'active' : ''}">MIDI</span>
              <span class="status-item ${state.bassEnabled ? 'active' : ''}">BASS</span>
              <span class="status-item ${state.looperState !== 'stopped' ? 'active' : ''}">LOOP</span>
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
            <span class="encoder-mode">${state.bassMode.toUpperCase()}</span>
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
            <div class="encoder-knob">
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

      <!-- Hidden controls for now - will be replaced by encoder functionality -->
      <div class="hidden-controls" style="display: none;">
        <button id="power-btn" class="${state.powered ? 'active' : ''}">PWR</button>
        <div id="midi-status" class="midi-badge ${state.midiConnected ? 'connected' : ''}">MIDI</div>
        <button id="bass-mode-btn">BASS: ${state.bassMode.toUpperCase()}</button>
        <div id="type-controls">
          ${['major', 'minor', 'suspended', 'diminished'].map(type => `
            <button data-type="${type}" class="${state.type === type ? 'active' : ''}">${type}</button>
          `).join('')}
        </div>
        <div id="ext-controls">
          ${['6', '7', 'maj7', '9'].map(ext => `
            <button data-ext="${ext}" class="${state.extensions.has(ext) ? 'active' : ''}">${ext}</button>
          `).join('')}
        </div>
        <input type="range" id="voicing-dial" min="36" max="84" value="${state.voicingCenter}">
        <input type="range" id="filter-dial" min="100" max="10000" step="10" value="${state.filterCutoff}">
        <input type="range" id="bass-voicing-dial" min="-24" max="24" value="${state.bassVoicing}">
        <input type="range" id="bass-vol-dial" min="0" max="100" value="${state.bassVolume}">
        <button id="loop-rec-btn" class="${state.looperState === 'recording' || state.looperState === 'overdubbing' ? 'active recording' : ''}">REC</button>
        <button id="loop-play-btn" class="${state.looperState === 'playing' ? 'active' : ''}">PLAY</button>
        <button id="loop-undo-btn">UNDO</button>
      </div>
    `;

    this.renderKeyboard(state.root);
  }

  getPatchDisplayName(patchId) {
    const patch = PATCHES[patchId];
    return patch ? patch.name : patchId;
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

    // OLED Status indicators
    const pwrStatus = this.container.querySelector('.status-item:nth-child(1)');
    if (pwrStatus) {
      pwrStatus.classList.toggle('active', state.powered);
    }

    const midiStatus = this.container.querySelector('.status-item:nth-child(2)');
    if (midiStatus) {
      midiStatus.classList.toggle('active', state.midiConnected);
    }

    const bassStatus = this.container.querySelector('.status-item:nth-child(3)');
    if (bassStatus) {
      bassStatus.classList.toggle('active', state.bassEnabled);
    }

    const loopStatus = this.container.querySelector('.status-item:nth-child(4)');
    if (loopStatus) {
      loopStatus.classList.toggle('active', state.looperState !== 'stopped');
    }

    // Bass encoder visual state
    const bassEncoder = this.container.querySelector('.encoder[data-encoder="bass"]');
    if (bassEncoder) {
      bassEncoder.classList.toggle('active', state.bassEnabled);
      const modeLabel = bassEncoder.querySelector('.encoder-mode');
      if (modeLabel) {
        modeLabel.textContent = state.bassMode.toUpperCase();
      }
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

    this.container.addEventListener('mousedown', (e) => {
      const bassEncoder = e.target.closest('.encoder[data-encoder="bass"]');
      if (bassEncoder) {
        bassWasLongPress = false;
        bassLongPressTimer = setTimeout(() => {
          bassWasLongPress = true;
          this.actions.cycleBassMode();
        }, 500); // 500ms for long press
      }
    });

    this.container.addEventListener('mouseup', (e) => {
      if (bassLongPressTimer) {
        clearTimeout(bassLongPressTimer);
        bassLongPressTimer = null;
      }
    });

    this.container.addEventListener('mouseleave', (e) => {
      if (bassLongPressTimer) {
        clearTimeout(bassLongPressTimer);
        bassLongPressTimer = null;
      }
    });

    this.container.addEventListener('click', (e) => {
      const target = e.target;

      // Bass encoder click (short press = toggle on/off)
      const bassEncoder = e.target.closest('.encoder[data-encoder="bass"]');
      if (bassEncoder && !bassWasLongPress) {
        this.actions.toggleBass();
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

    // Mousewheel on encoders - rotate visually and trigger actions
    this.container.addEventListener('wheel', (e) => {
      const encoder = e.target.closest('.encoder[data-encoder]');
      if (encoder) {
        e.preventDefault();
        const encoderName = encoder.dataset.encoder;
        const direction = e.deltaY > 0 ? 1 : -1;
        
        // Update rotation angle (15 degrees per step)
        if (!this.encoderRotations[encoderName]) {
          this.encoderRotations[encoderName] = 0;
        }
        this.encoderRotations[encoderName] += direction * 15;
        
        // Apply rotation to the knob
        const knob = encoder.querySelector('.encoder-knob');
        if (knob) {
          knob.style.transform = `rotate(${this.encoderRotations[encoderName]}deg)`;
        }
        
        // Trigger specific actions based on encoder
        if (encoderName === 'sound') {
          this.actions.cyclePatch(direction);
        }
        // Future: add actions for other encoders (perform, fx, edit, tempo)
      }
    }, { passive: false });
  }
}
