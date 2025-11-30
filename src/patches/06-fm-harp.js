/**
 * 06 - FM HARP
 * Crystalline FM synthesis harp
 * 
 * DX7-inspired FM patch with bell-like harmonics and
 * quick pluck decay. Shimmering, ethereal quality.
 * Uses 2-operator FM for that classic digital sparkle.
 */

export const FMHarp = {
  id: 'fm-harp',
  name: 'FM Harp',
  category: 'pluck',
  
  createVoice(ctx, freq, velocity = 0.8) {
    const now = ctx.currentTime;
    const velGain = 0.3 + (velocity * 0.5);
    
    // FM synthesis: carrier + modulator
    // Ratio of ~3.5 gives that glassy harp harmonic
    const modRatio = 3.5;
    const modIndex = 4 + (velocity * 3); // Velocity controls brightness
    
    // Carrier oscillator (what we hear)
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = freq;
    
    // Modulator oscillator (modulates carrier frequency)
    const modulator = ctx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.value = freq * modRatio;
    
    // Modulation depth (index * carrier freq)
    const modGain = ctx.createGain();
    modGain.gain.value = modIndex * freq;
    
    // FM modulation envelope - quick decay for pluck
    modGain.gain.setValueAtTime(modIndex * freq, now);
    modGain.gain.exponentialRampToValueAtTime(freq * 0.5, now + 0.08);
    modGain.gain.exponentialRampToValueAtTime(freq * 0.1, now + 0.4);
    
    // Connect modulator to carrier frequency
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    
    // Second layer - slightly detuned for shimmer
    const carrier2 = ctx.createOscillator();
    carrier2.type = 'sine';
    carrier2.frequency.value = freq * 1.002; // Slight detune
    
    const mod2 = ctx.createOscillator();
    mod2.type = 'sine';
    mod2.frequency.value = freq * modRatio * 0.998;
    
    const modGain2 = ctx.createGain();
    modGain2.gain.value = modIndex * freq * 0.8;
    modGain2.gain.setValueAtTime(modIndex * freq * 0.8, now);
    modGain2.gain.exponentialRampToValueAtTime(freq * 0.3, now + 0.1);
    modGain2.gain.exponentialRampToValueAtTime(freq * 0.05, now + 0.5);
    
    mod2.connect(modGain2);
    modGain2.connect(carrier2.frequency);
    
    // Mix both carriers
    const mixer = ctx.createGain();
    mixer.gain.value = 0.4;
    
    const carrier1Gain = ctx.createGain();
    carrier1Gain.gain.value = 0.6;
    const carrier2Gain = ctx.createGain();
    carrier2Gain.gain.value = 0.4;
    
    carrier.connect(carrier1Gain);
    carrier2.connect(carrier2Gain);
    carrier1Gain.connect(mixer);
    carrier2Gain.connect(mixer);
    
    // Gentle highpass to remove rumble
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 80;
    
    // Soft lowpass to tame harsh highs
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 8000;
    lowpass.Q.value = 0.5;
    
    mixer.connect(highpass);
    highpass.connect(lowpass);
    
    // Amplitude envelope - harp pluck
    const ampEnv = ctx.createGain();
    ampEnv.gain.setValueAtTime(0, now);
    ampEnv.gain.linearRampToValueAtTime(velGain, now + 0.005); // Instant attack
    ampEnv.gain.exponentialRampToValueAtTime(velGain * 0.4, now + 0.15);
    ampEnv.gain.exponentialRampToValueAtTime(velGain * 0.15, now + 0.8);
    ampEnv.gain.setTargetAtTime(velGain * 0.08, now + 0.8, 1.5);
    
    lowpass.connect(ampEnv);
    
    // Start oscillators
    carrier.start(now);
    carrier2.start(now);
    modulator.start(now);
    mod2.start(now);
    
    // Output
    const output = ctx.createGain();
    output.gain.value = 0.7;
    ampEnv.connect(output);
    
    return {
      output,
      release(time = 0) {
        const releaseTime = ctx.currentTime + time;
        const relDuration = 0.8;
        
        ampEnv.gain.cancelScheduledValues(releaseTime);
        ampEnv.gain.setValueAtTime(ampEnv.gain.value, releaseTime);
        ampEnv.gain.exponentialRampToValueAtTime(0.001, releaseTime + relDuration);
        
        // Stop oscillators after release
        const stopTime = releaseTime + relDuration + 0.1;
        carrier.stop(stopTime);
        carrier2.stop(stopTime);
        modulator.stop(stopTime);
        mod2.stop(stopTime);
        
        setTimeout(() => {
          try {
            carrier.disconnect();
            carrier2.disconnect();
            modulator.disconnect();
            mod2.disconnect();
            modGain.disconnect();
            modGain2.disconnect();
            mixer.disconnect();
            highpass.disconnect();
            lowpass.disconnect();
            ampEnv.disconnect();
            output.disconnect();
          } catch (e) {}
        }, (relDuration + 0.2) * 1000);
        
        return relDuration;
      }
    };
  }
};
