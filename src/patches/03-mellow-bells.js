/**
 * 03 - MELLOW BELLS
 * Warm, glassy vibraphone-like tones
 * 
 * Soft FM bells with rounded attack, perfect for
 * jazzy chords and mellow arpeggios. Very 70s lounge.
 */

export const MellowBells = {
  id: 'mellow-bells',
  name: 'Mellow Bells',
  category: 'keys',
  
  createVoice(ctx, freq, velocity = 0.8) {
    const now = ctx.currentTime;
    const velGain = 0.2 + (velocity * 0.25);
    
    // Carrier - the main tone
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = freq;
    
    // Modulator - creates the bell shimmer (ratio 3:1 for vibes-like)
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    modulator.type = 'sine';
    modulator.frequency.value = freq * 3;
    
    // Gentle modulation that decays - key to warm bell sound
    const modAmount = freq * 0.8 * velocity; // Less modulation = warmer
    modGain.gain.setValueAtTime(modAmount, now);
    modGain.gain.exponentialRampToValueAtTime(modAmount * 0.1, now + 0.3);
    modGain.gain.setTargetAtTime(modAmount * 0.02, now + 0.3, 0.8);
    
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    
    // Second partial for warmth (octave below, subtle)
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.value = freq * 0.5;
    subGain.gain.value = 0.15;
    sub.connect(subGain);
    
    // Soft attack envelope - rounded, not harsh
    const ampEnv = ctx.createGain();
    ampEnv.gain.setValueAtTime(0, now);
    ampEnv.gain.linearRampToValueAtTime(velGain, now + 0.015); // Soft attack
    ampEnv.gain.exponentialRampToValueAtTime(velGain * 0.5, now + 0.2);
    ampEnv.gain.setTargetAtTime(velGain * 0.25, now + 0.2, 1.5);
    
    // Gentle lowpass for warmth
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2500;
    filter.Q.value = 0.5;
    
    // Routing
    carrier.connect(filter);
    subGain.connect(filter);
    filter.connect(ampEnv);
    
    // Output - normalized level
    const output = ctx.createGain();
    output.gain.value = 0.5;
    ampEnv.connect(output);
    
    // Start
    carrier.start(now);
    modulator.start(now);
    sub.start(now);
    
    return {
      output,
      release(time = 0) {
        const releaseTime = ctx.currentTime + time;
        const relDuration = 0.8;
        
        ampEnv.gain.cancelScheduledValues(releaseTime);
        ampEnv.gain.setValueAtTime(ampEnv.gain.value, releaseTime);
        ampEnv.gain.exponentialRampToValueAtTime(0.001, releaseTime + relDuration);
        
        carrier.stop(releaseTime + relDuration);
        modulator.stop(releaseTime + relDuration);
        sub.stop(releaseTime + relDuration);
        
        setTimeout(() => {
          carrier.disconnect();
          modulator.disconnect();
          modGain.disconnect();
          sub.disconnect();
          subGain.disconnect();
          filter.disconnect();
          ampEnv.disconnect();
          output.disconnect();
        }, (relDuration + 0.1) * 1000);
        
        return relDuration;
      }
    };
  }
};
