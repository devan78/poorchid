# Poorchid

**Poorchid** (The Poor Man's Orchid) is an open-source web-based chord synthesizer inspired by the Telepathic Instruments Orchid. It features a unique "Voicing Dial" that allows for fluid inversion and spreading of chords across the keyboard.

## Features

-   **Polyphonic Chord Generation**: Automatically generates chords from single root notes.
-   **Chord Types**: Major, Minor, Suspended, Diminished.
-   **Extensions**: Add 6th, 7th, Major 7th, and 9th intervals.
-   **Voicing Dial**: A continuous control to shift the chord voicing up and down the spectrum, creating musical inversions automatically.
-   **Web Audio API**: Pure synthesis, no samples required.

## Controls

### Right Hand (Notes)

-   **H**: C
-   **U**: C#
-   **J**: D
-   **I**: D#
-   **K**: E
-   **L**: F
-   **O**: F#
-   **;**: G
-   **P**: G#
-   **'**: A
-   **[**: A#

### Left Hand (Modifiers)

-   **Extensions**:
    -   **Q**: 6
    -   **W**: 7
    -   **E**: Maj7
    -   **R**: 9
-   **Chord Types**:
    -   **A**: Major
    -   **S**: Minor
    -   **D**: Suspended
    -   **F**: Diminished
-   **Voicing**:
    -   **Z**: Voicing Down
    -   **X**: Voicing Up

### Other

-   **Power**: Click the ON/OFF button.
-   **MIDI**: Connect a MIDI keyboard to play.

## Getting Started

### Prerequisites

-   Node.js (v16+)
-   npm

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/poorchid.git
    cd poorchid
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

### Development

Start the development server:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### Testing

Run the test suite (Vitest):

```bash
npm test
```

To run coverage:

```bash
npm run coverage
```

## Architecture

-   **`src/chord-logic.js`**: Pure logic for calculating MIDI notes based on chord rules.
-   **`src/voicing-engine.js`**: Algorithm for adjusting note octaves based on the "Voicing Dial" center pitch.
-   **`src/audio-engine.js`**: Wrapper around Web Audio API to manage oscillators and envelopes.
-   **`src/main.js`**: Main application controller and UI rendering.

## License

MIT
