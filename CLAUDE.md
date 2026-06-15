# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Dev server at https://localhost:8080 (HTTPS via basicSsl plugin)
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
npm test           # Run tests in watch mode (Vitest)
npm run coverage   # Single test run with v8 coverage report
```

Run a single test file:
```bash
npx vitest run tests/chord-logic.test.js
```

Deploy pushes to `gh-pages` branch automatically on merge to `main` (see `.github/workflows/deploy.yml`). Manual deploy: `npm run deploy`.

## Architecture

Poorchid is a browser-only chord synthesizer built with Vite and vanilla JS (ES modules). There is no framework. The full audio pipeline runs in the browser via the Web Audio API.

### Signal Flow

```
Input (keyboard / MIDI / UI) → PoorchidApp
  → ChordLogic      (builds MIDI note array for the chord)
  → VoicingEngine   (shifts notes by octave toward the voicing dial target)
  → AudioEngine     (plays notes via the active Patch)
      → FXChain     (reverb / delay / chorus / etc.)
      → master filter → compressor → "flavour" chain → output
```

### Module Responsibilities

| File | Role |
|---|---|
| `src/main.js` | `PoorchidApp` — top-level controller; wires all subsystems together; handles keyboard and MIDI input; owns the performance playback logic |
| `src/state.js` | `PoorchidState` — single observable store; all state mutations go through named setters that call `notify(changedKeys)`; subscribers receive `(state, changedProps)` |
| `src/ui.js` | `PoorchidUI` — pure renderer; receives action callbacks from `PoorchidApp`; calls `mount()` once then `update(state)` on every state change |
| `src/chord-logic.js` | Pure chord math (no side-effects): note→MIDI mapping, triad + extension construction, key/scale quantization, diatonic chord type selection |
| `src/voicing-engine.js` | Inversion algorithm: iteratively moves outer notes by octave to center the chord stack around the dial value |
| `src/audio-engine.js` | Web Audio graph management: polyphonic voice pool, bass voice, arp voice, FX routing, master chain; wraps `AudioContext` |
| `src/effects.js` | `FXChain` + individual effect classes (`Reverb`, `Delay`, `Chorus`, etc.); each has `input`/`output` gain nodes and a `setLevel(0–99)` method |
| `src/arpeggiator.js` | `Arpeggiator`, `Strummer`, `PatternPlayer` — BPM-synced performance engines; use `AudioContext.currentTime` scheduling |
| `src/looper.js` | MIDI-event looper: records noteOn/noteOff timestamps and plays them back on a loop; aligns to BPM bars |
| `src/beat-engine.js` | Drum sequencer: generates kick/snare/hi-hat patterns synced to BPM |
| `src/patch-manager.js` | Registry of all patches; exports `PATCHES`, `PATCH_ORDER`, `DEFAULT_PATCH` |
| `src/patches/*.js` | Individual sound patches (see Patch System below) |
| `src/constants.js` | Key bindings, MIDI ranges, MIDI→extension map |
| `src/utils.js` | Shared math helpers (e.g. `midiToFreq`) |

### State Management Pattern

`PoorchidState` is a plain-JS observable. There is no reactive framework. Every UI action calls an action on the app (e.g. `togglePower()`), which calls a setter on `PoorchidState`, which calls `notify(['changedKey'])`. `PoorchidApp.handleStateChange(state, changedProps)` then applies audio-engine side-effects, and `PoorchidUI.update(state)` re-renders the UI.

**When adding a new state key**, you must also add it to the `validKeys` array in `handleStateChange` in `src/main.js` (line ~288) or you will get console warnings on every state update.

### Patch System

Each patch in `src/patches/` exports an object conforming to this contract:

```js
export const MyPatch = {
  id: 'my-patch',       // unique kebab-case
  name: 'My Patch',     // display name
  category: 'keys',     // keys | pad | pluck | lead | bass

  createVoice(ctx, freq, velocity = 0.8) {
    // Build a Web Audio sub-graph, return:
    return {
      output,            // GainNode — AudioEngine connects this to its input
      release(time = 0) {
        // Apply release envelope, schedule .stop() on oscillators
        return releaseDuration; // seconds
      }
    };
  }
};
```

To add a patch: create the file, then add an import + entry in both `PATCHES` and `PATCH_ORDER` in `src/patch-manager.js`.

### Performance Modes

`performMode` in state drives `playCurrentChord()` in `PoorchidApp`:

- `direct` — voices played immediately via `AudioEngine.playChord()`
- `arp` — `Arpeggiator` schedules notes using `AudioContext` time; `updateNotes()` called live so chord changes take effect mid-pattern
- `strum` / `strum2` / `slop` / `harp` — `Strummer` with varying speed/randomness
- `pattern` — `PatternPlayer` fires notes at rhythmic steps matching `rhythmPattern`

### Encoder Interaction Convention

All rotary controls follow this rule (from `docs/UI_ENCODER_GUIDELINES.md`):
- **Click** → cycle discrete mode or toggle (always has a neutral/off state)
- **Turn/drag** → adjust active value or browse options
- **Shift + turn** → fine step (1 unit instead of coarse)
- **Shift + click** → secondary toggle (e.g. FX lock)

Encoders are either *scoped* (0–99 over 270°, coarse by default) or *infinite* (wrap-around browsing).

### Architecture Constraint

Keep domain logic out of `src/ui.js` and `src/main.js`. Music math belongs in `src/chord-logic.js` or dedicated engine files. `src/main.js` wires things together; it should not contain synthesis or music-theory logic.

## Testing

Tests use Vitest with a `jsdom` environment. `AudioContext` and Web Audio nodes are mocked (see `tests/integration.test.js` for the mock pattern). Pure-logic modules (`chord-logic`, `voicing-engine`, `state`) can be tested directly without mocking.
