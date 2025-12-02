import { PATCHES } from './patch-manager.js';
import { KEY_MAP } from './constants.js';

const ENCODER_TYPES = {
  volume: { type: 'scoped', min: 0, max: 99 },
  bass: { type: 'scoped', min: 0, max: 99 },
  perform: { type: 'scoped', min: 0, max: 99 }, // value feeds performMode handlers
  bpm: { type: 'scoped', min: 0, max: 99 }, // mapped to 20-300
  fx: { type: 'scoped', min: 0, max: 99 },
  sound: { type: 'infinite' },
  key: { type: 'infinite' },
  options: { type: 'infinite' },
  loop: { type: 'infinite' } // placeholder for future loop actions
};

export class PoorchidUI {
  constructor(container, actions) {
    this.container = container;
    this.actions = actions;
    this.encoderRotations = {}; // Track rotation angles per encoder
    this._bassVolumeFlashUntil = 0;
    this._fxStateSnapshot = null;
    this._currentBpmValue = 36; // syncs to state on update
    this._currentPerformValue = 50;
    this.encoderEngaged = new Map([['fx', false]]); // tracks which encoders are engaged/active
    this.state = null;
    this.attachEvents();
  }

  mount(state) {
    this.state = state;
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
            <!-- Top Bar: Status & Volume -->
            <div class="oled-header">
              <div class="oled-status-icons">
                <span class="status-icon ${state.powered ? 'active' : ''}" title="Power">PWR</span>
                <span class="status-icon ${state.midiConnected ? 'active' : ''}" title="MIDI">MIDI</span>
                <span class="status-icon ${state.looperState !== 'idle' ? 'active' : ''}" title="Looper">
                  ${state.looperState === 'recording' ? `REC ${state.loopBarsRecorded || ''}` : 
                    (state.looperState === 'overdubbing' ? `DUB ${state.loopBarsRecorded || ''}` : 
                    (state.looperState === 'playing' ? `PLAY ${state.loopBarsRecorded || ''}` : 'LOOP'))}
                </span>
              </div>
              <span class="oled-volume" data-volume="${state.volume}">VOL ${state.volume}</span>
            </div>

            <!-- Main Content: Patch & Chord -->
            <div class="oled-main-section">
              <div class="oled-patch-name">${this.getPatchDisplayName(state.currentPatch)}</div>
              <div class="oled-chord-display">
                <span class="oled-chord-root">${state.root}</span>
                <span class="oled-chord-type">${state.type}</span>
              </div>
              <div class="oled-extensions">${state.extensions.size > 0 ? Array.from(state.extensions).join(' ') : '—'}</div>
            </div>

            <!-- Bottom Grid: Parameters -->
            <div class="oled-grid">
              <!-- Row 1: Key & Bass -->
              <div class="oled-grid-cell">
                <span class="oled-label">KEY</span>
                <span class="oled-value oled-key-value ${state.keyEnabled ? 'active' : ''}">${this.getKeyDisplay(state)}</span>
              </div>
              <div class="oled-grid-cell">
                <span class="oled-label">BASS</span>
                <span class="oled-value oled-bass-value ${(state.bassEnabled && state.bassMode !== 'direct') ? 'active' : ''}">${(state.bassEnabled && state.bassMode !== 'direct') ? state.bassMode.toUpperCase() : 'OFF'}</span>
              </div>

              <!-- Row 2: Perform & BPM -->
              <div class="oled-grid-cell">
                <span class="oled-label">MODE</span>
                <span class="oled-value oled-mode-value ${state.performMode !== 'direct' ? 'active' : ''}">${this.getPerformModeDisplay(state)}</span>
              </div>
              <div class="oled-grid-cell">
                <span class="oled-label">BPM</span>
                <span class="oled-value oled-bpm-value ${state.beatEnabled ? 'active' : ''}">${state.beatEnabled ? state.beatPattern.toUpperCase() : state.bpm}</span>
              </div>

              <!-- Row 3: FX & Style -->
              <div class="oled-grid-cell">
                <span class="oled-label">FX</span>
                <span class="oled-value oled-fx-value ${state.currentEffect !== 'direct' ? 'active' : ''}">${this.getFxDisplay(state)} ${state.currentEffect !== 'direct' ? this.getFxLevel(state) : ''}</span>
              </div>
              <div class="oled-grid-cell">
                <span class="oled-label">STYLE</span>
                <span class="oled-value oled-style-value">${state.playstyle.toUpperCase()}</span>
              </div>
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
          <div class="encoder charcoal ${state.beatEnabled ? 'yellow active' : ''}" data-encoder="bpm" title="Click to toggle beats, rotate for BPM/Pattern">
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
              <button class="perf-btn" data-type="diminished" id="btn-dim">Dim<span class="key-hint">A</span></button>
              <button class="perf-btn" data-type="minor" id="btn-min">Min<span class="key-hint">S</span></button>
              <button class="perf-btn" data-type="major" id="btn-maj">Maj<span class="key-hint">D</span></button>
              <button class="perf-btn" data-type="suspended" id="btn-sus">Sus<span class="key-hint">F</span></button>
            </div>
            <div class="button-row">
              <button class="perf-btn" data-ext="6" id="btn-6">6<span class="key-hint">\</span></button>
              <button class="perf-btn" data-ext="7" id="btn-m7">m7<span class="key-hint">Z</span></button>
              <button class="perf-btn" data-ext="maj7" id="btn-M7">M7<span class="key-hint">X</span></button>
              <button class="perf-btn" data-ext="9" id="btn-9">9<span class="key-hint">C</span></button>
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

  getVoicingRotation(voicingCenter) {
    // Map MIDI 36-84 to -135..135 degrees
    const min = 36;
    const max = 84;
    const clamped = Math.max(min, Math.min(max, voicingCenter || 60));
    const t = (clamped - min) / (max - min);
    return t * 270 - 135;
  }

  getBassVoicingRotation(bassVoicing) {
    // Map -24..24 to -135..135 degrees
    const min = -24;
    const max = 24;
    const clamped = Math.max(min, Math.min(max, bassVoicing || 0));
    const t = (clamped - min) / (max - min);
    return t * 270 - 135;
  }

  getPerformModeDisplay(state) {
    if (state.performMode === 'direct') {
      return 'OFF';
    } else if (state.performMode === 'arp') {
      return `ARP ${state.arpPattern.toUpperCase()} ${state.arpDivision}`;
    } else if (['strum', 'strum2', 'slop', 'harp'].includes(state.performMode)) {
      return `${state.performMode.toUpperCase()} ${state.strumSpeed}`;
    } else if (state.performMode === 'pattern') {
      const patternNames = {
        'straight': 'STRAIGHT',
        'offbeat': 'OFFBEAT', 
        'pulse': 'PULSE',
        'tresillo': 'TRESILLO',
        'clave': 'CLAVE',
        'shuffle': 'SHUFFLE',
        'waltz': 'WALTZ',
        'funk': 'FUNK'
      };
      return `PATTERN ${patternNames[state.rhythmPattern] || state.rhythmPattern.toUpperCase()}`;
    }
    return state.performMode.toUpperCase();
  }

  getKeyDisplay(state) {
    if (!state.keyEnabled) return 'KEY: OFF';
    const label = state.keyAutoChords
      ? state.keyScale.toUpperCase().slice(0, 3)
      : ({
          diminished: 'DIM',
          minor: 'MIN',
          major: 'MAJ',
          suspended: 'SUS'
        }[state.type] || state.type.toUpperCase().slice(0, 3));
    const mode = state.keyAutoChords ? 'AUTO' : 'MAN';
    return `KEY: ${state.keyRoot} ${label} ${mode}`;
  }

  getFxDisplay(state) {
    const effect = state.currentEffect || 'reverb';
    const fxName = effect.toUpperCase();
    if (effect === 'direct') return 'FX OFF';
    return `FX ${fxName}`;
  }

  getFxLevel(state) {
    const effect = state.currentEffect || 'reverb';
    if (effect === 'direct') return '';
    const level = (state.fxLevels && state.fxLevels[effect]) ?? 0;
    const lock = state.fxLocked ? ' LOCK' : '';
    return `${level}${lock}`;
  }

  update(state) {
    this.state = state;
    // OLED Display updates
    const oledPatch = this.container.querySelector('.oled-patch-name');
    if (oledPatch) {
      oledPatch.textContent = this.getPatchDisplayName(state.currentPatch);
    }

    const oledRoot = this.container.querySelector('.oled-chord-root');
    if (oledRoot) {
      oledRoot.textContent = state.root;
    }

    const oledType = this.container.querySelector('.oled-chord-type');
    if (oledType) {
      oledType.textContent = state.type;
    }

    const oledExt = this.container.querySelector('.oled-extensions');
    if (oledExt) {
      oledExt.textContent = state.extensions.size > 0 ? Array.from(state.extensions).join(' ') : '—';
    }

    // OLED Volume display (top right)
    const oledVolume = this.container.querySelector('.oled-volume');
    if (oledVolume) {
      if (Date.now() < this._bassVolumeFlashUntil) {
        oledVolume.textContent = `BASS ${state.bassVolume}`;
      } else {
        oledVolume.textContent = `VOL ${state.volume}`;
      }
      oledVolume.dataset.volume = state.volume;
    }

    // OLED Status indicators
    const statusIcons = this.container.querySelectorAll('.status-icon');
    if (statusIcons.length >= 3) {
      // PWR
      statusIcons[0].classList.toggle('active', state.powered);
      // MIDI
      statusIcons[1].classList.toggle('active', state.midiConnected);
      // LOOPER
      const looperIcon = statusIcons[2];
      looperIcon.classList.toggle('active', state.looperState !== 'idle');
      
      let looperText = 'LOOP';
      if (state.looperState === 'idle') {
         looperText = state.loopLength === 'free' ? 'FREE' : `${state.loopLength}B`;
      } else {
         if (state.looperState === 'recording') looperText = 'REC';
         else if (state.looperState === 'overdubbing') looperText = 'DUB';
         else if (state.looperState === 'playing') {
             // Show menu selection if it's not 'play' (default)
             if (state.loopMenu !== 'play') {
                 looperText = state.loopMenu.toUpperCase();
             } else {
                 looperText = 'PLAY';
             }
         }
      }
      looperIcon.textContent = looperText;
    }

    // FX Display
    const fxDisplay = this.container.querySelector('.oled-fx-value');
    if (fxDisplay) {
      const fxText = `${this.getFxDisplay(state)} ${state.currentEffect !== 'direct' ? this.getFxLevel(state) : ''}`;
      fxDisplay.textContent = fxText;
      fxDisplay.classList.toggle('active', state.currentEffect !== 'direct');
    }

    // Bass mode display
    const bassDisplay = this.container.querySelector('.oled-bass-value');
    if (bassDisplay) {
      const isDirect = state.bassMode === 'direct';
      bassDisplay.textContent = (state.bassEnabled && !isDirect) ? state.bassMode.toUpperCase() : 'OFF';
      bassDisplay.classList.toggle('active', state.bassEnabled && !isDirect);
    }

    // Key mode display
    const keyDisplay = this.container.querySelector('.oled-key-value');
    if (keyDisplay) {
      keyDisplay.textContent = this.getKeyDisplay(state);
      keyDisplay.classList.toggle('active', state.keyEnabled);
    }

    // Key encoder visual state
    const keyEncoder = this.container.querySelector('.encoder[data-encoder="key"]');
    if (keyEncoder) {
      keyEncoder.classList.toggle('active', state.keyEnabled);
    }

    // Loop encoder visual state
    const loopEncoder = this.container.querySelector('.encoder[data-encoder="loop"]');
    if (loopEncoder) {
      const isActive = state.looperState !== 'idle';
      loopEncoder.classList.toggle('active', isActive);
      
      // Update color based on state
      loopEncoder.classList.remove('charcoal', 'red', 'yellow', 'green');
      if (state.looperState === 'recording') {
        loopEncoder.classList.add('red');
      } else if (state.looperState === 'overdubbing') {
        loopEncoder.classList.add('yellow');
      } else if (state.looperState === 'playing') {
        loopEncoder.classList.add('green'); // Assuming green class exists or will fallback to active style
      } else {
        loopEncoder.classList.add('charcoal');
      }
    }

    // Style display
    const styleDisplay = this.container.querySelector('.oled-style-value');
    if (styleDisplay) {
      styleDisplay.textContent = state.playstyle.toUpperCase();
    }

    // Perform mode display
    const performDisplay = this.container.querySelector('.oled-mode-value');
    if (performDisplay) {
      performDisplay.textContent = this.getPerformModeDisplay(state);
      performDisplay.classList.toggle('active', state.performMode !== 'direct');
    }

    // BPM display
    const bpmDisplay = this.container.querySelector('.oled-bpm-value');
    if (bpmDisplay) {
      if (state.beatEnabled) {
        bpmDisplay.textContent = state.beatPattern.toUpperCase();
        bpmDisplay.classList.add('active');
      } else {
        bpmDisplay.textContent = `${state.bpm}`;
        bpmDisplay.classList.remove('active');
      }
    }

    // BPM encoder visual state
    const bpmEncoder = this.container.querySelector('.encoder[data-encoder="bpm"]');
    if (bpmEncoder) {
      bpmEncoder.classList.toggle('active', state.beatEnabled);
      if (state.beatEnabled) {
        bpmEncoder.classList.remove('charcoal');
        bpmEncoder.classList.add('yellow');
      } else {
        bpmEncoder.classList.remove('yellow');
        bpmEncoder.classList.add('charcoal');
      }
    }

    // Perform encoder visual state
    const performEncoder = this.container.querySelector('.encoder[data-encoder="perform"]');
    if (performEncoder) {
      // Disengage when in DIRECT
      const engaged = state.performMode !== 'direct';
      this.encoderEngaged.set('perform', engaged);
      performEncoder.classList.toggle('active', engaged);
      
      // Sync internal value from state
      if (state.performMode === 'arp') {
        const divisions = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T'];
        const index = divisions.indexOf(state.arpDivision);
        if (index !== -1) this._currentPerformValue = Math.round((index * 11) + 5);
      } else if (['strum', 'strum2', 'slop', 'harp'].includes(state.performMode)) {
        this._currentPerformValue = state.strumSpeed;
      } else if (state.performMode === 'pattern') {
        const patterns = ['straight', 'offbeat', 'pulse', 'tresillo', 'clave', 'shuffle', 'waltz', 'funk'];
        const index = patterns.indexOf(state.rhythmPattern);
        if (index !== -1) this._currentPerformValue = Math.round((index * 12.5) + 6);
      }

      const knob = performEncoder.querySelector('.encoder-knob');
      if (knob) {
        const rotation = engaged ? (this._currentPerformValue / 99) * 270 - 135 : 0;
        knob.style.transform = `rotate(${rotation}deg)`;
      }
    }

    const fxEncoder = this.container.querySelector('.encoder[data-encoder="fx"]');
    if (fxEncoder) {
      const engaged = this.encoderEngaged.get('fx') === true && state.currentEffect !== 'direct';
      this.encoderEngaged.set('fx', engaged);
      fxEncoder.classList.toggle('active', engaged);
      const knob = fxEncoder.querySelector('.encoder-knob');
      if (knob) {
        this._currentFxValue = state.fxLevels[state.currentEffect] ?? 0;
        const rotation = engaged ? (this._currentFxValue / 99) * 270 - 135 : 0;
        knob.style.transform = `rotate(${rotation}deg)`;
      }
    }

    this._currentBpmValue = Math.round(((state.bpm - 20) / 280) * 99);
    // this._currentPerformValue is now updated in the block above
    this._fxStateSnapshot = {
      currentEffect: state.currentEffect,
      fxLevels: { ...state.fxLevels },
      fxLocked: state.fxLocked
    };
    this._lastFxEffect = state.currentEffect;

    // Bass encoder visual state (finite rotation for volume: 0 = -135°, 99 = +135°)
    const bassEncoder = this.container.querySelector('.encoder[data-encoder="bass"]');
    if (bassEncoder) {
      const engaged = state.bassEnabled && state.bassMode !== 'direct';
      this.encoderEngaged.set('bass', engaged);
      bassEncoder.classList.toggle('active', engaged);
      const knob = bassEncoder.querySelector('.encoder-knob');
      if (knob) {
        const rotation = engaged ? (state.bassVolume / 99) * 270 - 135 : 0;
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
        const engaged = this.encoderEngaged.get('volume') === true;
        const rotation = engaged ? (state.volume / 99) * 270 - 135 : 0;
        knob.style.transform = `rotate(${rotation}deg)`;
      }
      // Keep internal tracking in sync
      this._currentVolume = state.volume;
    }

    const flavourToggle = document.getElementById('flavour-toggle');
    if (flavourToggle) {
      flavourToggle.classList.toggle('active', state.flavourEnabled);
      flavourToggle.textContent = state.flavourEnabled ? 'Flavour On' : 'Flavour Off';
      flavourToggle.title = state.flavourEnabled ? 'Secret flavour chain enabled' : 'Secret flavour chain bypassed';
    }

    const recordBtn = document.getElementById('record-btn');
    if (recordBtn) {
      recordBtn.classList.toggle('active', state.recording);
      recordBtn.textContent = state.recording ? 'Recording...' : 'Record';
      recordBtn.title = state.recording ? 'Recording live output' : 'Record live output to file';
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

    const voicingKnob = this.container.querySelector('#voicing-knob');
    if (voicingKnob) {
      const rotation = this.getVoicingRotation(state.voicingCenter);
      voicingKnob.style.setProperty('--dial-rotation', `${rotation}deg`);
      this._voicingDialValue = state.voicingCenter;
    }

    const bassVoicingKnob = this.container.querySelector('#bass-knob');
    if (bassVoicingKnob) {
      const rotation = this.getBassVoicingRotation(state.bassVoicing);
      bassVoicingKnob.style.setProperty('--dial-rotation', `${rotation}deg`);
      this._bassVoicingDialValue = state.bassVoicing;
    }
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

    // Create reverse map for display
    const noteToKey = {};
    Object.entries(KEY_MAP).forEach(([k, n]) => {
      noteToKey[n] = k;
    });

    const keyboardEl = document.getElementById('keyboard');
    if (keyboardEl) {
      keyboardEl.innerHTML = keys.map(k => {
        const keyLabel = noteToKey[k.note] || '';
        const displayLabel = keyLabel === ';' ? ';' : 
                             keyLabel === '\'' ? '\'' : 
                             keyLabel === '[' ? '[' : 
                             keyLabel === ']' ? ']' : 
                             keyLabel.toUpperCase();
        
        return `
        <div class="key ${k.type}" data-note="${k.note}">
          <span class="key-label">${displayLabel}</span>
        </div>
      `}).join('');
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
    
    // Track long-press for Loop encoder
    let loopLongPressTimer = null;
    let loopWasLongPress = false;
    
    let volumeHeld = false;

    let lastPlayedKey = null;

    // Chord type press/release handling (for playstyle behaviors)
    this.container.addEventListener('pointerdown', (e) => {
      const typeBtn = e.target.closest('[data-type]');
      if (typeBtn && (typeBtn.classList.contains('perf-btn') || typeBtn.closest('#type-controls'))) {
        e.preventDefault();
        this.actions.pressChordType(typeBtn.dataset.type);
        return;
      }

      const key = e.target.closest('.key');
      if (key) {
        e.preventDefault();
        // Release capture to allow sliding over keys
        if (key.hasPointerCapture && key.hasPointerCapture(e.pointerId)) {
          key.releasePointerCapture(e.pointerId);
        }
        const note = key.dataset.note;
        if (lastPlayedKey !== note) {
          this.actions.playNote(note);
          lastPlayedKey = note;
        }
      }
    });

    this.container.addEventListener('pointerover', (e) => {
      if (e.buttons === 1) {
        const key = e.target.closest('.key');
        if (key) {
          const note = key.dataset.note;
          if (lastPlayedKey !== note) {
            this.actions.playNote(note);
            lastPlayedKey = note;
          }
        }
      }
    });

    this.container.addEventListener('pointerup', (e) => {
      const typeBtn = e.target.closest('[data-type]');
      if (typeBtn && (typeBtn.classList.contains('perf-btn') || typeBtn.closest('#type-controls'))) {
        e.preventDefault();
        this.actions.releaseChordType(typeBtn.dataset.type);
        return;
      }

      const key = e.target.closest('.key');
      if (key) {
        e.preventDefault();
        this.actions.stopNote(key.dataset.note);
        if (lastPlayedKey === key.dataset.note) {
          lastPlayedKey = null;
        }
      }
    });

    this.container.addEventListener('pointerout', (e) => {
      const key = e.target.closest('.key');
      if (key) {
        e.preventDefault();
        // Avoid stopping if moving to a child element
        if (key.contains(e.relatedTarget)) return;
        
        this.actions.stopNote(key.dataset.note);
        if (lastPlayedKey === key.dataset.note) {
          lastPlayedKey = null;
        }
      }
    });

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

      const loopEncoder = e.target.closest('.encoder[data-encoder="loop"]');
      if (loopEncoder) {
        loopWasLongPress = false;
        loopLongPressTimer = setTimeout(() => {
          loopWasLongPress = true;
          this.actions.loopStop(); // Long press = Stop
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
      if (loopLongPressTimer) {
        clearTimeout(loopLongPressTimer);
        loopLongPressTimer = null;
      }
      volumeHeld = false;
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
      if (loopLongPressTimer) {
        clearTimeout(loopLongPressTimer);
        loopLongPressTimer = null;
      }
    });

    this.container.addEventListener('click', (e) => {
      const target = e.target;

      // Key encoder click (short press = toggle key lock on/off, shift+click toggles auto-chords)
      const keyEncoder = e.target.closest('.encoder[data-encoder="key"]');
      if (keyEncoder && e.shiftKey) {
        this.actions.toggleKeyAutoChords();
        return;
      }
      if (keyEncoder && !keyWasLongPress) {
        this.actions.toggleKey();
        return;
      }

      // Bass encoder click (short press = toggle on/off)
      const bassEncoder = e.target.closest('.encoder[data-encoder="bass"]');
      if (bassEncoder && !bassWasLongPress) {
        if (!this.state?.bassEnabled) {
          this.actions.toggleBass();
        } else {
          this.actions.cycleBassMode();
        }
        this.encoderEngaged.set('bass', true);
        return;
      }

      // Perform encoder click (short press = cycle perform mode)
      const performEncoder = e.target.closest('.encoder[data-encoder="perform"]');
      if (performEncoder && !performWasLongPress) {
        this.actions.cyclePerformMode();
        this.encoderEngaged.set('perform', true);
        return;
      }

      // BPM encoder click (short press = toggle beat engine)
      const bpmEncoder = e.target.closest('.encoder[data-encoder="bpm"]');
      if (bpmEncoder && !bpmWasLongPress) {
        this.actions.toggleBeatEngine();
        this.encoderEngaged.set('bpm', true);
        return;
      }

      // Loop encoder click
      const loopEncoder = e.target.closest('.encoder[data-encoder="loop"]');
      if (loopEncoder && !loopWasLongPress) {
        if (e.shiftKey) {
          this.actions.undoLoop();
        } else {
          this.actions.clickLoopEncoder();
        }
        this.encoderEngaged.set('loop', true);
        return;
      }

      const fxEncoder = e.target.closest('.encoder[data-encoder="fx"]');
      if (fxEncoder) {
        // Engage on click; cycling handled by actions
        this.encoderEngaged.set('fx', true);
        if (this._currentFxValue === undefined) this._currentFxValue = 0;
        if (e.shiftKey) {
          this.actions.toggleFxLock();
        } else {
          this.actions.cycleFxType();
        }
        return;
      }

      const optionsEncoder = e.target.closest('.encoder[data-encoder="options"]');
      if (optionsEncoder) {
        this.actions.cyclePlaystyle();
        return;
      }

      if (target.id === 'power-btn') this.actions.togglePower();

      if (target.closest('#ext-controls button')) {
        const ext = target.closest('button').dataset.ext;
        this.actions.toggleExtension(ext);
      }

      // Performance buttons - extensions
      if (target.classList.contains('perf-btn') && target.dataset.ext) {
        this.actions.toggleExtension(target.dataset.ext);
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
    // Best practice: drag up = increase (clockwise), drag down = decrease
    // Sensitivity: ~2px of movement per unit change
    
    let dragState = null; // { encoder, startY, startValue }
    
      // Helper to update encoder based on delta
      const updateEncoder = (encoderName, delta, encoder, { fine = false } = {}) => {
        const step = fine ? 1 : 3;
        const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
        this.encoderEngaged.set(encoderName, true);

        // Volume encoder: finite rotation with hard stops at 0 and 99
        if (encoderName === 'volume') {
          const adjustingBass = volumeHeld;
          if (adjustingBass) {
            if (this._currentBassVolume === undefined) this._currentBassVolume = 60;
            const newBass = clamp(this._currentBassVolume + delta * step, 0, 99);
            if (newBass !== this._currentBassVolume) {
              this._currentBassVolume = newBass;
              this._bassVolumeFlashUntil = Date.now() + 1200;
              this.actions.setBassVolume(this._currentBassVolume);
              const rotation = (this._currentBassVolume / 99) * 270 - 135;
              const knob = encoder.querySelector('.encoder-knob');
              if (knob) {
                knob.style.transform = `rotate(${rotation}deg)`;
              }
              const oledVolume = this.container.querySelector('.oled-volume');
              if (oledVolume) {
                oledVolume.textContent = `BASS ${this._currentBassVolume}`;
              }
            }
            return;
          } else {
            if (this._currentVolume === undefined) this._currentVolume = 70;
            const newVolume = clamp(this._currentVolume + delta * step, 0, 99);
            
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
        }
      
        // Bass encoder: finite rotation for bass volume (0-99)
        if (encoderName === 'bass') {
          if (this._currentBassVolume === undefined) this._currentBassVolume = 60;
        const newVolume = clamp(this._currentBassVolume + delta * step, 0, 99);
        
        if (newVolume !== this._currentBassVolume) {
          this._currentBassVolume = newVolume;
          this._bassVolumeFlashUntil = Date.now() + 1200;
          this.actions.setBassVolume(this._currentBassVolume);
          
          // Map volume 0-99 to rotation -135 to +135 degrees (270° sweep)
          const rotation = (this._currentBassVolume / 99) * 270 - 135;
          const knob = encoder.querySelector('.encoder-knob');
          if (knob) {
            knob.style.transform = `rotate(${rotation}deg)`;
          }
          const oledVolume = this.container.querySelector('.oled-volume');
          if (oledVolume) {
            oledVolume.textContent = `BASS ${this._currentBassVolume}`;
          }
        }
        return;
      }

        // FX encoder: finite rotation controlling current effect level (0-99)
        if (encoderName === 'fx') {
          if (this._currentFxValue === undefined) this._currentFxValue = 0;
          const newValue = clamp(this._currentFxValue + delta * step, 0, 99);
          if (newValue !== this._currentFxValue) {
            this._currentFxValue = newValue;
            const effect = (this._fxStateSnapshot && this._fxStateSnapshot.currentEffect) || this._lastFxEffect || 'reverb';
            if (effect !== 'direct') {
              this.actions.setFxLevel(effect, this._currentFxValue);
            }
            const knob = encoder.querySelector('.encoder-knob');
            if (knob) {
              const rotation = (this._currentFxValue / 99) * 270 - 135;
              knob.style.transform = `rotate(${rotation}deg)`;
            }
            const fxDisplay = this.container.querySelector('.oled-fx-value');
            if (fxDisplay) {
              const snapshot = this._fxStateSnapshot || {};
              const levels = { ...(snapshot.fxLevels || {}), [effect]: this._currentFxValue };
              const stateMock = {
                currentEffect: effect,
                fxLevels: levels,
                fxLocked: snapshot.fxLocked || false
              };
              fxDisplay.textContent = `${this.getFxDisplay(stateMock)} ${this.getFxLevel(stateMock)}`;
            }
          }
          return;
        }
      
        // Perform encoder: finite rotation (0-99) for division/speed
        if (encoderName === 'perform') {
          if (this._currentPerformValue === undefined) this._currentPerformValue = 50;
        const newValue = clamp(this._currentPerformValue + delta * step, 0, 99);
        
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
          // If Beat Engine is enabled, use infinite rotation for pattern selection
          if (this.state && this.state.beatEnabled) {
             if (!this.encoderRotations[encoderName]) {
               this.encoderRotations[encoderName] = 0;
             }
             this.encoderRotations[encoderName] += delta * 3;
             const knob = encoder.querySelector('.encoder-knob');
             if (knob) {
               knob.style.transform = `rotate(${this.encoderRotations[encoderName]}deg)`;
             }
             if (Math.abs(delta) >= 1) {
               const direction = delta > 0 ? 1 : -1;
               this.actions.cycleBeatPattern(direction);
             }
             return;
          }

          if (this._currentBpmValue === undefined) this._currentBpmValue = 36; // 120 BPM default
        const newValue = clamp(this._currentBpmValue + delta * step, 0, 99);
        
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
          if (encoderName === 'options') {
            // Options encoder is now unused for playstyle, but we can keep it for future use
            // or map it to something else. For now, let's map it to Playstyle as before
            // but we might want to move Playstyle to Shift+Perform later.
            this.actions.cyclePlaystyle(direction);
          }
          if (encoderName === 'loop') {
            this.actions.cycleLoopEncoder(direction);
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
        if (encoderName === 'volume') {
          volumeHeld = true;
        }
        if (encoderName === 'fx') {
          // Ensure we start from the displayed value
          if (this._currentFxValue === undefined) this._currentFxValue = 0;
        }
        
        dragState = {
          encoder,
          encoderName,
          startY: e.clientY,
          lastY: e.clientY,
          fine: e.shiftKey
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
        updateEncoder(dragState.encoderName, delta, dragState.encoder, { fine: dragState.fine });
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
      volumeHeld = false;
    });
    
    // Mouse wheel - also works
    this.container.addEventListener('wheel', (e) => {
      const encoder = e.target.closest('.encoder[data-encoder]');
      if (encoder) {
        e.preventDefault();
        const encoderName = encoder.dataset.encoder;
        const delta = e.deltaY > 0 ? -5 : 5; // Scroll up = increase
        const previousHold = volumeHeld;
        if (encoderName === 'volume') {
          volumeHeld = e.shiftKey || previousHold;
        }
        updateEncoder(encoderName, delta, encoder, { fine: e.shiftKey });
        this.encoderEngaged.set(encoderName, true);
        volumeHeld = previousHold;
      }
    }, { passive: false });

    // === DIAL DRAG & WHEEL (Voicing + Bass Voicing) ===
    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    const dialStep = (fine) => (fine ? 1 : 2);

    const handleDialDelta = (type, delta, fine) => {
      if (type === 'voicing') {
        const current = this._voicingDialValue ?? this.state?.voicingCenter ?? 60;
        const next = clamp(current + delta * dialStep(fine), 36, 84);
        if (next !== current) {
          this._voicingDialValue = next;
          this.actions.setVoicing(next);
        }
      } else if (type === 'bassVoicing') {
        const current = this._bassVoicingDialValue ?? this.state?.bassVoicing ?? 0;
        const next = clamp(current + delta * dialStep(fine), -24, 24);
        if (next !== current) {
          this._bassVoicingDialValue = next;
          this.actions.setBassVoicing(next);
        }
      }
    };

    let dialDrag = null;

    this.container.addEventListener('mousedown', (e) => {
      const knob = e.target.closest('#voicing-knob, #bass-knob');
      if (knob) {
        e.preventDefault();
        dialDrag = {
          knob,
          type: knob.id === 'voicing-knob' ? 'voicing' : 'bassVoicing',
          lastY: e.clientY,
          fine: e.shiftKey
        };
        document.body.style.cursor = 'ns-resize';
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!dialDrag) return;
      const deltaY = dialDrag.lastY - e.clientY;
      const sensitivity = 3;
      const delta = deltaY / sensitivity;
      if (Math.abs(delta) >= 1) {
        handleDialDelta(dialDrag.type, delta, dialDrag.fine);
        dialDrag.lastY = e.clientY;
      }
    });

    document.addEventListener('mouseup', () => {
      if (dialDrag) {
        dialDrag = null;
        document.body.style.cursor = '';
      }
    });

    this.container.addEventListener('wheel', (e) => {
      const knob = e.target.closest('#voicing-knob, #bass-knob');
      if (knob) {
        e.preventDefault();
        const type = knob.id === 'voicing-knob' ? 'voicing' : 'bassVoicing';
        const delta = e.deltaY > 0 ? -1 : 1;
        handleDialDelta(type, delta, e.shiftKey);
      }
    }, { passive: false });

    const flavourToggle = document.getElementById('flavour-toggle');
    if (flavourToggle) {
      flavourToggle.addEventListener('click', () => this.actions.toggleFlavour());
    }

    const recordBtn = document.getElementById('record-btn');
    if (recordBtn) {
      recordBtn.addEventListener('click', () => this.actions.toggleRecording());
    }
  }
}
