/**
 * 04 - WARM LEAD
 * Smooth, vocal-like lead sound
 * 
 * Think Jan Hammer or Herbie Hancock's Headhunters.
 * Filtered square wave with gentle portamento feel.
 * Warm, not harsh - perfect for expressive melodies.
 */

export const WarmLead = {
  id: 'warm-lead',
  name: 'Warm Lead',
  category: 'lead',
  
  createVoice(ctx, freq, velocity = 0.8) {
    const now = ctx.currentTime;
    const velGain = 0.2 + (velocity * 0.25);
    
    // Main oscillator - pulse wave (softer than square)
    const osc1 = ctx.createOscillator();
    osc1.type = 'square';
    osc1.frequency.value = freq;
    
    // Sub oscillator one octave down for body
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = freq * 0.5;
    
    // Mixer
    const mixer = ctx.createGain();
    
    const osc1Gain = ctx.createGain();
    osc1Gain.gain.value = 0.3;
    osc1.connect(osc1Gain);
    osc1Gain.connect(mixer);
    
    const subGain = ctx.createGain();
    subGain.gain.value = 0.2;
    sub.connect(subGain);
    subGain.connect(mixer);
    
    // THE KEY: Warm lowpass filter with envelope
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2; // Slight resonance for character
    
    // Filter envelope - opens up then settles
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.linearRampToValueAtTime(1800 * velocity, now + 0.08);
    filter.frequency.setTargetAtTime(800, now + 0.1, 0.3);
    
    mixer.connect(filter);
    
    // Amp envelope - slightly rounded attack
    const ampEnv = ctx.createGain();
    ampEnv.gain.setValueAtTime(0, now);
    ampEnv.gain.linearRampToValueAtTime(velGain, now + 0.02);
    ampEnv.gain.setTargetAtTime(velGain * 0.7, now + 0.1, 0.2);
    
    filter.connect(ampEnv);
    
    // Gentle vibrato (delayed)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 5;
    lfoGain.gain.setValueAtTime(0, now);
    lfoGain.gain.setTargetAtTime(6, now + 0.3, 0.2); // Delayed vibrato
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.detune);
    lfoGain.connect(sub.detune);
    lfo.start(now);
    
    // Output - normalized level
    const output = ctx.createGain();
    output.gain.value = 0.5;
    ampEnv.connect(output);
    
    // Start oscillators
    osc1.start(now);
    sub.start(now);
    
    return {
      output,
      release(time = 0) {
        const releaseTime = ctx.currentTime + time;
        const relDuration = 0.25;
        
        ampEnv.gain.cancelScheduledValues(releaseTime);
        ampEnv.gain.setValueAtTime(ampEnv.gain.value, releaseTime);
        ampEnv.gain.exponentialRampToValueAtTime(0.001, releaseTime + relDuration);
        
        filter.frequency.setTargetAtTime(200, releaseTime, 0.1);
        
        osc1.stop(releaseTime + relDuration);
        sub.stop(releaseTime + relDuration);
        lfo.stop(releaseTime + relDuration);
        
        setTimeout(() => {
          osc1.disconnect();
          sub.disconnect();
          osc1Gain.disconnect();
          subGain.disconnect();
          mixer.disconnect();
          filter.disconnect();
          ampEnv.disconnect();
          lfo.disconnect();
          lfoGain.disconnect();
          output.disconnect();
        }, (relDuration + 0.1) * 1000);
        
        return relDuration;
      }
    };
  }
};
