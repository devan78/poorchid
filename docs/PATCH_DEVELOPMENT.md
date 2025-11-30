# Poorchid Patch Development Guide

## Overview

Patches are self-contained sound generators that create voices using the Web Audio API. Each patch exports an object with a `createVoice()` method that returns a voice object with an `output` node and a `release()` method.

## Patch Structure

```javascript
/**
 * XX - PATCH NAME
 * Short description of the sound
 * 
 * Longer description of the character, inspiration,
 * and synthesis technique used.
 */

export const PatchName = {
  id: 'patch-id',           // Unique kebab-case identifier
  name: 'Patch Name',       // Display name
  category: 'keys',         // Category: 'keys', 'pad', 'pluck', 'lead', 'bass'
  
  // Optional: parameters for the synth engine
  params: {
    someParam: 0.5
  },
  
  createVoice(ctx, freq, velocity = 0.8) {
    // ctx: AudioContext
    // freq: Frequency in Hz
    // velocity: 0-1 normalized velocity
    
    // ... build your audio graph ...
    
    return {
      output,  // GainNode - connect this to the destination
      release(time = 0) {
        // Called when note is released
        // time: delay before release starts (usually 0)
        // Returns: release duration in seconds
        
        // ... apply release envelope ...
        // ... schedule cleanup ...
        
        return releaseDuration;
      }
    };
  }
};
```

## Synthesis Techniques

### 1. Subtractive Synthesis
Classic analog-style. Oscillators → Filter → Amp Envelope.

```javascript
// Oscillator types: 'sine', 'square', 'sawtooth', 'triangle'
const osc = ctx.createOscillator();
osc.type = 'sawtooth';
osc.frequency.value = freq;
osc.detune.value = 7; // cents

// Lowpass filter with envelope
const filter = ctx.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.value = 2000;
filter.Q.value = 2;

// Filter envelope
filter.frequency.setValueAtTime(500, now);
filter.frequency.linearRampToValueAtTime(4000, now + 0.1);
filter.frequency.exponentialRampToValueAtTime(1000, now + 0.5);
```

### 2. FM Synthesis
Digital, bell-like, metallic. Modulator oscillator controls carrier frequency.

```javascript
const modRatio = 3.5;  // Harmonic ratio
const modIndex = 4;     // Modulation depth

const carrier = ctx.createOscillator();
carrier.type = 'sine';
carrier.frequency.value = freq;

const modulator = ctx.createOscillator();
modulator.type = 'sine';
modulator.frequency.value = freq * modRatio;

const modGain = ctx.createGain();
modGain.gain.value = modIndex * freq;

modulator.connect(modGain);
modGain.connect(carrier.frequency);  // FM connection
```

### 3. Additive Synthesis
Build sound from individual harmonics. Great for organs, bells.

```javascript
const harmonics = [1, 2, 3, 4, 5, 6, 8];  // Harmonic numbers
const levels = [1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.12];

harmonics.forEach((harmonic, i) => {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq * harmonic;
  
  const gain = ctx.createGain();
  gain.gain.value = levels[i] / harmonics.length;
  
  osc.connect(gain);
  gain.connect(mixer);
  osc.start(now);
});
```

## Envelopes

### Amplitude Envelope (ADSR)
```javascript
const ampEnv = ctx.createGain();

// Attack
ampEnv.gain.setValueAtTime(0, now);
ampEnv.gain.linearRampToValueAtTime(velGain, now + 0.01);  // 10ms attack

// Decay + Sustain
ampEnv.gain.setTargetAtTime(velGain * 0.7, now + 0.01, 0.1);  // Decay to 70%

// Release (in release() method)
ampEnv.gain.cancelScheduledValues(releaseTime);
ampEnv.gain.setValueAtTime(ampEnv.gain.value, releaseTime);
ampEnv.gain.exponentialRampToValueAtTime(0.001, releaseTime + 0.5);
```

### Envelope Shapes
- `linearRampToValueAtTime()` - Linear, good for attack
- `exponentialRampToValueAtTime()` - Natural decay/release (can't ramp to 0!)
- `setTargetAtTime(value, startTime, timeConstant)` - RC-style curve, smooth

## LFOs (Low Frequency Oscillators)

```javascript
const lfo = ctx.createOscillator();
lfo.type = 'sine';  // or 'triangle' for smoother
lfo.frequency.value = 5;  // Hz

const lfoGain = ctx.createGain();
lfoGain.gain.value = 10;  // Depth in cents (for pitch) or Hz (for filter)

lfo.connect(lfoGain);
lfoGain.connect(osc.detune);  // Vibrato
// or: lfoGain.connect(filter.frequency);  // Filter wobble
// or: lfoGain.connect(ampEnv.gain);  // Tremolo

lfo.start(now);
```

## Filters

```javascript
const filter = ctx.createBiquadFilter();
filter.type = 'lowpass';   // 'lowpass', 'highpass', 'bandpass', 'notch'
filter.frequency.value = 2000;
filter.Q.value = 1;  // Resonance (0.5-20, higher = more resonant)
```

## Best Practices

### 1. Velocity Response
```javascript
const velGain = 0.2 + (velocity * 0.6);  // Min 0.2, max 0.8
// Brightness can also respond to velocity:
filter.frequency.value = 800 + (velocity * 3000);
```

### 2. Detuning for Thickness
```javascript
const detunes = [-8, 0, 8];  // cents
detunes.forEach(detune => {
  const osc = ctx.createOscillator();
  osc.detune.value = detune;
  // ...
});
```

### 3. Cleanup
Always clean up in the release method to prevent memory leaks:

```javascript
release(time = 0) {
  const releaseTime = ctx.currentTime + time;
  const relDuration = 0.5;
  
  // Stop oscillators after release completes
  oscillators.forEach(osc => osc.stop(releaseTime + relDuration + 0.1));
  
  // Disconnect nodes after a delay
  setTimeout(() => {
    try {
      oscillators.forEach(osc => osc.disconnect());
      filter.disconnect();
      ampEnv.disconnect();
      output.disconnect();
    } catch (e) {}
  }, (relDuration + 0.2) * 1000);
  
  return relDuration;
}
```

### 4. Output Levels
Keep output levels reasonable to avoid clipping:
- Individual oscillator gains: 0.1-0.3
- Mixer gains: 0.2-0.5
- Final output: 0.5-0.9

The audio engine applies master compression, but don't rely on it.

## Adding a New Patch

1. Create `src/patches/XX-patch-name.js`
2. Export your patch object
3. Add import to `src/patch-manager.js`
4. Add to `PATCHES` object
5. Add to `PATCH_ORDER` array

## Testing

```javascript
// Quick test in browser console:
const ctx = new AudioContext();
const patch = PATCHES['your-patch-id'];
const voice = patch.createVoice(ctx, 440, 0.8);  // A4, full velocity
voice.output.connect(ctx.destination);

// Release after 2 seconds
setTimeout(() => voice.release(), 2000);
```

## Categories

- **keys** - Piano, EP, organ, clavinet
- **pad** - Sustained, ambient, evolving
- **pluck** - Harp, guitar, pizzicato
- **lead** - Monophonic, expressive, solo
- **bass** - Low-end focused

## Inspiration

- **Warm/Vintage**: Low filter cutoff, slow attack, gentle release, detuned oscillators
- **Digital/Glassy**: FM synthesis, high harmonics, fast attack
- **Organic**: Noise layers, pitch drift, subtle LFOs
- **Aggressive**: High resonance, fast envelopes, distortion (waveshaper)
