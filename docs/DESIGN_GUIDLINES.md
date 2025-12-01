Section 1: Overview
Poorchid is a 12-key digital polysynth concept built around a chord engine, performance modes, a synth engine, a bass engine, drum loops, FX, and a looper. For a web version, the flow is:
UI -> Chord Logic -> Performance Engine -> Synth + Bass -> FX -> Output (plus optional drums and looper).

Section 2: UI
Poorchid has a virtual 12-key keyboard onscreen. It can also accept input from WebMIDI, from the user’s computer keyboard, or from a touchscreen layout.
It uses eight chord buttons in a 2x4 grid. The top row selects chord type such as major, minor, diminished, suspended. The bottom row adds extensions such as 6, 7, major7, 9. Each button toggles on or off.
Knobs appear as onscreen rotary controls for Sound, Perform, FX, Key, Bass, Loop, BPM, and Voicing. Turning changes a value. Pressing or tapping opens that section. Some sections can be locked so their values do not change when a preset is changed.
A small text display area shows the current chord name, sound preset, BPM, performance mode, etc.
The Loop encoder controls the looper. Clicking toggles between Record, Play, and Overdub. Long-pressing stops the loop. Shift-clicking undoes the last layer.
Audio output is the web audio output.

Section 3: Chord Logic
The chord system takes the chosen root note (from the virtual keyboard, WebMIDI input, or keypress), the active chord type, any active extensions, Key Mode, and the Voicing setting.
When Key Mode is on, Poorchid locks to a scale. The 12 keys become scale degrees and automatically choose diatonic chords so each key acts like I, ii, iii, IV, V, and so on.
Chord construction begins by identifying the scale when Key Mode is active. A base triad is created from the chosen root and the chord type. Extensions such as 6, 7, maj7, and 9 are added on top.
Voicing shifts the chord notes by octaves to produce inversions or different ranges. Turning the voicing control moves either the lowest or highest note into another octave to keep the chord in a comfortable pitch area.
Poorchid generates a display name for the chord. If too many extensions combine in unusual ways, the naming may simplify.
The chord logic outputs a list of notes with octave positions, a chord name string, and the root note for the bass engine.

Section 4: Performance Engine
The performance system converts a chord’s note list into timed events that align with the global BPM.
Simple mode plays all notes together.
Strum sweeps from the lowest to the highest note with a short adjustable delay between each.
Strum 2 Octaves extends the sweep across a larger range.
Slop is similar to Strum but adds random timing variation.
Arpeggiator cycles through chord notes in a loop. Larger chords create longer patterns.
Arpeggiator 2 Octaves does the same over a wider range.
Pattern mode uses stored rhythmic templates that fire chord notes at set steps.
Harp mode sweeps upward across multiple octaves quickly.
The performance engine outputs a timeline of note-on and note-off events.

Section 5: Synth Engine
Poorchid’s sound engine contains three conceptual layers: a virtual analog subtractive synth, an FM synth, and a vintage reed piano model. The virtual analog and FM layers can use multiple oscillators, LFOs, envelopes, and filters.
Presets define which engine is active and what its parameters are. The Sound control switches presets.
A simplified web version can implement a basic subtractive layer, a simple FM layer, and a sampled or synthetic reed-piano-style layer.

Section 6: Bass Engine
The bass engine is separate from the main synth and is controlled by the Bass setting. It plays the root note of the chord or a simple rhythm based on BPM.
In the web app this can be a small single-voice synth dedicated to low frequencies.

Section 7: FX Engine
Effects include reverb, delay, chorus, phaser, flanger, drive, tremolo, and ensemble.
The FX control selects the active effect and adjusts a macro parameter such as wet level or depth. FX can be locked so sound presets do not overwrite the settings.
This is implemented as a post-synth effect block in the web audio graph.

Section 8: Beat Engine
Poorchid includes optional drum loops that follow the chosen BPM. Loops match musical styles such as trap, bossa, and others.
The BPM setting controls tempo and affects all performance timing and the looper.
Beat FX such as reverb or saturation may be applied to the drums.
A web version can use loop samples or a basic sequenced drum generator.

Section 9: Looper
The looper can record what the user plays and overdub more layers. Recording aligns to the BPM so loops remain in time. Loops can be cleared or undone.
In the web version this can record MIDI events or short audio segments aligned to bar lengths.

Section 10: System Flow
User interacts with the UI or through MIDI or keyboard.
The chord logic builds the note list for the chord.
The performance engine shapes that list into a timed sequence.
The synth engine plays the note events.
The bass engine adds its line.
FX is applied to the audio.
Drums play underneath if enabled.
The looper can capture and repeat the output.
Audio is delivered through the browser’s audio context.